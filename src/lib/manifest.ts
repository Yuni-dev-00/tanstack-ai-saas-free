// Dynamic PWA manifest served at /manifest.webmanifest by src/server.ts.
//
// Single source of truth for brand-related manifest fields — name, short_name,
// description, categories, theme_color, background_color. Consumed at the edge
// by the CF Worker, so changes ship without a public/ rebuild.
//
// [BRAND TODO] When the product name/palette is locked in, lift the brand
// constants out of here into src/lib/brand.ts and share them with the OAuth
// popup loading screen, navbar, and SEO meta (see CLAUDE.md).

export interface WebManifest {
  name: string;
  short_name: string;
  description?: string;
  start_url: string;
  scope: string;
  display: "standalone" | "fullscreen" | "minimal-ui" | "browser";
  theme_color: string;
  background_color: string;
  categories?: string[];
  lang?: string;
  icons: Array<{
    src: string;
    sizes: string;
    type: string;
    purpose?: "any" | "maskable" | "monochrome";
  }>;
}

export interface ManifestEnv {
  APP_URL?: string;
}

export function buildManifest(_env: ManifestEnv = {}): WebManifest {
  return {
    name: "TanStack Start",
    short_name: "TanStack",
    description:
      "Type-safe, client-first, full-stack React framework on Cloudflare Workers.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    // [BRAND TODO] replace with brand palette
    theme_color: "#000000",
    background_color: "#ffffff",
    categories: ["productivity", "developer"],
    lang: "zh-CN",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "64x64 32x32 24x24 16x16",
        type: "image/x-icon",
      },
      { src: "/logo192.png", sizes: "192x192", type: "image/png" },
      {
        src: "/logo512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}

export function manifestResponse(env: ManifestEnv = {}): Response {
  return Response.json(buildManifest(env), {
    status: 200,
    headers: {
      // Spec-registered MIME for Web App Manifest.
      "content-type": "application/manifest+json; charset=utf-8",
      // Short CDN cache; manifest is tiny and edits should propagate quickly.
      "cache-control": "public, max-age=300, stale-while-revalidate=3600",
    },
  });
}
