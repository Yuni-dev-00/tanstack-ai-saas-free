import { useRouteContext } from "@tanstack/react-router";
import { DEFAULT_LOCALE, LOCALES, type Locale } from "./config";

// Typed read of the locale resolved in `__root.beforeLoad` (URL > cookie >
// Accept-Language > DEFAULT). Falls back to DEFAULT_LOCALE on hydration
// gaps where the context hasn't propagated yet — template renders never
// throw.
//
// Child components should prefer this over `useRouteContext({ strict:
// false })` ad-hoc casts so the one ugly narrow lives in a single place.
export function useRootLocale(): Locale {
  const ctx = useRouteContext({ strict: false });
  const raw = (ctx as { locale?: unknown } | undefined)?.locale;
  if (
    typeof raw === "string" &&
    (LOCALES as readonly string[]).includes(raw)
  ) {
    return raw as Locale;
  }
  return DEFAULT_LOCALE;
}
