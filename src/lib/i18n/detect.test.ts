import { describe, it, expect } from "vitest";
import { parseAcceptLanguage } from "./detect";

describe("parseAcceptLanguage", () => {
  it("returns default for null", () => {
    expect(parseAcceptLanguage(null)).toBe("en");
  });
  it("picks the highest priority supported locale", () => {
    expect(parseAcceptLanguage("zh-CN,zh;q=0.9,en;q=0.8")).toBe("zh");
  });
  it("falls back to default for unsupported locales", () => {
    expect(parseAcceptLanguage("fr-FR,de;q=0.9")).toBe("en");
  });
  it("handles simple headers", () => {
    expect(parseAcceptLanguage("en-US")).toBe("en");
  });
});
