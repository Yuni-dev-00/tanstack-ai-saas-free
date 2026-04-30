// Shared shapes for the two rate-limit backends (PG in lib/rate-limit.ts
// and Upstash Redis in lib/rate-limit-redis.ts). Extracted into its own
// module so the two backends can reference RateLimitError without
// importing each other (which would create a cycle that eslint flags).

export interface RateLimitOptions {
  key: string;
  budget: number;
  windowSec: number;
}

export class RateLimitError extends Error {
  constructor(
    public readonly key: string,
    public readonly retryAfterSec: number,
  ) {
    super(`Rate limit exceeded for ${key}; retry after ${retryAfterSec}s`);
    this.name = "RateLimitError";
  }
}
