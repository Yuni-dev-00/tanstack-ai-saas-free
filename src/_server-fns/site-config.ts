import { env } from "cloudflare:workers";
import { createServerFn } from "@tanstack/react-start";
import type { WorkerEnv } from "@/lib/env";
// Types and default live in a pure lib file so client-side hooks can
// import them without pulling in server-fn / cloudflare:workers code.
export type { PlausibleConfig, SiteConfig } from "@/lib/site-config-types";
export { DEFAULT_SITE_CONFIG } from "@/lib/site-config-types";
import type { SiteConfig } from "@/lib/site-config-types";

// Public bootstrap config — values the client needs at render time that
// can't be hard-coded (analytics domain, script SRI). Intentionally
// tiny and public-safe: none of these fields leak a secret. The server
// fn round-trip is cheap (no DB) and piggybacks on the locale lookup in
// __root's beforeLoad.

export const getSiteConfig = createServerFn({ method: "GET" })
  // Defence-in-depth: this fn ignores its input but TanStack Start would
  // still parse a body if one were sent. Reject anything non-empty.
  .inputValidator((raw: unknown) => {
    if (raw !== undefined && raw !== null) {
      throw new Error("getSiteConfig takes no input");
    }
    return undefined;
  })
  .handler(async (): Promise<SiteConfig> => {
    const e = env as WorkerEnv;
    const plausible =
      e.PLAUSIBLE_DOMAIN && e.PLAUSIBLE_SCRIPT_URL && e.PLAUSIBLE_SCRIPT_SRI
        ? {
            domain: e.PLAUSIBLE_DOMAIN,
            scriptUrl: e.PLAUSIBLE_SCRIPT_URL,
            sri: e.PLAUSIBLE_SCRIPT_SRI,
          }
        : null;

    const posthog =
      e.POSTHOG_KEY && e.POSTHOG_HOST
        ? { key: e.POSTHOG_KEY, host: e.POSTHOG_HOST }
        : null;

    return {
      plausible,
      turnstileSiteKey: e.TURNSTILE_SITE_KEY || null,
      googleClientId: e.GOOGLE_CLIENT_ID || null,
      anonymousEnabled: true,
      posthog,
      analytics: {
        googleAnalyticsId: e.GOOGLE_ANALYTICS_ID || null,
        clarityProjectId: e.CLARITY_PROJECT_ID || null,
        umamiScriptUrl: e.UMAMI_SCRIPT_URL || null,
        umamiWebsiteId: e.UMAMI_WEBSITE_ID || null,
        rybbitScriptUrl: e.RYBBIT_SCRIPT_URL || null,
        rybbitSiteId: e.RYBBIT_SITE_ID || null,
        rybbitSessionReplay: e.RYBBIT_SESSION_REPLAY || null,
        rybbitReplayMaskSelectors: e.RYBBIT_REPLAY_MASK_SELECTORS || null,
        googleAdsenseId: e.GOOGLE_ADSENSE_ID || null,
        crispWebsiteId: e.CRISP_WEBSITE_ID || null,
        vercelAnalyticsId: e.VERCEL_ANALYTICS_ID || null,
      },
      builtWithBadgeEnabled: e.BUILT_WITH_BADGE_ENABLED || null,
      builtWithBadgeUrl: e.BUILT_WITH_BADGE_URL || null,
    };
  });
