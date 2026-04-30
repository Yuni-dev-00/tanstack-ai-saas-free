// Upstash Redis REST-API rate limiter.
//
// Used as the optional, fast path in `lib/rate-limit.ts:consume()` —
// when both UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are
// configured we route through Redis for cross-region atomicity. When
// either is missing or the call fails we fall back to the PG-backed
// limiter so the system stays usable on a fresh deploy without Redis.
//
// Algorithm: Redis pipeline `INCR` + `EXPIRE NX`. The first request in
// a window sets the count to 1 and the TTL to windowSec; subsequent
// requests just INCR (TTL was already set, NX is no-op). When the key
// expires, the next INCR resets to 1 and EXPIRE re-establishes TTL.

import { RateLimitError, type RateLimitOptions } from "./rate-limit-types";

export interface UpstashEnv {
  UPSTASH_REDIS_REST_URL?: string;
  UPSTASH_REDIS_REST_TOKEN?: string;
}

export function isUpstashConfigured(env: UpstashEnv): boolean {
  return !!(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN);
}

interface UpstashPipelineResponse {
  result?: unknown[];
  error?: string;
}

// Returns the new count for the key. Throws on Redis error so the
// caller (lib/rate-limit.ts:consume) can fall back to PG.
async function incrementWithExpiry(
  env: Required<UpstashEnv>,
  key: string,
  windowSec: number,
): Promise<{ count: number; ttlSec: number }> {
  // Pipeline two commands in one round-trip:
  //   INCR <key>
  //   EXPIRE <key> <windowSec> NX
  //
  // Then a second small call to PTTL to learn the actual remaining
  // window for the RateLimitError retry-after. PTTL is microseconds
  // cheap; we tolerate the extra round-trip on the rejection path.
  const pipelineUrl = `${env.UPSTASH_REDIS_REST_URL.replace(/\/$/, "")}/pipeline`;
  const res = await fetch(pipelineUrl, {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.UPSTASH_REDIS_REST_TOKEN}`,
      "content-type": "application/json",
    },
    body: JSON.stringify([
      ["INCR", key],
      ["EXPIRE", key, String(windowSec), "NX"],
    ]),
    // Cap latency so a Redis blip doesn't hold the request — 2s is
    // generous for any healthy region's REST p99.
    signal: AbortSignal.timeout(2000),
  });
  if (!res.ok) {
    throw new Error(`upstash pipeline ${res.status}`);
  }
  const data = (await res.json()) as UpstashPipelineResponse[];
  // Pipeline returns an array of per-command results.
  const incrResult = data[0];
  if (!incrResult || incrResult.error) {
    throw new Error(incrResult?.error ?? "upstash incr failed");
  }
  const count = Number(incrResult.result);
  if (!Number.isFinite(count)) {
    throw new TypeError("upstash incr returned non-numeric");
  }

  // Best-effort TTL lookup for accurate retry-after. If this fails
  // we just default to windowSec (slightly pessimistic, never wrong).
  let ttlSec = windowSec;
  try {
    const ttlRes = await fetch(
      `${env.UPSTASH_REDIS_REST_URL.replace(/\/$/, "")}/ttl/${encodeURIComponent(key)}`,
      {
        headers: { authorization: `Bearer ${env.UPSTASH_REDIS_REST_TOKEN}` },
        signal: AbortSignal.timeout(2000),
      },
    );
    if (ttlRes.ok) {
      const ttlBody = (await ttlRes.json()) as { result?: number };
      const t = Number(ttlBody.result);
      if (Number.isFinite(t) && t > 0) ttlSec = t;
    }
  } catch {
    // Best-effort TTL fetch — Upstash REST blip or timeout; windowSec is a safe pessimistic fallback.
  }
  return { count, ttlSec };
}

export async function consumeRedis(
  env: UpstashEnv,
  { key, budget, windowSec }: RateLimitOptions,
): Promise<void> {
  if (!isUpstashConfigured(env)) {
    throw new Error("consumeRedis called without Upstash configured");
  }
  const { count, ttlSec } = await incrementWithExpiry(
    env as Required<UpstashEnv>,
    key,
    windowSec,
  );
  if (count > budget) {
    throw new RateLimitError(key, Math.max(1, ttlSec));
  }
}
