import { describe, it, expect } from "vitest";
import { seo } from "./seo";

describe("seo helper — title + basics", () => {
  it("emits title, description, robots index/follow by default", () => {
    const { meta } = seo({ title: "Hello", description: "World" });
    expect(meta.find((m) => m.title === "Hello")).toBeDefined();
    expect(meta.find((m) => m.name === "description")?.content).toBe("World");
    expect(meta.find((m) => m.name === "robots")?.content).toBe(
      "index, follow",
    );
  });

  it("flips robots to noindex, nofollow when opts.noindex is set", () => {
    const { meta } = seo({ title: "Secret", noindex: true });
    expect(meta.find((m) => m.name === "robots")?.content).toBe(
      "noindex, nofollow",
    );
  });

  it("uses property= for og:* tags (not name=)", () => {
    const { meta } = seo({ title: "t" });
    const og = meta.filter((m) =>
      typeof m.property === "string" && m.property.startsWith("og:"),
    );
    expect(og.length).toBeGreaterThan(0);
    expect(og.every((m) => !m.name)).toBe(true);
  });
});

describe("seo helper — hreflang + canonical per locale", () => {
  it("emits hreflang for each locale + x-default when path+locale are given", () => {
    const { links } = seo({ title: "Home", path: "/", locale: "en" });
    const alts = links.filter((l) => l.rel === "alternate");
    expect(alts.length).toBe(3); // 2 locales + x-default
    const hreflangs = alts.map((l) => l.hrefLang).sort();
    expect(hreflangs).toEqual(["en", "x-default", "zh-CN"].sort());
  });

  it("x-default points at the default-locale URL", () => {
    const { links } = seo({ title: "Home", path: "/", locale: "zh" });
    const xdef = links.find((l) => l.hrefLang === "x-default");
    expect(xdef?.href).toMatch(/\/$/); // ends with "/" (default locale has no prefix)
    expect(xdef?.href).not.toMatch(/\/zh/);
  });

  it("canonical URL reflects the active locale", () => {
    const zh = seo({ title: "Page", path: "/page", locale: "zh" });
    const canonicalZh = zh.links.find((l) => l.rel === "canonical")?.href;
    expect(canonicalZh).toMatch(/\/zh\/page$/);

    const en = seo({ title: "Page", path: "/page", locale: "en" });
    const canonicalEn = en.links.find((l) => l.rel === "canonical")?.href;
    expect(canonicalEn).toMatch(/\/page$/);
    expect(canonicalEn).not.toMatch(/\/zh/);
  });

  it("emits og:locale matching the active locale + og:locale:alternate", () => {
    const { meta } = seo({ title: "t", path: "/", locale: "zh" });
    expect(meta.find((m) => m.property === "og:locale")?.content).toBe(
      "zh_CN",
    );
    const alts = meta.filter((m) => m.property === "og:locale:alternate");
    expect(alts.map((a) => a.content)).toEqual(["en_US"]);
  });

  it("omits hreflang entirely when only `canonical` is passed (back-compat)", () => {
    const { links } = seo({ title: "t", canonical: "/foo" });
    expect(links.filter((l) => l.rel === "alternate")).toHaveLength(0);
    expect(links.find((l) => l.rel === "canonical")?.href).toMatch(/\/foo$/);
  });
});

describe("seo helper — images + twitter", () => {
  it("summary_large_image twitter card when image provided", () => {
    const { meta } = seo({
      title: "t",
      image: "https://example.com/og.png",
    });
    expect(meta.find((m) => m.name === "twitter:card")?.content).toBe(
      "summary_large_image",
    );
    expect(meta.find((m) => m.property === "og:image")?.content).toBe(
      "https://example.com/og.png",
    );
  });

  it("summary twitter card fallback when no image", () => {
    const { meta } = seo({ title: "t" });
    expect(meta.find((m) => m.name === "twitter:card")?.content).toBe(
      "summary",
    );
  });
});
