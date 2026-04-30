import { describe, it, expect } from "vitest";
import {
  computeNextWindow,
  extractClientIp,
  RateLimitError,
} from "./rate-limit";

describe("computeNextWindow", () => {
  const now = new Date("2026-04-23T12:00:00Z");

  it("brand-new key → count=1, new window", () => {
    const next = computeNextWindow(null, now, 60);
    expect(next.count).toBe(1);
    expect(next.resetAt.getTime()).toBe(now.getTime() + 60_000);
  });

  it("within an unexpired window → increments count, keeps resetAt", () => {
    const stored = {
      count: 2,
      resetAt: new Date(now.getTime() + 30_000),
    };
    const next = computeNextWindow(stored, now, 60);
    expect(next.count).toBe(3);
    expect(next.resetAt).toEqual(stored.resetAt);
  });

  it("expired window (resetAt in the past) → resets to count=1 in a new window", () => {
    const stored = {
      count: 9999,
      resetAt: new Date(now.getTime() - 1000),
    };
    const next = computeNextWindow(stored, now, 60);
    expect(next.count).toBe(1);
    expect(next.resetAt.getTime()).toBe(now.getTime() + 60_000);
  });

  it("resetAt exactly == now → treated as expired (boundary, user-favoring)", () => {
    const stored = {
      count: 5,
      resetAt: new Date(now),
    };
    const next = computeNextWindow(stored, now, 60);
    expect(next.count).toBe(1);
  });

  it("simulates exhausting a budget of 3 over 4 consume calls", () => {
    // Mirrors what SQL consume() does, in pure form, so the test documents
    // the expected state progression.
    let row = null as { count: number; resetAt: Date } | null;
    const ts = new Date("2026-04-23T00:00:00Z");
    const budget = 3;
    let firstRejectedAt: number | null = null;

    for (let i = 0; i < 5; i++) {
      row = computeNextWindow(row, ts, 60);
      if (row.count > budget && firstRejectedAt === null) {
        firstRejectedAt = i;
      }
    }

    expect(firstRejectedAt).toBe(3); // 1,2,3 allowed; 4th (index 3) exceeds
    expect(row!.count).toBeGreaterThan(budget);
  });
});

describe("extractClientIp", () => {
  it("prefers cf-connecting-ip over x-forwarded-for", () => {
    const req = new Request("https://example.com/", {
      headers: {
        "cf-connecting-ip": "203.0.113.5",
        "x-forwarded-for": "10.0.0.1, 10.0.0.2",
      },
    });
    expect(extractClientIp(req)).toBe("203.0.113.5");
  });

  it("falls back to x-forwarded-for (first hop) when cf-connecting-ip absent", () => {
    const req = new Request("https://example.com/", {
      headers: { "x-forwarded-for": "203.0.113.5, 10.0.0.1" },
    });
    expect(extractClientIp(req)).toBe("203.0.113.5");
  });

  it("falls back to 'unknown' when neither header is present", () => {
    const req = new Request("https://example.com/");
    expect(extractClientIp(req)).toBe("unknown");
  });

  it("trims whitespace around the IP", () => {
    const req = new Request("https://example.com/", {
      headers: { "x-forwarded-for": "  203.0.113.5  , 10.0.0.1" },
    });
    expect(extractClientIp(req)).toBe("203.0.113.5");
  });
});

describe("RateLimitError", () => {
  it("carries key + retryAfterSec and has a descriptive message", () => {
    const e = new RateLimitError("ip:1.2.3.4:anon-generate", 42);
    expect(e).toBeInstanceOf(Error);
    expect(e.key).toBe("ip:1.2.3.4:anon-generate");
    expect(e.retryAfterSec).toBe(42);
    expect(e.message).toMatch(/ip:1.2.3.4:anon-generate/);
    expect(e.message).toMatch(/42s/);
    expect(e.name).toBe("RateLimitError");
  });
});
