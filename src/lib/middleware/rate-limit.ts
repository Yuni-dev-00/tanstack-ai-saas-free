import { createMiddleware } from "@tanstack/react-start";
import { consume, RateLimitError } from "@/lib/rate-limit";
import type { UpstashEnv } from "@/lib/rate-limit-redis";
import type { DB } from "@/db/client";
import { log } from "@/lib/log";
import { localizedError } from "@/lib/i18n/localized-error";
import { requireAuthMiddleware } from "./auth";

export interface UserRateLimitOptions {
  // Key prefix — the authed user id is appended to form the bucket key.
  key: string;
  // Max requests per window.
  budget: number;
  // Window length in seconds.
  windowSec: number;
}

// Pure, testable core of the per-user rate limit: derives the bucket key
// and consumes one token. Lets RateLimitError propagate so callers can
// decide how to surface it (HTTP status, toast copy, retry header, …).
// Exposed separately from the middleware so unit tests don't need to
// spin up the TanStack middleware runtime.
export async function enforceUserRateLimit(
  db: DB,
  userId: string,
  opts: UserRateLimitOptions,
  env?: UpstashEnv,
): Promise<void> {
  await consume(
    db,
    {
      key: `${opts.key}:${userId}`,
      budget: opts.budget,
      windowSec: opts.windowSec,
    },
    env,
  );
}

// Per-user rate limit middleware. Chains after `requireAuthMiddleware` so
// `context.user.id` is guaranteed non-null. Stops a malicious/runaway
// signed-in client from hammering expensive downstream calls.
//
// Anonymous paths should apply `consumeAnonymousIp` from `@/lib/rate-limit`
// directly inside their handler — IP-keyed rate limiting is not a
// middleware because it's only meaningful when the handler has decided
// the request is anonymous (after inspecting `context.user`).
export function userRateLimitMiddleware(opts: UserRateLimitOptions) {
  return createMiddleware({ type: "function" })
    .middleware([requireAuthMiddleware])
    .server(async ({ next, context }) => {
      try {
        await enforceUserRateLimit(
          context.db,
          context.user.id,
          opts,
          context.env as UpstashEnv,
        );
      } catch (err) {
        if (err instanceof RateLimitError) {
          log("warn", "rate_limited", {
            key: opts.key,
            userId: context.user.id,
            retryAfterSec: err.retryAfterSec,
          });
          throw localizedError(context.request, "errors.rateLimited", {
            seconds: err.retryAfterSec,
          });
        }
        throw err;
      }
      return next();
    });
}
