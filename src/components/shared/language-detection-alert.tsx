import * as React from "react";
import { useRouteContext } from "@tanstack/react-router";
import { DEFAULT_LOCALE, LOCALES, type Locale } from "@/lib/i18n/config";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/useT";

const DISMISSED_KEY = "lang-detect-dismissed";

export function LanguageDetectionAlert() {
  const { messages, t } = useT();
  const ld = messages.Landing?.LanguageDetection;
  const ctx = useRouteContext({ strict: false }) as { locale?: Locale } | undefined;
  const currentLocale = ctx?.locale ?? DEFAULT_LOCALE;
  const [browserLocale, setBrowserLocale] = React.useState<string | null>(null);
  const [dismissed, setDismissed] = React.useState(true);

  React.useEffect(() => {
    if (localStorage.getItem(DISMISSED_KEY)) return;
    const lang = navigator.language?.slice(0, 2);
    if (lang && lang !== currentLocale && (LOCALES as readonly string[]).includes(lang)) {
      setBrowserLocale(lang);
      setDismissed(false);
    }
  }, [currentLocale]);

  if (dismissed || !browserLocale) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, "1");
    setDismissed(true);
  };

  return (
    <div className="fixed top-16 left-1/2 z-40 -translate-x-1/2 rounded-lg border bg-background px-4 py-3 shadow-lg">
      <div className="flex items-center gap-3">
        <p className="text-sm">
          {t("Landing.LanguageDetection.switchToLocale", { locale: browserLocale.toUpperCase() })}
        </p>
        <Button size="sm" asChild>
          <a href={`/${browserLocale}`}>{ld?.switch ?? "Switch"}</a>
        </Button>
        <Button size="sm" variant="ghost" onClick={dismiss}>
          {ld?.dismiss ?? "Dismiss"}
        </Button>
      </div>
    </div>
  );
}
