// Client-side tracking — first-touch attribution cookie + custom event
// emission to Plausible.
//
// First-touch model: the FIRST time a visitor lands on any page (no
// `_attr` cookie present), we capture the URL's UTM params, the
// document.referrer, and the landing path into a JSON cookie. Subsequent
// pageviews leave the cookie intact so the captured data reflects the
// original entry point even after the user clicks around.
//
// `track(name, props?)` is a thin wrapper around window.plausible that
//   - degrades silently if Plausible isn't loaded (env not configured,
//     ad-blocker, etc.) so analytics drops never break the app
//   - is typed against EventName so misspellings fail compilation

import type { EventName, EventProps, RevenueProps } from "./events";

const ATTR_COOKIE = "_attr";
const ATTR_TTL_DAYS = 90;

interface AttrPayload {
  firstTouchAt: string;
  landingPath?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
  referrer?: string;
  affCode?: string;
}

// Capture first-touch context and persist it as a cookie. No-op if the
// cookie already exists (the visitor's first-touch is sticky for the
// cookie's lifetime). Safe to call on every page load.
export function captureFirstTouch(): void {
  if (typeof document === "undefined") return;
  if (readCookie(ATTR_COOKIE) !== null) return;

  const url = new URL(window.location.href);
  const q = url.searchParams;

  // Tolt and other affiliate networks pass `?aff=`, `?ref=`, or
  // `?via=`. We capture whichever shows up first — the actual
  // attribution model is owned by Tolt's SDK; this snapshot exists for
  // server-side payout audit (see lib/tracking/server.ts saveUserSource).
  const affCode =
    q.get("aff") ?? q.get("ref") ?? q.get("via") ?? q.get("tolt_referral") ?? undefined;

  const payload: AttrPayload = {
    firstTouchAt: new Date().toISOString(),
    landingPath: url.pathname,
    utmSource: q.get("utm_source") ?? undefined,
    utmMedium: q.get("utm_medium") ?? undefined,
    utmCampaign: q.get("utm_campaign") ?? undefined,
    utmTerm: q.get("utm_term") ?? undefined,
    utmContent: q.get("utm_content") ?? undefined,
    referrer: document.referrer || undefined,
    affCode,
  };

  // Drop empty fields so the cookie payload stays small. Cookie size cap
  // is 4 KB total per domain; we want headroom for other cookies.
  const compact: Partial<AttrPayload> = {};
  for (const [k, v] of Object.entries(payload)) {
    if (v !== undefined && v !== null && v !== "") {
      (compact as Record<string, unknown>)[k] = v;
    }
  }

  setCookie(ATTR_COOKIE, JSON.stringify(compact), ATTR_TTL_DAYS);
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  for (const part of document.cookie.split(/;\s*/)) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq) === name) return decodeURIComponent(part.slice(eq + 1));
  }
  return null;
}

function setCookie(name: string, value: string, ttlDays: number): void {
  const expires = new Date(Date.now() + ttlDays * 86_400_000).toUTCString();
  // SameSite=Lax: cookie sent on top-level navigation (so the affiliate
  // landing flow works even when the source is an external link). Not
  // HttpOnly — we set + read this cookie from client JS only; the server
  // reads it once at signup time to copy values into user_sources.
  // The CookieStore API would be cleaner but it's not in Safari yet
  // (2026-04 still missing) and we need browser-wide reach for first-touch.
  // eslint-disable-next-line unicorn/no-document-cookie
  document.cookie = `${name}=${encodeURIComponent(value)};path=/;expires=${expires};SameSite=Lax`;
}

// Plausible is loaded as a global by `<script src="...">` in plausible-script.tsx.
// When PLAUSIBLE_* env vars are unset (dev / preview), the script never loads
// and `window.plausible` is undefined — track() becomes a no-op.
declare global {
  interface Window {
    plausible?: (
      eventName: string,
      options?: { props?: EventProps; revenue?: RevenueProps; callback?: () => void },
    ) => void;
  }
}

export function track(name: EventName, props?: EventProps, revenue?: RevenueProps): void {
  if (typeof window === "undefined") return;
  if (!window.plausible) return;
  // Strip undefined props before sending — Plausible rejects null/undefined.
  let cleaned: EventProps | undefined;
  if (props) {
    cleaned = {};
    for (const [k, v] of Object.entries(props)) {
      if (v !== undefined && v !== null) cleaned[k] = v;
    }
  }
  window.plausible(name, {
    props: cleaned,
    ...(revenue ? { revenue } : {}),
  });
}
