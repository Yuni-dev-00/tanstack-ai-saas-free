import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { resolveLocale } from "@/lib/i18n/resolver";
import type { Locale } from "@/lib/i18n/config";

// Server fn invoked from the root route's `beforeLoad` so the resolved
// locale reaches the client as part of route context — no client flicker
// between SSR default and real locale.

export const getLocale = createServerFn({ method: "GET" })
  // Defence-in-depth: this fn ignores its input but TanStack Start would
  // still parse a body if one were sent. Reject anything non-empty.
  .inputValidator((raw: unknown) => {
    if (raw !== undefined && raw !== null) {
      throw new Error("getLocale takes no input");
    }
    return undefined;
  })
  .handler(async (): Promise<Locale> => {
    const request = getRequest();
    return resolveLocale(request);
  });
