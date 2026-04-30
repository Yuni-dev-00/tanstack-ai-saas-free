import { describe, it, expect } from "vitest";
import {
  parseUserAgent,
  parseAttributionCookie,
  getRequestCookie,
} from "./server";

describe("parseUserAgent", () => {
  it("identifies Chrome on macOS desktop", () => {
    const ua =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36";
    expect(parseUserAgent(ua)).toEqual({
      browser: "Chrome",
      os: "macOS",
      deviceType: "desktop",
    });
  });

  it("identifies Safari on iPhone (mobile)", () => {
    const ua =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
    const out = parseUserAgent(ua);
    expect(out.os).toBe("iOS");
    expect(out.deviceType).toBe("mobile");
    expect(out.browser).toBe("Safari");
  });

  it("identifies iPadOS 13+ Safari (UA spoofs Macintosh; deviceType must be tablet)", () => {
    const ua =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1";
    expect(parseUserAgent(ua)).toEqual({
      browser: "Safari",
      os: "iOS",
      deviceType: "tablet",
    });
  });

  it("identifies Edge before Chrome (Edge UA contains both Edg/ and Chrome/)", () => {
    const ua =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36 Edg/123.0.0.0";
    expect(parseUserAgent(ua).browser).toBe("Edge");
  });

  it("identifies Firefox on Linux desktop", () => {
    const ua =
      "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:124.0) Gecko/20100101 Firefox/124.0";
    expect(parseUserAgent(ua)).toEqual({
      browser: "Firefox",
      os: "Linux",
      deviceType: "desktop",
    });
  });

  it("identifies Android Chrome (mobile)", () => {
    const ua =
      "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Mobile Safari/537.36";
    expect(parseUserAgent(ua)).toEqual({
      browser: "Chrome",
      os: "Android",
      deviceType: "mobile",
    });
  });

  it("identifies Android tablet", () => {
    const ua =
      "Mozilla/5.0 (Linux; Android 13; SM-X700) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36";
    expect(parseUserAgent(ua).deviceType).toBe("tablet");
  });

  it("classifies Googlebot as a bot regardless of OS tail", () => {
    const ua =
      "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";
    expect(parseUserAgent(ua)).toEqual({
      browser: "Bot",
      os: "Bot",
      deviceType: "bot",
    });
  });

  it("returns 'Other' for empty UA without throwing", () => {
    expect(parseUserAgent("")).toEqual({
      browser: "Other",
      os: "Other",
      deviceType: "desktop",
    });
  });

  it("returns 'Other' / 'Other' for an unrecognised non-bot UA", () => {
    // No browser-family token, no bot keyword, no OS token.
    const out = parseUserAgent("CustomClient/1.0");
    expect(out.browser).toBe("Other");
    expect(out.os).toBe("Other");
    expect(out.deviceType).toBe("desktop");
  });
});

describe("parseAttributionCookie", () => {
  it("returns null for missing cookie", () => {
    expect(parseAttributionCookie(null)).toBeNull();
    expect(parseAttributionCookie(undefined)).toBeNull();
    expect(parseAttributionCookie("")).toBeNull();
  });

  it("returns null for malformed JSON instead of throwing", () => {
    expect(parseAttributionCookie("not-json")).toBeNull();
    expect(parseAttributionCookie("%7Bbroken")).toBeNull();
  });

  it("returns null when firstTouchAt is missing (mandatory field)", () => {
    const raw = encodeURIComponent(JSON.stringify({ utmSource: "google" }));
    expect(parseAttributionCookie(raw)).toBeNull();
  });

  it("decodes a valid URL-encoded JSON cookie", () => {
    const payload = {
      firstTouchAt: "2026-04-23T08:00:00.000Z",
      utmSource: "twitter",
      affCode: "yuni-affil-42",
    };
    const raw = encodeURIComponent(JSON.stringify(payload));
    const out = parseAttributionCookie(raw);
    expect(out).toEqual(payload);
  });

  it("returns null for non-object payload (defensive against malicious cookies)", () => {
    expect(parseAttributionCookie("123")).toBeNull();
    expect(parseAttributionCookie(encodeURIComponent("[]"))).toBeNull();
  });
});

describe("getRequestCookie", () => {
  it("returns null when no cookie header is present", () => {
    const req = new Request("https://example.com");
    expect(getRequestCookie(req, "_attr")).toBeNull();
  });

  it("extracts a single cookie value", () => {
    const req = new Request("https://example.com", {
      headers: { cookie: "_attr=hello-world" },
    });
    expect(getRequestCookie(req, "_attr")).toBe("hello-world");
  });

  it("extracts the right value among many cookies", () => {
    const req = new Request("https://example.com", {
      headers: { cookie: "session=abc; _attr=picked; theme=dark" },
    });
    expect(getRequestCookie(req, "_attr")).toBe("picked");
    expect(getRequestCookie(req, "session")).toBe("abc");
    expect(getRequestCookie(req, "theme")).toBe("dark");
  });

  it("URL-decodes the value", () => {
    const req = new Request("https://example.com", {
      headers: { cookie: `_attr=${encodeURIComponent('{"x":1}')}` },
    });
    expect(getRequestCookie(req, "_attr")).toBe('{"x":1}');
  });

  it("returns null for missing cookie name even when others present", () => {
    const req = new Request("https://example.com", {
      headers: { cookie: "session=abc" },
    });
    expect(getRequestCookie(req, "_attr")).toBeNull();
  });
});
