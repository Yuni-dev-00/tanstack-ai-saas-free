import { useParams } from "@tanstack/react-router";
import { LOCALES, type Locale } from "./config";

// Reads the optional `locale` URL param exposed by the `{-$locale}` route
// tree so navigation can preserve the user's language. Returns the matched
// Locale for /<locale>/... URLs, undefined for bare-path URLs (default
// locale canonical) and unknown values. Scales to any locale added to
// LOCALES with no code changes here.
export function useRouteLocale(): Locale | undefined {
  const params = useParams({ strict: false }) as { locale?: string };
  const raw = params.locale;
  if (raw && (LOCALES as readonly string[]).includes(raw)) {
    return raw as Locale;
  }
  return undefined;
}
