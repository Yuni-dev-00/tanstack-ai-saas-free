/// <reference types="vite/client" />
import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRouteWithContext,
  useRouteContext,
} from "@tanstack/react-router";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { ThemeCustomizer } from "@/components/dev/theme-customizer";
import * as React from "react";

import type { QueryClient } from "@tanstack/react-query";
import { DefaultCatchBoundary } from "@/components/default-catch-boundary";
import { NotFound } from "@/components/not-found";
import { ThemeProvider } from "@/components/theme";
import appCss from "@/styles.css?url";
import { seo } from "@/utils/seo";
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";
import { getLocale } from "@/_server-fns/locale";
import {
  getSiteConfig,
  DEFAULT_SITE_CONFIG,
  type SiteConfig,
} from "@/_server-fns/site-config";
import { useSiteConfig } from "@/lib/hooks/use-site-config";
import { DEFAULT_LOCALE, dirFor, type Locale } from "@/lib/i18n/config";
import { PlausibleScript } from "@/components/monitoring/plausible-script";
import { ToltScript } from "@/components/monitoring/tolt-script";
import { PosthogScript } from "@/components/monitoring/posthog-script";
import { OneTapPrompt } from "@/components/auth/one-tap-prompt";
import { CookieConsent } from "@/components/shared/cookie-consent";
import { LanguageDetectionAlert } from "@/components/shared/language-detection-alert";
import { GoogleAnalytics } from "@/components/monitoring/google-analytics";
import { Clarity } from "@/components/monitoring/clarity";
import { Umami } from "@/components/monitoring/umami";
import { Rybbit } from "@/components/monitoring/rybbit";
import { GoogleAdSense } from "@/components/monitoring/google-adsense";
import { Crisp } from "@/components/monitoring/crisp";
import { VercelAnalytics } from "@/components/monitoring/vercel-analytics";
import { BuiltWithBadge } from "@/components/shared/built-with-badge";
import { useSession } from "@/hooks/use-session";
import { captureFirstTouch } from "@/lib/tracking/client";
import { organizationJsonLd, websiteJsonLd } from "@/lib/seo/jsonld";

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
}>()({
  // Resolve locale once on the server at the top of the render tree so
  // every descendant gets it via useRouteContext() and SSR emits the
  // correct <html lang> on first paint. Client navigations re-run this
  // via the server fn round-trip, which is cheap (no DB hit).
  beforeLoad: async (): Promise<{
    locale: Locale;
    siteConfig: SiteConfig;
  }> => {
    // Both server fns are cheap (no DB). Parallelising avoids an extra
    // 20-40ms of waterfall on cold starts.
    try {
      const [locale, siteConfig] = await Promise.all([
        getLocale(),
        getSiteConfig(),
      ]);
      return { locale, siteConfig };
    } catch {
      // Never let bootstrap resolution fail a page load — fall through
      // to sensible defaults so the HTML still renders. Analytics and
      // lang will pick up on the next navigation once the worker is warm.
      return {
        locale: DEFAULT_LOCALE,
        siteConfig: DEFAULT_SITE_CONFIG,
      };
    }
  },
  head: () => {
    // Root-level defaults only. Canonical + hreflang deliberately NOT
    // emitted here — the leaf route owns them because the leaf is the
    // only code that knows the canonical path. Emitting them in __root
    // based on cookie-driven `locale` would point canonical="/" at "/zh"
    // for a zh-cookie'd visitor, which is wrong: canonical tracks the
    // URL, not the runtime UI language.
    const s = seo({
      title: `${SITE_NAME} | Type-Safe, Client-First, Full-Stack React Framework`,
      description: SITE_DESCRIPTION,
    });
    // Site-wide JSON-LD emitted once from the root so search engines can
    // resolve the Organization + WebSite entities and attribute per-page
    // entities (Offer, Product, Article) to them. Head-scoped rather than
    // body-rendered to keep crawler parsing order deterministic.
    const siteEntities = [organizationJsonLd(), websiteJsonLd()];
    return {
      meta: [
        // HTML5 spec value for `<meta charset>` is literally "UTF-8";
        // unicorn's canonical "utf8" form is for APIs like TextEncoder.
        // eslint-disable-next-line unicorn/text-encoding-identifier-case
        { charSet: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        ...s.meta,
      ],
      links: [
        ...s.links,
        { rel: "stylesheet", href: appCss },
        {
          rel: "apple-touch-icon",
          sizes: "180x180",
          href: "/apple-touch-icon.png",
        },
        {
          rel: "icon",
          type: "image/png",
          sizes: "32x32",
          href: "/favicon-32x32.png",
        },
        {
          rel: "icon",
          type: "image/png",
          sizes: "16x16",
          href: "/favicon-16x16.png",
        },
        { rel: "manifest", href: "/manifest.webmanifest" },
        { rel: "icon", href: "/favicon.ico" },
      ],
      scripts: siteEntities.map((entry) => ({
        type: "application/ld+json",
        children: JSON.stringify(entry),
      })),
    };
  },
  errorComponent: (props) => {
    return (
      <RootDocument>
        <DefaultCatchBoundary {...props} />
      </RootDocument>
    );
  },
  notFoundComponent: () => <NotFound />,
  component: RootComponent,
});

function RootComponent() {
  return (
    <RootDocument>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange={false}
      >
        <Outlet />
      </ThemeProvider>
    </RootDocument>
  );
}

function RootDocument({ children }: { children: React.ReactNode }) {
  // Locale is still on routeContext (not part of siteConfig); read it
  // separately. siteConfig now goes through the typed hook so the cast
  // lives in exactly one place (lib/hooks/use-site-config.ts).
  const localeCtx = useRouteContext({ strict: false }) as
    | { locale?: Locale }
    | undefined;
  const locale = localeCtx?.locale ?? DEFAULT_LOCALE;
  const siteConfig = useSiteConfig();
  const { plausible, toltProgramId, posthog, googleClientId, analytics, builtWithBadgeEnabled, builtWithBadgeUrl } = siteConfig;
  // useSession is reactive — when sign-in-dialog completes, the
  // returned `data` flips from null to a session object and OneTap
  // stops prompting. We only need the user id for PostHog.identify.
  //
  // isPending gate: the first render returns { data: null, isPending:
  // true } while BetterAuth fetches /api/auth/get-session. Without
  // this gate OneTap fires on load, reads userId=null, calls prompt(),
  // and by the time session resolves the Google UI is already on screen.
  const { data: sessionData, isPending: sessionPending } = useSession();
  const userId = sessionData?.user?.id ?? null;

  // First-touch attribution snapshot. Runs once per browser per 90 days
  // (cookie TTL) — captureFirstTouch no-ops if `_attr` already exists.
  // Invoked on EVERY route mount (including client navigations) so we
  // capture the original UTM + referrer source even if the visitor lands
  // on a deep link first.
  React.useEffect(() => {
    captureFirstTouch();
  }, []);

  return (
    // suppressHydrationWarning on <html>/<body>: next-themes flips the
    // `class` attribute on <html> before React hydrates, and browser
    // extensions (Immersive Translate, Grammarly, etc.) mutate top-level
    // tags — both produce expected, harmless mismatch warnings.
    <html lang={locale} dir={dirFor(locale)} suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body suppressHydrationWarning>
        {children}
        {plausible && <PlausibleScript config={plausible} />}
        {toltProgramId && <ToltScript programId={toltProgramId} />}
        {posthog && <PosthogScript config={posthog} userId={userId} />}
        {!sessionPending && googleClientId && (
          <OneTapPrompt
            googleClientId={googleClientId}
            isAuthenticated={userId !== null}
          />
        )}
        <CookieConsent />
        <LanguageDetectionAlert />
        {analytics.googleAnalyticsId && <GoogleAnalytics id={analytics.googleAnalyticsId} />}
        {analytics.clarityProjectId && <Clarity projectId={analytics.clarityProjectId} />}
        {analytics.umamiScriptUrl && analytics.umamiWebsiteId && <Umami scriptUrl={analytics.umamiScriptUrl} websiteId={analytics.umamiWebsiteId} />}
        {analytics.rybbitScriptUrl && analytics.rybbitSiteId && <Rybbit scriptUrl={analytics.rybbitScriptUrl} siteId={analytics.rybbitSiteId} sessionReplay={analytics.rybbitSessionReplay ?? undefined} maskSelectors={analytics.rybbitReplayMaskSelectors ?? undefined} />}
        {analytics.googleAdsenseId && <GoogleAdSense id={analytics.googleAdsenseId} />}
        {analytics.crispWebsiteId && <Crisp websiteId={analytics.crispWebsiteId} />}
        {analytics.vercelAnalyticsId && <VercelAnalytics id={analytics.vercelAnalyticsId} />}
        {builtWithBadgeEnabled && <BuiltWithBadge enabled={builtWithBadgeEnabled} url={builtWithBadgeUrl ?? undefined} />}
        {/* Devtools only rendered in dev — keeps prod HTML + bundle clean. */}
        {import.meta.env.DEV ? (
          <>
            <TanStackRouterDevtools position="bottom-right" />
            <ReactQueryDevtools buttonPosition="bottom-right" />
            <ThemeCustomizer />
          </>
        ) : null}
        <Scripts />
      </body>
    </html>
  );
}
