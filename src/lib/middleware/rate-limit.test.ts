import { describe, it, expect, vi, beforeEach } from "vitest";
import { RateLimitError } from "@/lib/rate-limit";
import type { DB } from "@/db/client";

// Stub the CF Workers module — the middleware chain (db → auth → rate-limit)
// transitively imports `cloudflare:workers` at module-load time even
// though `enforceUserRateLimit` itself never reads env. vi.mock is hoisted
// above the static import of `./rate-limit` below, so resolution succeeds.
vi.mock("cloudflare:workers", () => ({ env: {} }));

// Mock the shared `consume` helper — it's already covered by rate-limit.test.ts
// at its own boundary (SQL interaction, window math). Here we only assert
// that the pure wrapper keys the bucket correctly and propagates errors
// untouched (localization lives in the middleware wrapper, not the core).
vi.mock("@/lib/rate-limit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/rate-limit")>();
  return {
    ...actual,
    consume: vi.fn(),
  };
});

import { consume } from "@/lib/rate-limit";
import { enforceUserRateLimit } from "./rate-limit";

const mockConsume = vi.mocked(consume);

describe("enforceUserRateLimit", () => {
  const db = {} as DB;
  const userId = "user_abc";
  const opts = { key: "api-call", budget: 10, windowSec: 3600 };

  beforeEach(() => {
    mockConsume.mockReset();
  });

  it("derives a user-scoped bucket key from opts.key + userId", async () => {
    mockConsume.mockResolvedValueOnce(undefined);
    await enforceUserRateLimit(db, userId, opts);
    expect(mockConsume).toHaveBeenCalledOnce();
    const call = mockConsume.mock.calls[0]!;
    expect(call[0]).toBe(db);
    expect(call[1]).toEqual({
      key: "api-call:user_abc",
      budget: 10,
      windowSec: 3600,
    });
  });

  it("resolves quietly when consume succeeds", async () => {
    mockConsume.mockResolvedValueOnce(undefined);
    await expect(enforceUserRateLimit(db, userId, opts)).resolves.toBeUndefined();
  });

  it("propagates RateLimitError unchanged (middleware wrapper handles localization)", async () => {
    const rateLimitErr = new RateLimitError("api-call:user_abc", 42);
    mockConsume.mockRejectedValueOnce(rateLimitErr);
    await expect(enforceUserRateLimit(db, userId, opts)).rejects.toBe(rateLimitErr);
  });

  it("propagates non-rate-limit errors unchanged", async () => {
    const dbError = new Error("connection refused");
    mockConsume.mockRejectedValueOnce(dbError);
    await expect(enforceUserRateLimit(db, userId, opts)).rejects.toBe(dbError);
  });
});
