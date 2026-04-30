import * as React from "react";
import { useLocation, useRouter } from "@tanstack/react-router";
import { Languages, Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  LOCALES,
  LOCALE_LABELS,
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE_SEC,
  stripLocalePrefix,
  withLocalePrefix,
  type Locale,
} from "@/lib/i18n/config";

interface LanguageSwitcherProps {
  currentLocale: Locale;
  // Align dropdown to start (mobile menu) or end (desktop nav). Matches the
  // convention in ThemeToggle so both toggles sit flush with the nav edge.
  align?: "start" | "end";
  // Render-only variant for Sheet-menu use (no trigger — parent provides).
  variant?: "button" | "inline";
  className?: string;
}

// Dropdown in the top nav that lets the user switch between English and
// 中文. Writes the chosen locale to a cookie for server-side resolution on
// the next request and navigates to the locale-prefixed path so the SSR
// markup flips immediately (no client-only <html lang> drift).

export function LanguageSwitcher({
  currentLocale,
  align = "end",
  variant = "button",
  className,
}: LanguageSwitcherProps) {
  const router = useRouter();
  const location = useLocation();

  const onPick = React.useCallback(
    (locale: Locale) => {
      if (locale === currentLocale) return;
      // Write cookie so server-side resolver picks the same language on
      // every subsequent request, across tabs and after restart. The
      // modern Cookie Store API isn't yet universal (Safari < 17, partial
      // Workers support) so plain document.cookie is the pragmatic choice.
      if (typeof document !== "undefined") {
        // eslint-disable-next-line unicorn/no-document-cookie
        document.cookie = [
          `${LOCALE_COOKIE}=${encodeURIComponent(locale)}`,
          "path=/",
          `max-age=${LOCALE_COOKIE_MAX_AGE_SEC}`,
          "samesite=lax",
        ].join("; ");
      }
      const canonical = stripLocalePrefix(location.pathname);
      const next = withLocalePrefix(locale, canonical);
      router.navigate({ to: next });
    },
    [currentLocale, location.pathname, router],
  );

  const items = (
    <>
      {LOCALES.map((locale) => (
        <DropdownMenuItem
          key={locale}
          onClick={() => onPick(locale)}
          className="flex items-center justify-between gap-4"
        >
          <span>{LOCALE_LABELS[locale]}</span>
          {locale === currentLocale ? (
            <Check className="h-4 w-4 text-muted-foreground" aria-hidden />
          ) : null}
        </DropdownMenuItem>
      ))}
    </>
  );

  if (variant === "inline") {
    return <div className={className}>{items}</div>;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={className}
          aria-label="Change language"
        >
          <Languages className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="min-w-[140px]">
        {items}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
