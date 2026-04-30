// Pure type + constant file — no server-fn code, no env access.
// Shared between src/_server-fns/site-config.ts (which builds the value)
// and src/lib/hooks/use-site-config.ts (which reads it on the client).

export interface PlausibleConfig {
  domain: string;
  scriptUrl: string;
  sri: string;
}

export interface SiteConfig {
  plausible: PlausibleConfig | null;
  // Cloudflare Turnstile site key. Public (it's literally rendered in
  // the widget HTML). Null when Turnstile isn't configured — UI then
  // skips the captcha widget entirely.
  turnstileSiteKey: string | null;
  // Google OAuth client id needed by Google One Tap on the client. The
  // CLIENT id is public-safe; the secret stays server-only. Null when
  // Google OAuth itself isn't configured.
  googleClientId: string | null;
  // Whether anonymous sign-in is enabled.
  anonymousEnabled: boolean;
  // PostHog client SDK config. Both fields required to load.
  posthog: { key: string; host: string } | null;
  analytics: {
    googleAnalyticsId: string | null;
    clarityProjectId: string | null;
    umamiScriptUrl: string | null;
    umamiWebsiteId: string | null;
    rybbitScriptUrl: string | null;
    rybbitSiteId: string | null;
    rybbitSessionReplay: string | null;
    rybbitReplayMaskSelectors: string | null;
    googleAdsenseId: string | null;
    crispWebsiteId: string | null;
    vercelAnalyticsId: string | null;
  };
  builtWithBadgeEnabled: string | null;
  builtWithBadgeUrl: string | null;
}

// All-null/false fallback. Used by `useSiteConfig()` when the route
// context isn't populated (e.g. error boundary mid-bootstrap), and by
// `__root.tsx`'s beforeLoad catch block. Annotating as SiteConfig means
// the compiler errors here when a new field is added to the interface,
// preventing the "silent undefined" hazard the reviewer flagged.
export const DEFAULT_SITE_CONFIG: SiteConfig = {
  plausible: null,
  turnstileSiteKey: null,
  googleClientId: null,
  anonymousEnabled: false,
  posthog: null,
  analytics: {
    googleAnalyticsId: null,
    clarityProjectId: null,
    umamiScriptUrl: null,
    umamiWebsiteId: null,
    rybbitScriptUrl: null,
    rybbitSiteId: null,
    rybbitSessionReplay: null,
    rybbitReplayMaskSelectors: null,
    googleAdsenseId: null,
    crispWebsiteId: null,
    vercelAnalyticsId: null,
  },
  builtWithBadgeEnabled: null,
  builtWithBadgeUrl: null,
};
