import { useRouteContext } from "@tanstack/react-router";
import type { SiteConfig } from "@/lib/site-config-types";
import { DEFAULT_SITE_CONFIG } from "@/lib/site-config-types";

// Typed accessor for the site-wide bootstrap config. Replaces the
// `useRouteContext({ strict: false }) as unknown as { siteConfig?: SiteConfig }`
// cast that was being copy-pasted across the footer, sign-in-dialog,
// __root, etc. Centralising means the cast lives in exactly one place
// and `DEFAULT_SITE_CONFIG` (in site-config.ts, typed against the
// canonical interface) is the only fallback definition the compiler
// needs to police.
export function useSiteConfig(): SiteConfig {
  const ctx = useRouteContext({ strict: false }) as
    | { siteConfig?: SiteConfig }
    | undefined;
  return ctx?.siteConfig ?? DEFAULT_SITE_CONFIG;
}
