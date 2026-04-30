import { createAuthForRequest } from "@/lib/auth";
import { log } from "@/lib/log";
import { applySecurityHeaders } from "@/lib/security-headers";
import type { WorkerEnv } from "@/lib/env";
import { consume, extractClientIp, RateLimitError } from "@/lib/rate-limit";

export async function handleAuth(
  request: Request,
  env: WorkerEnv,
  _ctx: ExecutionContext,
  meta: { requestId: string; started: number },
): Promise<Response> {
  const { requestId, started } = meta;
  const url = new URL(request.url);

  const { auth, db, client } = await createAuthForRequest(env);
  try {
    try {
      const ip = extractClientIp(request);
      await consume(db, { key: `ip:auth:${ip}`, budget: 10, windowSec: 60 }, env);
    } catch (err) {
      if (err instanceof RateLimitError) {
        log("warn", "auth.rate_limited", { requestId, path: url.pathname });
        return new Response(JSON.stringify({ error: "Too many requests" }), {
          status: 429,
          headers: { "content-type": "application/json", "retry-after": String(err.retryAfterSec) },
        });
      }
      throw err;
    }

    const res = await auth.handler(request);
    res.headers.set("x-request-id", requestId);
    log("info", "auth.handler", {
      requestId,
      path: url.pathname,
      status: res.status,
      latencyMs: Date.now() - started,
    });
    return applySecurityHeaders(res);
  } finally {
    _ctx.waitUntil(client.end().catch(() => {}));
  }
}
