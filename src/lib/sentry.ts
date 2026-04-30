import { Toucan } from "toucan-js";

// Thin wrapper around toucan-js (Sentry-compatible SDK that works on CF
// Workers — the official @sentry/cloudflare bundles Node polyfills that
// blow past the Worker 10MB ceiling). Each fetch / scheduled handler
// creates its own Toucan instance with the current Request + ctx, then
// either reports uncaught errors or is a no-op when SENTRY_DSN is unset.
//
// Wire points in src/server.ts: fetch handler top-level try/catch and
// scheduled() handler. captureException() inside log("error", ...) sites
// would be noisier than necessary — we catch at the dispatch edge so one
// failing request = one event.

export interface SentryEnv {
  SENTRY_DSN?: string;
  APP_VERSION?: string;
  GIT_COMMIT?: string;
}

export function createSentry(
  env: SentryEnv,
  request: Request | undefined,
  ctx: ExecutionContext,
): Toucan | null {
  if (!env.SENTRY_DSN) return null;
  return new Toucan({
    dsn: env.SENTRY_DSN,
    request,
    context: ctx,
    release: env.APP_VERSION || env.GIT_COMMIT || "dev",
    // Don't attach cookies / auth headers by default — prevents
    // accidentally shipping session cookies into GlitchTip.
    requestDataOptions: {
      allowedCookies: false,
      allowedHeaders: [
        "user-agent",
        "accept",
        "accept-language",
        "content-type",
        "x-request-id",
      ],
      allowedSearchParams: true,
    },
  });
}

export function captureError(
  sentry: Toucan | null,
  err: unknown,
  context?: Record<string, unknown>,
): void {
  if (!sentry) return;
  try {
    if (context) sentry.setContext("handler", context);
    sentry.captureException(err);
  } catch {
    // Toucan itself threw — a broken error reporter must never fail the request.
  }
}
