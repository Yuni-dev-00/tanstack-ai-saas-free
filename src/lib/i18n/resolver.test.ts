import { describe, it, expect } from "vitest";
import { resolveLocale, parseAcceptLanguage, t, getMessages } from "./resolver";
import { dirFor, withLocalePrefix, stripLocalePrefix } from "./config";

function mk(url: string, headers: Record<string, string> = {}): Request {
  return new Request(url, { headers });
}

describe("resolveLocale priority", () => {
  it("URL prefix wins over cookie and Accept-Language", () => {
    const r = mk("https://ex.com/zh/page", {
      cookie: "locale=en",
      "accept-language": "en-US",
    });
    expect(resolveLocale(r)).toBe("zh");
  });

  it("falls back to cookie when URL has no locale prefix", () => {
    const r = mk("https://ex.com/page", {
      cookie: "locale=zh",
      "accept-language": "en-US",
    });
    expect(resolveLocale(r)).toBe("zh");
  });

  it("cookie is ignored when value isn't a supported locale", () => {
    const r = mk("https://ex.com/page", {
      cookie: "locale=fr",
      "accept-language": "en-US",
    });
    expect(resolveLocale(r)).toBe("en");
  });

  it("uses Accept-Language when no URL prefix or cookie is set", () => {
    const r = mk("https://ex.com/page", {
      "accept-language": "zh-CN,zh;q=0.9,en;q=0.5",
    });
    expect(resolveLocale(r)).toBe("zh");
  });

  it("falls through to DEFAULT_LOCALE when nothing matches", () => {
    const r = mk("https://ex.com/page", {
      "accept-language": "fr-FR,de;q=0.9",
    });
    expect(resolveLocale(r)).toBe("en");
  });

  it("handles missing Accept-Language header", () => {
    const r = mk("https://ex.com/");
    expect(resolveLocale(r)).toBe("en");
  });
});

describe("parseAcceptLanguage", () => {
  it("picks the highest-q supported entry", () => {
    expect(parseAcceptLanguage("en;q=0.8,zh;q=0.9")).toBe("zh");
  });

  it("treats missing q as q=1 (higher than explicit 0.9)", () => {
    expect(parseAcceptLanguage("zh,en;q=0.9")).toBe("zh");
  });

  it("falls back to primary subtag for regional tags", () => {
    expect(parseAcceptLanguage("zh-HK")).toBe("zh");
    expect(parseAcceptLanguage("en-GB")).toBe("en");
  });

  it("returns null when no supported language is present", () => {
    expect(parseAcceptLanguage("fr,de;q=0.5")).toBe(null);
  });
});

describe("t() interpolation", () => {
  const en = getMessages("en");

  it("looks up nested string keys", () => {
    expect(t(en, "common.signIn")).toBe("Sign in");
  });

  it("returns the key when the path does not resolve to a string", () => {
    // `common` resolves to an object, not a string → fallback is the key.
    expect(t(en, "common" as never)).toBe("common");
  });

  it("returns the key when the path is missing entirely", () => {
    expect(t(en, "common.bogus" as never)).toBe("common.bogus");
  });

  it("substitutes {var} placeholders", () => {
    const msg = t({ x: { y: "Hello, {name}!" } } as never, "x.y" as never, {
      name: "Ashley",
    });
    expect(msg).toBe("Hello, Ashley!");
  });

  it("leaves placeholders intact when no matching var is passed", () => {
    const msg = t({ x: { y: "Left {unknown} alone" } } as never, "x.y" as never, {
      other: "x",
    });
    expect(msg).toBe("Left {unknown} alone");
  });

  it("coerces numbers in vars", () => {
    const msg = t({ x: { y: "{n} items" } } as never, "x.y" as never, {
      n: 42,
    });
    expect(msg).toBe("42 items");
  });
});

describe("dirFor", () => {
  it("returns ltr for en and zh today", () => {
    expect(dirFor("en")).toBe("ltr");
    expect(dirFor("zh")).toBe("ltr");
  });

  // Stand-in test demonstrating what RTL support costs: zero code change
  // outside of adding the locale to LOCALES + RTL_LOCALES. Skipped because
  // adding "ar" to LOCALES at test time would need a rebuild of the union
  // type; left as a comment so future readers know the extension point.
  // expect(dirFor("ar" as Locale)).toBe("rtl"); // after RTL_LOCALES = ["ar"]
});

describe("URL prefix helpers", () => {
  it("withLocalePrefix: en keeps bare path", () => {
    expect(withLocalePrefix("en", "/page")).toBe("/page");
    expect(withLocalePrefix("en", "/")).toBe("/");
  });

  it("withLocalePrefix: zh prefixes /zh", () => {
    expect(withLocalePrefix("zh", "/page")).toBe("/zh/page");
    expect(withLocalePrefix("zh", "/")).toBe("/zh");
  });

  it("stripLocalePrefix: removes /zh prefix, leaves others alone", () => {
    expect(stripLocalePrefix("/zh/page")).toBe("/page");
    expect(stripLocalePrefix("/zh")).toBe("/");
    expect(stripLocalePrefix("/page")).toBe("/page");
  });
});
