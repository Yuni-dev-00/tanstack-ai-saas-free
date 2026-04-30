import { describe, it, expect, vi, beforeEach } from "vitest";
import { log, newRequestId, getOrCreateRequestId } from "./log";

describe("newRequestId", () => {
  it("returns a 12-char hex string", () => {
    const id = newRequestId();
    expect(id).toMatch(/^[0-9a-f]{12}$/);
  });

  it("produces unique values across many calls", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 1000; i++) ids.add(newRequestId());
    expect(ids.size).toBe(1000);
  });
});

describe("getOrCreateRequestId", () => {
  it("uses the incoming x-request-id when present and valid-looking", () => {
    const req = new Request("http://localhost/", { headers: { "x-request-id": "abc123def456" } });
    expect(getOrCreateRequestId(req)).toBe("abc123def456");
  });

  it("generates a new id when header is missing", () => {
    const req = new Request("http://localhost/");
    const id = getOrCreateRequestId(req);
    expect(id).toMatch(/^[0-9a-f]{12}$/);
  });

  it("rejects too-long or non-ASCII x-request-id and generates its own", () => {
    const req = new Request("http://localhost/", { headers: { "x-request-id": "a".repeat(300) } });
    const id = getOrCreateRequestId(req);
    expect(id.length).toBe(12);
  });
});

describe("log", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("writes a single JSON line to console with ts/level/message/fields", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    log("info", "hello", { requestId: "r1", extra: 42 });
    expect(spy).toHaveBeenCalledTimes(1);
    const line = spy.mock.calls[0]?.[0] as string;
    const parsed = JSON.parse(line);
    expect(parsed.level).toBe("info");
    expect(parsed.message).toBe("hello");
    expect(parsed.requestId).toBe("r1");
    expect(parsed.extra).toBe(42);
    expect(typeof parsed.ts).toBe("string");
  });

  it("routes error level to console.error", () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    log("error", "oops", { requestId: "r2" });
    expect(errSpy).toHaveBeenCalledTimes(1);
  });
});
