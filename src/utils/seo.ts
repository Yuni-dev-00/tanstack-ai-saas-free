import { SITE_NAME, SITE_URL } from "@/lib/site";
import {
  LOCALES,
  DEFAULT_LOCALE,
  withLocalePrefix,
  type Locale,
} from "@/lib/i18n/config";

// BCP-47 locale tags used in og:locale + hreflang. Our internal locale
// codes ("en", "zh") are short enough that most SEO tooling prefers a
// regional tag here. Keep this table narrow on purpose — adding a new
// locale = update LOCALES in i18n/config.ts AND add its tag here.
const BCP47: Record<Locale, string> = {
  en: "en_US",
  zh: "zh_CN",
};

// hreflang-shaped variant of BCP47 (dash, not underscore).
const HREFLANG: Record<Locale, string> = {
  en: "en",
  zh: "zh-CN",
};

export interface SeoImage {
  url: string;
  width?: number;
  height?: number;
  alt?: string;
}

export interface SeoOptions {
  title: string;
  description?: string;
  image?: string | SeoImage;
  // Canonical PATH (not full URL) for this page — used to derive both the
  // canonical href AND the hreflang alternate URLs (one per locale plus
  // x-default). Must NOT include a locale prefix; we add it per-locale
  // via withLocalePrefix().
  path?: string;
  // Active locale for this render. Drives og:locale and chooses which
  // hreflang entry is the canonical one.
  locale?: Locale;
  // Back-compat: some callers still pass a full canonical URL/path. When
  // provided, overrides path-based derivation (no hreflang is emitted,
  // since we can't know the canonical path under other locales).
  canonical?: string;
  noindex?: boolean;
  siteName?: string;
  twitterSite?: string;
  twitterCreator?: string;
  type?: "website" | "article" | "product";
  article?: {
    publishedTime?: string;
    modifiedTime?: string;
    author?: string;
    section?: string;
    tags?: string[];
  };
  themeColor?: string;
  jsonLd?: Array<{ "@context": "https://schema.org"; "@type": string; [k: string]: unknown }>;
}

type Meta = {
  title?: string;
  name?: string;
  property?: string;
  content?: string;
};
type Link = { rel: string; href: string; hrefLang?: string };
type Script = { type: "application/ld+json"; children: string };

export function seo(opts: SeoOptions): { meta: Meta[]; links: Link[]; scripts: Script[] } {
  const locale: Locale = opts.locale ?? DEFAULT_LOCALE;
  const siteName = opts.siteName ?? SITE_NAME;

  // Resolve canonical + alternates. Preference order:
  //   1. explicit `canonical` (back-compat; skips hreflang)
  //   2. derived from `path` + `locale` via withLocalePrefix (SEO-correct)
  //   3. none (no canonical emitted — rare, would flag in an SEO audit)
  let canonicalHref: string | undefined;
  const alternates: { locale: Locale; href: string }[] = [];
  if (opts.canonical) {
    canonicalHref = new URL(opts.canonical, SITE_URL).toString();
  } else if (opts.path) {
    const canonicalPath = withLocalePrefix(locale, opts.path);
    canonicalHref = new URL(canonicalPath, SITE_URL).toString();
    for (const loc of LOCALES) {
      const altPath = withLocalePrefix(loc, opts.path);
      alternates.push({
        locale: loc,
        href: new URL(altPath, SITE_URL).toString(),
      });
    }
  }

  const meta: Meta[] = [{ title: opts.title }];
  if (opts.description)
    meta.push({ name: "description", content: opts.description });

  // Always emit a robots meta tag — absent tag is equivalent to
  // "index, follow" per spec, but making intent explicit shuts up SEO
  // auditors and prevents accidental drift when someone copy-pastes a page.
  meta.push({
    name: "robots",
    content: opts.noindex ? "noindex, nofollow" : "index, follow",
  });

  if (opts.themeColor)
    meta.push({ name: "theme-color", content: opts.themeColor });

  // OpenGraph — spec requires `property=`, Google & Facebook both accept it.
  meta.push({ property: "og:type", content: opts.type ?? "website" });
  meta.push({ property: "og:title", content: opts.title });
  if (opts.description)
    meta.push({ property: "og:description", content: opts.description });
  if (canonicalHref) meta.push({ property: "og:url", content: canonicalHref });
  if (siteName) meta.push({ property: "og:site_name", content: siteName });

  // og:locale + og:locale:alternate — signals the primary language of THIS
  // page and the alternatives available. Search engines and social
  // cards (iMessage, WhatsApp) use these to pick the right preview.
  meta.push({ property: "og:locale", content: BCP47[locale] });
  if (alternates.length > 1) {
    for (const alt of alternates) {
      if (alt.locale === locale) continue;
      meta.push({
        property: "og:locale:alternate",
        content: BCP47[alt.locale],
      });
    }
  }

  meta.push({ name: "twitter:title", content: opts.title });
  if (opts.description)
    meta.push({ name: "twitter:description", content: opts.description });
  if (opts.twitterSite)
    meta.push({ name: "twitter:site", content: opts.twitterSite });
  if (opts.twitterCreator)
    meta.push({ name: "twitter:creator", content: opts.twitterCreator });

  if (opts.type === "article" && opts.article) {
    const a = opts.article;
    if (a.publishedTime) meta.push({ property: "article:published_time", content: a.publishedTime });
    if (a.modifiedTime) meta.push({ property: "article:modified_time", content: a.modifiedTime });
    if (a.author) meta.push({ property: "article:author", content: a.author });
    if (a.section) meta.push({ property: "article:section", content: a.section });
    if (a.tags) for (const tag of a.tags) meta.push({ property: "article:tag", content: tag });
  }

  const img: SeoImage | null = opts.image
    ? typeof opts.image === "string" ? { url: opts.image } : opts.image
    : null;
  if (img) {
    meta.push({ property: "og:image", content: img.url });
    if (img.width) meta.push({ property: "og:image:width", content: String(img.width) });
    if (img.height) meta.push({ property: "og:image:height", content: String(img.height) });
    if (img.alt) meta.push({ property: "og:image:alt", content: img.alt });
    meta.push({ name: "twitter:card", content: "summary_large_image" });
    meta.push({ name: "twitter:image", content: img.url });
    if (img.alt) meta.push({ name: "twitter:image:alt", content: img.alt });
  } else {
    meta.push({ name: "twitter:card", content: "summary" });
  }

  const links: Link[] = [];
  if (canonicalHref) links.push({ rel: "canonical", href: canonicalHref });

  // hreflang entries — one per locale plus x-default pointing at the
  // default locale's URL. Google ignores incomplete sets, so emitting
  // both real locales + x-default is required to be honoured.
  for (const alt of alternates) {
    links.push({
      rel: "alternate",
      href: alt.href,
      hrefLang: HREFLANG[alt.locale],
    });
  }
  if (alternates.length > 0) {
    const defaultAlt = alternates.find((a) => a.locale === DEFAULT_LOCALE);
    if (defaultAlt) {
      links.push({
        rel: "alternate",
        href: defaultAlt.href,
        hrefLang: "x-default",
      });
    }
  }

  const scripts: Script[] = (opts.jsonLd ?? []).map((obj) => ({
    type: "application/ld+json" as const,
    children: JSON.stringify(obj),
  }));

  return { meta, links, scripts };
}
