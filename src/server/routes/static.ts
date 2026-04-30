import { sql } from "drizzle-orm";
import { createDb, resolveConnectionString } from "@/db/client";
import { log, errorMessage } from "@/lib/log";
import { applySecurityHeaders } from "@/lib/security-headers";
import { manifestResponse } from "@/lib/manifest";
import { sitemapResponse } from "@/lib/sitemap";
import { robotsResponse } from "@/lib/robots";
import type { WorkerEnv } from "@/lib/env";

export async function handleSitemap(
  _request: Request,
  _env: WorkerEnv,
  _ctx: ExecutionContext,
  meta: { requestId: string; started: number },
): Promise<Response> {
  const { requestId, started } = meta;
  const res = sitemapResponse();
  res.headers.set("x-request-id", requestId);
  log("info", "sitemap", { requestId, latencyMs: Date.now() - started });
  return applySecurityHeaders(res);
}

export async function handleRobots(
  _request: Request,
  _env: WorkerEnv,
  _ctx: ExecutionContext,
  meta: { requestId: string; started: number },
): Promise<Response> {
  const { requestId, started } = meta;
  const res = robotsResponse();
  res.headers.set("x-request-id", requestId);
  log("info", "robots", { requestId, latencyMs: Date.now() - started });
  return applySecurityHeaders(res);
}

export async function handleManifest(
  _request: Request,
  env: WorkerEnv,
  _ctx: ExecutionContext,
  meta: { requestId: string; started: number },
): Promise<Response> {
  const { requestId, started } = meta;
  const res = manifestResponse({ APP_URL: env.APP_URL });
  res.headers.set("x-request-id", requestId);
  log("info", "manifest", { requestId, latencyMs: Date.now() - started });
  return applySecurityHeaders(res);
}

export async function handleHealth(
  _request: Request,
  env: WorkerEnv,
  ctx: ExecutionContext,
  meta: { requestId: string; started: number },
): Promise<Response> {
  const { requestId, started } = meta;
  let dbOk = false;
  try {
    const connectionString = resolveConnectionString(env);
    const { db, client } = await createDb(connectionString);
    try {
      await db.execute(sql`SELECT 1`);
      dbOk = true;
    } finally {
      // Don't block the response on pool teardown — CF Workers' ctx.waitUntil
      // keeps the isolate alive long enough for cleanup after the response flushes.
      ctx.waitUntil(client.end().catch(() => { /* swallow; isolate may already be ending */ }));
    }
  } catch (err) {
    log("warn", "health.db_ping_failed", {
      requestId,
      error: errorMessage(err),
    });
  }
  const res = Response.json(
      {
        status: dbOk ? "ok" : "degraded",
        db: dbOk,
        version: env.APP_VERSION || "dev",
        commit: env.GIT_COMMIT || "unknown",
        latencyMs: Date.now() - started,
      },
    {
      status: dbOk ? 200 : 503,
      headers: { "x-request-id": requestId, "cache-control": "no-store" },
    },
  );
  log("info", "health", { requestId, dbOk, latencyMs: Date.now() - started });
  return applySecurityHeaders(res);
}
