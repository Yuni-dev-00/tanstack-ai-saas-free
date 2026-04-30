import { describe, it, expect } from "vitest";
import { buildSitemapXml } from "./sitemap";

describe("buildSitemapXml", () => {
  it("emits one <url> per locale per entry", () => {
    const entries = [{ path: "/" }, { path: "/privacy-policy" }];
    const xml = buildSitemapXml(entries);
    const count = (xml.match(/<url>/g) ?? []).length;
    // entries.length × locales (en + zh) = total URL blocks
    expect(count).toBe(entries.length * 2);
  });

  it("includes both localized URLs with canonical paths", () => {
    const xml = buildSitemapXml([{ path: "/privacy-policy" }]);
    expect(xml).toContain("/privacy-policy</loc>");
    expect(xml).toContain("/zh/privacy-policy</loc>");
  });

  it("attaches hreflang alternates (2 locales + x-default) per url", () => {
    const xml = buildSitemapXml([{ path: "/" }]);
    const hreflangs = xml.match(/hreflang="[^"]+"/g) ?? [];
    // 2 urls × (2 locale alternates + 1 x-default) = 6 hreflang attrs.
    expect(hreflangs).toHaveLength(6);
    expect(hreflangs.filter((h) => h.includes("x-default"))).toHaveLength(2);
    expect(hreflangs.filter((h) => h.includes("zh-CN"))).toHaveLength(2);
    expect(hreflangs.filter((h) => h.includes('"en"'))).toHaveLength(2);
  });

  it("declares xhtml namespace on urlset", () => {
    const xml = buildSitemapXml([{ path: "/" }]);
    expect(xml).toContain(
      'xmlns:xhtml="http://www.w3.org/1999/xhtml"',
    );
  });

  it("x-default points at the default-locale URL (en: bare path, no /en prefix)", () => {
    const xml = buildSitemapXml([{ path: "/about" }]);
    const match = xml.match(/hreflang="x-default" href="([^"]+)"/);
    expect(match).not.toBeNull();
    expect(match![1]).toMatch(/\/about$/);
    expect(match![1]).not.toMatch(/\/en\/about/);
  });

  it("preserves changefreq + priority + lastmod fields on each emitted url", () => {
    const xml = buildSitemapXml([
      {
        path: "/",
        lastmod: "2026-04-23",
        changefreq: "weekly",
        priority: 1,
      },
    ]);
    const lastmods = (xml.match(/<lastmod>/g) ?? []).length;
    const changefreqs = (xml.match(/<changefreq>weekly/g) ?? []).length;
    const priorities = (xml.match(/<priority>1\.0/g) ?? []).length;
    // 2 urls × 1 = 2 each.
    expect(lastmods).toBe(2);
    expect(changefreqs).toBe(2);
    expect(priorities).toBe(2);
  });

  it("escapes special chars in paths", () => {
    const xml = buildSitemapXml([{ path: "/foo?q=a&b=c" }]);
    expect(xml).toContain("&amp;");
    expect(xml).not.toContain("?q=a&b=c</loc>");
  });

  it("emits absolute URLs for all <loc> elements (Google Sitemaps requirement)", () => {
    const xml = buildSitemapXml([{ path: "/privacy-policy" }, { path: "/about" }]);
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    expect(locs.length).toBeGreaterThan(0);
    for (const loc of locs) {
      expect(loc).toMatch(/^https?:\/\//);
    }
  });

  it("escapes XML special chars in URL paths (& in path becomes &amp; in <loc>)", () => {
    // The sitemap escape() function replaces & with &amp; so the XML is valid.
    // < and > in URL paths are percent-encoded by the URL constructor before escaping.
    const xml = buildSitemapXml([{ path: "/foo?a=1&b=2" }]);
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    expect(locs.length).toBeGreaterThan(0);
    for (const loc of locs) {
      // Raw unescaped & must not appear — it must be &amp;
      expect(loc).not.toMatch(/&(?!amp;)/);
      expect(loc).toContain("&amp;");
    }
  });
});
