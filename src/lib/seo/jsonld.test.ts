import { describe, it, expect } from "vitest";
import {
  organizationJsonLd,
  websiteJsonLd,
  jsonLdScripts,
} from "./jsonld";

describe("organizationJsonLd", () => {
  it("emits schema.org Organization with site name + url", () => {
    const ld = organizationJsonLd();
    expect(ld["@context"]).toBe("https://schema.org");
    expect(ld["@type"]).toBe("Organization");
    expect(typeof ld.name).toBe("string");
    expect(typeof ld.url).toBe("string");
  });
});

describe("websiteJsonLd", () => {
  it("emits schema.org WebSite", () => {
    const ld = websiteJsonLd();
    expect(ld["@type"]).toBe("WebSite");
    expect(ld["@context"]).toBe("https://schema.org");
  });
});

describe("jsonLdScripts", () => {
  it("converts to TanStack head().scripts entries with application/ld+json type", () => {
    const scripts = jsonLdScripts([organizationJsonLd(), websiteJsonLd()]);
    expect(scripts).toHaveLength(2);
    expect(scripts[0]!.type).toBe("application/ld+json");
    expect(scripts[0]!.children.startsWith("{")).toBe(true);
    // Payload must parse back to a valid JSON-LD object.
    const parsed = JSON.parse(scripts[0]!.children);
    expect(parsed["@type"]).toBe("Organization");
  });
});
