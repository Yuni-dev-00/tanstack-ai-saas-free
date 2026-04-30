import { describe, it, expect } from "vitest";
import { maskIp } from "./server";

// IP masking is the GDPR/CCPA gate before persisting to user_sources.
// A regression here turns the attribution table into a deanonymisation
// dataset for an attacker with a DB dump — exactly what the masking
// is supposed to prevent. Cover the formats the CF edge actually emits.

describe("maskIp", () => {
  it("zeros the last octet of an IPv4 address", () => {
    expect(maskIp("203.0.113.42")).toBe("203.0.113.0");
    expect(maskIp("8.8.8.8")).toBe("8.8.8.0");
    expect(maskIp("192.168.1.255")).toBe("192.168.1.0");
  });

  it("keeps the first three hextets of a fully-expanded IPv6", () => {
    expect(maskIp("2001:db8:1234:5678:9abc:def0:1234:5678")).toBe(
      "2001:db8:1234::",
    );
  });

  it("expands compressed IPv6 (::) before slicing — never emits triple-colon", () => {
    // 2001:db8::1 expands to 2001:db8:0:0:0:0:0:1 → first 3 hextets
    // are 2001, db8, 0. Output must be a syntactically valid mask.
    expect(maskIp("2001:db8::1")).toBe("2001:db8:0::");
    expect(maskIp("::1")).toBe("0:0:0::");
    expect(maskIp("fe80::1ff:fe23:4567:890a")).toBe("fe80:0:0::");
  });

  it("returns 'unknown' for IPv4-mapped IPv6 (we don't try to be clever)", () => {
    // ::ffff:192.0.2.1 is technically valid IPv6 but contains dots —
    // expandIpv6 rejects via the regex, returning 'unknown'. Better
    // than emitting a malformed mix.
    expect(maskIp("::ffff:192.0.2.1")).toBe("unknown");
  });

  it("rejects malformed IPv6 (multiple ::, hex out of range chars)", () => {
    expect(maskIp("2001::db8::1")).toBe("unknown"); // two `::` is invalid
    expect(maskIp("xyzz:db8::1")).toBe("unknown"); // non-hex
  });

  it("preserves the 'unknown' sentinel", () => {
    expect(maskIp("unknown")).toBe("unknown");
    expect(maskIp("")).toBe("unknown");
  });

  it("returns 'unknown' for malformed IPv4", () => {
    expect(maskIp("not.an.ip")).toBe("unknown"); // 3 octets only after split
    expect(maskIp("999.999")).toBe("unknown");
  });

  it("never returns the original IP unmodified for a normal IPv4", () => {
    const out = maskIp("203.0.113.42");
    expect(out).not.toBe("203.0.113.42");
  });
});
