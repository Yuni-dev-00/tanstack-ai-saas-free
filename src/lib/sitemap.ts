import { SITE_URL } from "@/lib/site";
import {
  LOCALES,
  DEFAULT_LOCALE,
  withLocalePrefix,
  type Locale,
} from "@/lib/i18n/config";

// Sitemap: enumerates public pages × every supported locale, with
// xhtml:link alternates so Google treats locale variants of the same
// resource as one page in two languages. Rewrites here must stay in sync
// with the routes served under each locale (see /zh/* route shims).

interface SitemapEntry {
  // Canonical PATH (no locale prefix). We emit one <url> element per
  // locale permutation and cross-link them via xhtml:link alternates.
  path: string;
  lastmod?: string;
  changefreq?:
    | "always"
    | "hourly"
    | "daily"
    | "weekly"
    | "monthly"
    | "yearly"
    | "never";
  priority?: number;
}

function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

const HREFLANG: Record<Locale, string> = {
  en: "en",
  zh: "zh-CN",
};

export function buildSitemapXml(entries: SitemapEntry[]): string {
  const urls: string[] = [];
  for (const entry of entries) {
    for (const locale of LOCALES) {
      const loc = escape(
        new URL(withLocalePrefix(locale, entry.path), SITE_URL).toString(),
      );
      const parts = [`  <url>`, `    <loc>${loc}</loc>`];
      if (entry.lastmod)
        parts.push(`    <lastmod>${escape(entry.lastmod)}</lastmod>`);
      if (entry.changefreq)
        parts.push(`    <changefreq>${entry.changefreq}</changefreq>`);
      if (entry.priority != null)
        parts.push(`    <priority>${entry.priority.toFixed(1)}</priority>`);
      // xhtml:link alternates — one per locale + an x-default pointing
      // at the DEFAULT_LOCALE URL. Google treats this as the canonical
      // cluster for the page.
      for (const alt of LOCALES) {
        const altUrl = escape(
          new URL(withLocalePrefix(alt, entry.path), SITE_URL).toString(),
        );
        parts.push(
          `    <xhtml:link rel="alternate" hreflang="${HREFLANG[alt]}" href="${altUrl}" />`,
        );
      }
      const defaultUrl = escape(
        new URL(
          withLocalePrefix(DEFAULT_LOCALE, entry.path),
          SITE_URL,
        ).toString(),
      );
      parts.push(
        `    <xhtml:link rel="alternate" hreflang="x-default" href="${defaultUrl}" />`,
      );
      parts.push(`  </url>`);
      urls.push(parts.join("\n"));
    }
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join("\n")}\n</urlset>\n`;
}

export function sitemapResponse(): Response {
  // [SEO TODO] Register new public-facing routes here as they're added.
  // Don't include /sign-in, /sign-up, /auth/success — they're noindex.
  const xml = buildSitemapXml([
    { path: "/", changefreq: "weekly", priority: 1 },
    { path: "/privacy-policy", changefreq: "yearly", priority: 0.4 },
    { path: "/terms-of-service", changefreq: "yearly", priority: 0.4 },
  ]);
  return new Response(xml, {
    status: 200,
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, max-age=300, stale-while-revalidate=3600",
    },
  });
}
