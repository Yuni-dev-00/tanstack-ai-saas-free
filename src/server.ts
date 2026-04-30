import handler from "@tanstack/react-start/server-entry";
import { sql } from "drizzle-orm";
import { createDb, resolveConnectionString } from "@/db/client";
import { getOrCreateRequestId, log, setLogContext, errorMessage } from "@/lib/log";
import { applySecurityHeaders, generateCspNonce } from "@/lib/security-headers";
import type { WorkerEnv } from "@/lib/env";
import { createSentry, captureError } from "@/lib/sentry";
import { handleAuth } from "@/server/routes/auth";
import { handleSitemap, handleRobots, handleManifest, handleHealth } from "@/server/routes/static";

// HTTP dispatch + request-id propagation + logging + security headers.
// Route modules live under src/server/routes/. The cron handler and the
// SSR fall-through (with CSP-nonce rewriting) remain here.

export default {
  async fetch(request: Request, env: unknown, ctx: ExecutionContext): Promise<Response> {
    const started = Date.now();
    const requestId = getOrCreateRequestId(request);
    const url = new URL(request.url);
    // Attach version + commit + worker name to every log line for the rest
    // of this isolate's life. setLogContext is idempotent — only sets keys
    // that are non-empty, so a later request can't accidentally clobber.
    const versionEnv = env as { APP_VERSION?: string; GIT_COMMIT?: string };
    setLogContext({
      version: versionEnv.APP_VERSION,
      commit: versionEnv.GIT_COMMIT,
    });
    const sentry = createSentry(
      env as { SENTRY_DSN?: string; APP_VERSION?: string; GIT_COMMIT?: string },
      request,
      ctx,
    );
    // Tag every event in this request with the requestId so GlitchTip
    // entries can be cross-referenced against structured logs by
    // `x-request-id` without the engineer reading stack traces first.
    sentry?.setTag("requestId", requestId);

    const meta = { requestId, started };
    const e = env as WorkerEnv;

    try {
      // Better Auth catch-all. Handles /api/auth/get-session, /api/auth/sign-in/*,
      // /api/auth/sign-up/*, /api/auth/callback/google, /api/auth/passkey/*, etc.
      // (Note: Better Auth 1.6.7 uses /get-session, not /session.)
      // per-request pool is closed via ctx.waitUntil after response flushes.
      if (url.pathname.startsWith("/api/auth/")) {
        return handleAuth(request, e, ctx, meta);
      }

      // Dynamic sitemap — single source of truth: src/lib/sitemap.ts.
      if (url.pathname === "/sitemap.xml") {
        return handleSitemap(request, e, ctx, meta);
      }

      // Dynamic robots.txt — ensures Sitemap: URL stays in sync with SITE_URL.
      if (url.pathname === "/robots.txt") {
        return handleRobots(request, e, ctx, meta);
      }

      // Dynamic PWA manifest — served instead of public/manifest.json so
      // brand/color/icon changes ship with the Worker (no public/ rebuild).
      // Source of truth: src/lib/manifest.ts.
      if (url.pathname === "/manifest.webmanifest" || url.pathname === "/manifest.json") {
        return handleManifest(request, e, ctx, meta);
      }

      // Liveness + DB reachability + version. Used by CI post-deploy canary
      // and any external uptime monitor.
      if (url.pathname === "/health") {
        return handleHealth(request, e, ctx, meta);
      }

      // Accept-Language auto-detect redirect (env-gated)
      if (
        url.pathname === "/" &&
        (e as any).LOCALE_DETECTION === "true" &&
        !request.headers.get("cookie")?.includes("locale=")
      ) {
        const { parseAcceptLanguage } = await import("@/lib/i18n/detect");
        const pick = parseAcceptLanguage(request.headers.get("accept-language"));
        if (pick !== "en") {
          return Response.redirect(`${url.origin}/${pick}${url.search}`, 302);
        }
      }

      const ssr = await handler.fetch(request, { context: { fromFetch: true } });
      ssr.headers.set("x-request-id", requestId);
      // Inject a per-request CSP nonce onto every inline <script> in the
      // SSR HTML, then enable nonce-based CSP. This tightens script-src
      // from `'unsafe-inline'` to `'nonce-...' 'strict-dynamic'`, so a
      // future XSS injection that lands an un-nonce'd <script> tag in
      // the document cannot execute. style-src intentionally stays on
      // `'unsafe-inline'` (see security-headers.ts) — runtime-injected
      // styles from devtools/next-themes/Radix can't carry a
      // nonce, and inline CSS alone is not a code-execution vector.
      // Non-HTML responses (json, text, redirects) skip the rewriter.
      const isHtml = (ssr.headers.get("content-type") ?? "").includes("text/html");
      if (!isHtml) {
        const res = applySecurityHeaders(ssr);
        log("info", "ssr.render", {
          requestId,
          path: url.pathname,
          status: res.status,
          latencyMs: Date.now() - started,
        });
        return res;
      }
      const nonce = generateCspNonce();
      const rewritten = new HTMLRewriter()
        .on("script", {
          element(el) {
            if (!el.getAttribute("src")) el.setAttribute("nonce", nonce);
          },
        })
        .transform(ssr);
      const res = applySecurityHeaders(rewritten, {
        nonce,
        umamiScriptUrl: (e as any).UMAMI_SCRIPT_URL,
        rybbitScriptUrl: (e as any).RYBBIT_SCRIPT_URL,
      });
      log("info", "ssr.render", {
        requestId,
        path: url.pathname,
        status: res.status,
        latencyMs: Date.now() - started,
      });
      return res;
    } catch (err) {
      log("error", "server.fetch.unhandled", {
        requestId,
        path: url.pathname,
        error: errorMessage(err),
        latencyMs: Date.now() - started,
      });
      captureError(sentry, err, { requestId, path: url.pathname });
      throw err;
    }
  },

  // Cron Trigger handler. Runs on the schedule in wrangler.jsonc.
  async scheduled(
    _event: ScheduledEvent,
    env: unknown,
    ctx: ExecutionContext,
  ): Promise<void> {
    const e = env as {
      HYPERDRIVE?: { connectionString: string };
      DATABASE_URL?: string;
      EVOLINK_API_KEY?: string;
      SENTRY_DSN?: string;
      APP_VERSION?: string;
      GIT_COMMIT?: string;
    };
    setLogContext({ version: e.APP_VERSION, commit: e.GIT_COMMIT });
    const sentry = createSentry(e, undefined, ctx);
    const connectionString = resolveConnectionString(e);
    const { db, client } = await createDb(connectionString);
    try {
      // Purge expired rate-limit rows to prevent unbounded table growth
      await db.execute(sql`DELETE FROM rate_limits WHERE reset_at < NOW()`).catch((err) => {
        log("warn", "cron.rate_limit_cleanup_failed", { error: errorMessage(err) });
      });
    } catch (err) {
      log("error", "cron.reconcile.failed", {
        error: errorMessage(err),
      });
      captureError(sentry, err, { task: "cron.reconcile" });
      throw err;
    } finally {
      ctx.waitUntil(
        client.end().catch(() => {
          /* best-effort */
        }),
      );
    }
  },
};
