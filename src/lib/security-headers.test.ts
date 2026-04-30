import { describe, it, expect } from "vitest";
import { applySecurityHeaders, assertSameOrigin } from "./security-headers";

describe("applySecurityHeaders", () => {
  it("sets all required security headers on a Response", () => {
    const res = new Response("<html/>", { status: 200 });
    const out = applySecurityHeaders(res);
    expect(out.headers.get("content-security-policy")).toMatch(/default-src 'self'/);
    expect(out.headers.get("x-frame-options")).toBe("DENY");
    expect(out.headers.get("x-content-type-options")).toBe("nosniff");
    expect(out.headers.get("referrer-policy")).toBe("strict-origin-when-cross-origin");
    expect(out.headers.get("permissions-policy")).toMatch(/geolocation=\(\)/);
  });

  it("preserves status and body", async () => {
    const res = new Response("hello", { status: 418 });
    const out = applySecurityHeaders(res);
    expect(out.status).toBe(418);
    expect(await out.text()).toBe("hello");
  });

  it("does not clobber pre-existing content-type", () => {
    const res = new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
    const out = applySecurityHeaders(res);
    expect(out.headers.get("content-type")).toBe("application/json");
  });
});

describe("assertSameOrigin", () => {
  const APP = "https://example.com";

  it("passes when origin matches appUrl", () => {
    const req = new Request("https://example.com/api/x", {
      method: "POST",
      headers: { origin: "https://example.com" },
    });
    expect(() => assertSameOrigin(req, APP)).not.toThrow();
  });

  // Trade-off: absent Origin is allowed to support server-to-server callers
  // (same-Worker scheduled handlers, curl health checks) that don't set an
  // Origin header. The compensating controls are: same-site session cookie
  // (Lax by default in BetterAuth) + Content-Type header sniffing on the
  // client. Non-browser clients that somehow reach a mutating server fn
  // still have to present a valid session token.
  it("allows requests with no Origin header (trade-off: enables non-browser clients, relies on same-site cookie + content-type for CSRF)", () => {
    const req = new Request("https://example.com/api/x", { method: "POST" });
    expect(() => assertSameOrigin(req, APP)).not.toThrow();
  });

  // Cross-origin Origin header is always rejected — the absent-Origin branch
  // above is the only "lenient" path, and it requires NO Origin at all.
  it("rejects cross-origin Origin header", () => {
    const req = new Request("https://example.com/api/x", {
      method: "POST",
      headers: { origin: "https://evil.com" },
    });
    expect(() => assertSameOrigin(req, APP)).toThrow(/forbidden origin/);
  });

  it("rejects a malformed Origin header that cannot be parsed as a URL", () => {
    const req = new Request("https://example.com/api/x", {
      method: "POST",
      headers: { origin: "not-a-url" },
    });
    expect(() => assertSameOrigin(req, APP)).toThrow(/invalid origin/);
  });
});
