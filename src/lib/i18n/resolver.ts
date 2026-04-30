import { parseCookieHeader } from "@/lib/cookies";
import {
  DEFAULT_LOCALE,
  LOCALES,
  LOCALE_COOKIE,
  isLocalePrefixed,
  type Locale,
} from "./config";
import en from "./messages/en.json";
import zh from "./messages/zh.json";

// Resolver — figures out the active locale for a request.
// Priority: URL prefix > cookie > Accept-Language > DEFAULT_LOCALE.
// URL prefix wins because it's the most explicit signal (a user who
// pasted a /zh link wants Chinese, regardless of their cookie).
//
// All Request fields used here (cookies, Accept-Language) are parsed
// manually instead of pulling in a 200KB header-parsing lib. CF Workers
// cold-start cost matters.

export function resolveLocale(request: Request): Locale {
  const url = new URL(request.url);
  const fromUrl = isLocalePrefixed(url.pathname);
  if (fromUrl) return fromUrl;

  const cookie = parseCookieHeader(request.headers.get("cookie"), LOCALE_COOKIE);
  if (cookie && isSupported(cookie)) return cookie;

  const accept = request.headers.get("accept-language");
  if (accept) {
    const preferred = parseAcceptLanguage(accept);
    if (preferred) return preferred;
  }

  return DEFAULT_LOCALE;
}

// Accept-Language: "zh-CN,zh;q=0.9,en;q=0.8". Walks the q-ranked list,
// returns the first supported locale match or null if none matches.
// Matching is prefix-based: "zh-CN" matches our "zh", "en-US" matches "en".
export function parseAcceptLanguage(header: string): Locale | null {
  const entries = header
    .split(",")
    .map((raw): { tag: string; q: number } => {
      const [tag, ...params] = raw.trim().split(";");
      let q = 1;
      for (const p of params) {
        const m = p.trim().match(/^q=(\d+(?:\.\d+)?)$/);
        if (m) q = Number.parseFloat(m[1]!);
      }
      return { tag: (tag ?? "").toLowerCase(), q };
    })
    .filter((e) => e.tag.length > 0)
    .sort((a, b) => b.q - a.q);

  for (const entry of entries) {
    // Exact match first: "zh" → zh, "en" → en.
    if (isSupported(entry.tag)) return entry.tag;
    // Language subtag: "zh-CN" → "zh", "en-US" → "en".
    const primary = entry.tag.split("-")[0] ?? "";
    if (isSupported(primary)) return primary;
  }
  return null;
}

function isSupported(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

// Message bundle access. Each locale's JSON shape is identical so we
// type the lookup with en's inferred type — catches dead keys in zh at
// compile time via t()'s key parameter.

export type Messages = typeof en;
export type MessageKey = DeepKeys<Messages>;

type DeepKeys<T, Prefix extends string = ""> = {
  [K in keyof T & string]: T[K] extends string
    ? `${Prefix}${K}`
    : T[K] extends object
      ? DeepKeys<T[K], `${Prefix}${K}.`>
      : never;
}[keyof T & string];

const BUNDLES: Record<Locale, Messages> = {
  en,
  zh: zh as Messages,
};

export function getMessages(locale: Locale): Messages {
  return BUNDLES[locale];
}

// t() — flat-key message lookup with {var} interpolation. Returns the key
// as a visible fallback when missing, so misses surface in QA rather than
// as silent empty strings.
//
// Interpolation is intentionally tiny — no pluralization, no genders, no
// dates. Templates that need any of that can format in the caller before
// handing the string to t(). The whole helper is <40 lines; a future
// phase can swap for ICU if the use case emerges.
export function t(
  messages: Messages,
  key: MessageKey,
  vars?: Record<string, string | number>,
): string {
  const raw = resolveKey(messages, key);
  if (raw === null) return key;
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (match, name: string) => {
    if (Object.prototype.hasOwnProperty.call(vars, name)) {
      return String(vars[name]);
    }
    return match;
  });
}

function resolveKey(messages: Messages, key: string): string | null {
  let cur: unknown = messages;
  for (const part of key.split(".")) {
    if (cur && typeof cur === "object" && part in (cur as object)) {
      cur = (cur as Record<string, unknown>)[part];
    } else {
      return null;
    }
  }
  return typeof cur === "string" ? cur : null;
}
