// Site-wide identity constants. Single source of truth for the production
// URL and display name so every surface — SEO meta, sitemap, robots,
// manifest, canonical links — stays consistent.
// [BRAND TODO] Migrate into src/lib/brand.ts when the product is named.

// [BRAND TODO] Set via APP_URL env in production. Fallback stays a safe placeholder.
export const SITE_URL = (typeof process !== "undefined" && process.env?.APP_URL) || "https://example.com";
export const SITE_NAME = "TanStack Start";
export const SITE_DESCRIPTION =
  "Type-safe, client-first, full-stack React framework on Cloudflare Workers.";
export const SITE_LOCALE = "zh-CN";

export function absoluteUrl(path: string, base: string = SITE_URL): string {
  return new URL(path, base).toString();
}
