import { notFound, redirect, type NavigateOptions } from "@tanstack/react-router";
import { DEFAULT_LOCALE, LOCALES, type Locale } from "./config";

// Helpers shared by every `{-$locale}/…` route file so the locale logic
// lives in one place and new routes inherit it for free.

// SEO canonical fallback: unknown / undefined / DEFAULT → emit canonical in
// the default locale (drives the bare-path URL). Side-effect free; safe to
// call from `head()` (which must not throw).
export function seoLocale(raw: string | undefined): Locale {
  if (raw && (LOCALES as readonly string[]).includes(raw)) {
    return raw as Locale;
  }
  return DEFAULT_LOCALE;
}

// `beforeLoad` guard for `{-$locale}` routes. Three responsibilities:
//   1. 404 unknown locales so typos don't render empty UI.
//   2. Strip the default locale from the URL (/en → /) — keeps canonical
//      URLs short and avoids Google indexing two paths for the same page.
//   3. When the URL is bare and the user's resolved preference is NOT the
//      default locale, redirect INTO their locale (/page → /zh/page
//      for a zh-cookie'd visitor). Keeps URL, SEO canonical, and UI
//      language aligned instead of showing Chinese UI on the English
//      canonical path.
//
// Caller supplies the typed redirect target because each route points at a
// different index (/, /page, …), and the resolved `preferredLocale`
// from the root context (URL > cookie > Accept-Language > default).
export function assertLocaleOrRedirect(
  raw: string | undefined,
  canonical: NavigateOptions,
  preferredLocale: Locale,
): void {
  if (raw === undefined) {
    if (preferredLocale !== DEFAULT_LOCALE) {
      throw redirect(withLocaleParam(canonical, preferredLocale));
    }
    return;
  }
  if (raw === DEFAULT_LOCALE) {
    // /en → redirect out; fold in a possible locale preference so we do
    // one redirect instead of two (/en → / → /zh).
    throw redirect(
      preferredLocale === DEFAULT_LOCALE
        ? canonical
        : withLocaleParam(canonical, preferredLocale),
    );
  }
  if (!(LOCALES as readonly string[]).includes(raw)) {
    throw notFound();
  }
}

function withLocaleParam(
  canonical: NavigateOptions,
  locale: Locale,
): NavigateOptions {
  // NavigateOptions.params is a generic union keyed off `to`; here we know
  // every caller passes a `{-$locale}` route whose params is a plain object
  // with an optional `locale` field. Overwrite just that field and return
  // the widened shape.
  const existing = (canonical.params ?? {}) as Record<string, unknown>;
  return {
    ...canonical,
    params: { ...existing, locale },
  } as NavigateOptions;
}
