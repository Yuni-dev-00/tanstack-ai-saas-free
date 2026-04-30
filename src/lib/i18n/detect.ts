import { LOCALES, DEFAULT_LOCALE, type Locale } from "./config";

export function parseAcceptLanguage(header: string | null): Locale {
  if (!header) return DEFAULT_LOCALE;
  const parts = header.split(",").map((p) => {
    const [lang, q] = p.trim().split(";q=");
    return { lang: lang!.trim().slice(0, 2).toLowerCase(), q: q ? Number(q) : 1 };
  });
  parts.sort((a, b) => b.q - a.q);
  for (const { lang } of parts) {
    if ((LOCALES as readonly string[]).includes(lang)) return lang as Locale;
  }
  return DEFAULT_LOCALE;
}
