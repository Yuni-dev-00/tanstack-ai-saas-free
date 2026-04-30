// Locale configuration. Single source of truth for which languages exist,
// the default, and the direction (LTR vs RTL).
//
// Adding a new locale later = add it to LOCALES + drop in the matching
// messages JSON. If it's RTL (Arabic, Hebrew, Persian), also add it to
// RTL_LOCALES so `dirFor()` flips — no other code changes needed.

export const LOCALES = ["en", "zh"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

// Native display name per locale — used in the language switcher so users
// can recognize their language before they know the interface.
export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  zh: "中文",
};

// Extension point: add RTL locales (e.g., "ar", "he") here when added to
// LOCALES. dirFor() and the `<html dir>` attribute will flip automatically.
export const RTL_LOCALES: readonly Locale[] = [] as const;

export function dirFor(locale: Locale): "ltr" | "rtl" {
  return (RTL_LOCALES as readonly string[]).includes(locale) ? "rtl" : "ltr";
}

// Cookie + URL conventions. Keeping the names here (not hard-coded
// throughout the app) makes it trivial to rename the cookie later
// without grepping the whole codebase.
export const LOCALE_COOKIE = "locale";
// Max age 1 year. Keeps the user's choice sticky across sessions without
// pinning them forever if their preference changes.
export const LOCALE_COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 365;

// `/zh`, `/zh/page`, etc. English is served at the bare path, not /en,
// to keep the canonical URL short for the primary audience.
export function isLocalePrefixed(pathname: string): Locale | null {
  const seg = pathname.split("/")[1] ?? "";
  for (const locale of LOCALES) {
    if (locale === DEFAULT_LOCALE) continue;
    if (seg === locale) return locale;
  }
  return null;
}

// Strip the locale prefix from a pathname so we can build a parallel URL
// in the other locale. `/zh/page` → `/page`; `/page` → `/page`.
export function stripLocalePrefix(pathname: string): string {
  const locale = isLocalePrefixed(pathname);
  if (!locale) return pathname;
  const rest = pathname.slice(`/${locale}`.length);
  return rest === "" ? "/" : rest;
}

// Compose a URL for a target locale from a canonical (unprefixed) path.
// English gets the bare path; other locales get /<code>/... .
export function withLocalePrefix(locale: Locale, pathname: string): string {
  const base = pathname.startsWith("/") ? pathname : `/${pathname}`;
  if (locale === DEFAULT_LOCALE) return base;
  if (base === "/") return `/${locale}`;
  return `/${locale}${base}`;
}
