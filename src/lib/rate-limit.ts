import { sql } from "drizzle-orm";
import { rateLimits } from "@/db/schema";
import type { DB } from "@/db/client";
import { log, errorMessage } from "@/lib/log";
import {
  consumeRedis,
  isUpstashConfigured,
  type UpstashEnv,
} from "./rate-limit-redis";
import { RateLimitError, type RateLimitOptions } from "./rate-limit-types";

// Re-export so existing call sites that import `RateLimitError` /
// `RateLimitOptions` from `@/lib/rate-limit` keep compiling.
export { RateLimitError } from "./rate-limit-types";
export type { RateLimitOptions } from "./rate-limit-types";

// Fixed-window rate limiter. Two backends with the same shape:
//   1. Upstash Redis (optional fast path) — when env carries
//      UPSTASH_REDIS_REST_URL + TOKEN. Cross-region atomic, sub-ms.
//   2. PG `rate_limits` table (always-available fallback) — atomic
//      upsert with CASE-based window reset.
//
// `consume()` accepts an optional env arg; when it's set and Upstash is
// configured we try Redis first and fall through to PG only on Redis
// failure (network blip, REST 5xx, etc.). When env is omitted we go
// straight to PG. This keeps the template usable on a fresh deploy
// without Upstash, and lets downstream products opt in by setting the
// two secrets — no code change needed.

export interface WindowRow {
  count: number;
  resetAt: Date;
}

// Pure window-advance logic. Given the previously stored row (or null for a
// brand-new key) and the current time, compute the next row after consuming
// one unit. The SQL in `consume()` implements exactly this, but in a single
// atomic upsert. Kept factored + exported so the logic can be unit-tested
// and so the two representations can never drift.
export function computeNextWindow(
  stored: WindowRow | null,
  now: Date,
  windowSec: number,
): WindowRow {
  if (!stored || stored.resetAt.getTime() <= now.getTime()) {
    return {
      count: 1,
      resetAt: new Date(now.getTime() + windowSec * 1000),
    };
  }
  return { count: stored.count + 1, resetAt: stored.resetAt };
}

export async function consume(
  db: DB,
  opts: RateLimitOptions,
  env?: UpstashEnv,
): Promise<void> {
  // Redis-first when configured. RateLimitError from `consumeRedis` is
  // a legitimate user-facing throttle, NOT an infra failure — re-throw
  // immediately rather than masking it with a PG fallback that would
  // give the user double their budget.
  if (env && isUpstashConfigured(env)) {
    try {
      await consumeRedis(env, opts);
      return;
    } catch (err) {
      if (err instanceof RateLimitError) throw err;
      log("warn", "rate-limit.upstash.fallback_to_pg", {
        key: opts.key,
        error: errorMessage(err),
      });
      // fall through to PG path
    }
  }
  await consumePostgres(db, opts);
}

async function consumePostgres(
  db: DB,
  { key, budget, windowSec }: RateLimitOptions,
): Promise<void> {
  // SQL mirror of computeNextWindow. CASE-expression upsert means the
  // "is the window expired?" decision and the counter increment happen in
  // a single statement, so two concurrent isolates can't both see "count=3"
  // and both write "count=4".
  const rows = await db
    .insert(rateLimits)
    .values({
      key,
      count: 1,
      resetAt: sql`NOW() + (${windowSec} || ' seconds')::interval`,
    })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: {
        count: sql`CASE WHEN ${rateLimits.resetAt} > NOW() THEN ${rateLimits.count} + 1 ELSE 1 END`,
        resetAt: sql`CASE WHEN ${rateLimits.resetAt} > NOW() THEN ${rateLimits.resetAt} ELSE NOW() + (${windowSec} || ' seconds')::interval END`,
      },
    })
    .returning({ count: rateLimits.count, resetAt: rateLimits.resetAt });

  const row = rows[0];
  if (!row) throw new Error("rate-limit upsert returned no row");
  if (row.count > budget) {
    const retryAfterSec = Math.max(
      1,
      Math.ceil((row.resetAt.getTime() - Date.now()) / 1000),
    );
    throw new RateLimitError(key, retryAfterSec);
  }
}

// Pulls the client IP for anonymous rate-limit keys. Priority:
//   1. cf-connecting-ip — Cloudflare-set, trusted on Workers
//   2. x-forwarded-for  — first hop; dev / non-CF proxy fallback
//   3. "unknown" — shared bucket; better than throwing
//
// Never trust request.headers from code paths that haven't gone through CF
// (direct curl to the Worker's workers.dev URL still has cf-connecting-ip
// set by the edge; local `pnpm dev` will only have x-forwarded-for or
// nothing, which falls through to "unknown").
export function extractClientIp(source: Request | Headers): string {
  const headers = source instanceof Headers ? source : source.headers;
  const cfIp = headers.get("cf-connecting-ip");
  if (cfIp) return cfIp.trim();
  const fwd = headers.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0]?.trim();
    if (first) return first;
  }
  // Trade-off: falling back to "unknown" creates a single shared rate-limit
  // bucket for all clients whose IP cannot be determined (e.g. local dev,
  // direct Workers.dev URLs without Cloudflare proxy). This is intentional —
  // it avoids throwing on missing headers while still providing a backstop.
  // In production all traffic goes through CF so cf-connecting-ip is always
  // set. Log the fallback so it's visible in dev/test environments.
  log("warn", "rate-limit.ip_unknown", {
    url: source instanceof Headers ? "(headers-only)" : source.url,
  });
  return "unknown";
}

// Convenience wrapper for the anonymous-IP rate-limit pattern. `scope`
// distinguishes different endpoints so budgets don't share (e.g. an
// anon-user has independent budgets for "anon-generate" vs "anon-signup").
export async function consumeAnonymousIp(
  db: DB,
  request: Request,
  scope: string,
  budget: number,
  windowSec: number,
  env?: UpstashEnv,
): Promise<void> {
  const ip = extractClientIp(request);
  await consume(db, { key: `ip:${ip}:${scope}`, budget, windowSec }, env);
}
