import { useMemo } from "react";
import { type Locale } from "./config";
import { getMessages, t, type MessageKey, type Messages } from "./resolver";
import { useRootLocale } from "./use-root-locale";

// useT — pulls the resolved locale out of root route context, returns a
// bound t() that reads the matching message bundle. Always returns a
// valid bundle (useRootLocale falls back to DEFAULT_LOCALE) so template
// renders never throw.
export function useT(): {
  t: (key: MessageKey, vars?: Record<string, string | number>) => string;
  locale: Locale;
  messages: Messages;
} {
  const locale = useRootLocale();
  return useMemo(() => {
    const messages = getMessages(locale);
    return {
      t: (key, vars) => t(messages, key, vars),
      locale,
      messages,
    };
  }, [locale]);
}
