// Server-side attribution helpers.
//
// Two main exports:
//   - `parseAttributionCookie(value)` — decode the `_attr` first-touch cookie
//     set by the client (lib/tracking/client.ts) into a structured record
//   - `extractRequestContext(request)` — pull device / geo / language / ip
//     from CF Workers request headers + request.cf
//   - `saveUserSource(db, { userId, request, attribution })` — INSERT a
//     row into user_sources, idempotent (do nothing on conflict) so we
//     never double-record for a re-triggered signup hook
//
// User-Agent parsing intentionally avoids Bowser / ua-parser-js: those
// are 50–100KB and would inflate the Worker bundle. The regex below
// handles the four UA families the CF edge actually sees in real traffic
// (Chrome/Firefox/Safari/Edge × macOS/Windows/iOS/Android/Linux). It's
// not a full UA parser and doesn't try to be — anything unrecognised
// gets `browser: "Other"` / `os: "Other"`, which is honest data, not
// guessed garbage.

import type { DB } from "@/db/client";
import { userSources } from "@/db/schema";
import { extractClientIp } from "@/lib/rate-limit";
// Re-exported so existing callers (server-fns, tests) don't need path updates.
export { getRequestCookie } from "@/lib/cookies";

export interface AttributionCookie {
  firstTouchAt: string; // ISO timestamp
  landingPath?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
  referrer?: string;
  affCode?: string;
}

// JSON-encoded cookie. Returns null if cookie is missing / unparseable
// rather than throwing; bad cookies should degrade attribution to
// "unknown source", never break signup.
export function parseAttributionCookie(raw: string | null | undefined): AttributionCookie | null {
  if (!raw) return null;
  try {
    const decoded = JSON.parse(decodeURIComponent(raw)) as Partial<AttributionCookie>;
    if (!decoded || typeof decoded !== "object") return null;
    if (!decoded.firstTouchAt || typeof decoded.firstTouchAt !== "string") return null;
    return decoded as AttributionCookie;
  } catch {
    // JSON.parse of a corrupt or non-JSON attribution cookie — degrade to null, no attribution.
    return null;
  }
}

export const ATTRIBUTION_COOKIE_NAME = "_attr";

export interface RequestContext {
  ip: string;
  country: string | null;
  language: string | null;
  browser: string;
  os: string;
  deviceType: "desktop" | "mobile" | "tablet" | "bot";
}

// GDPR/CCPA-friendly IP masking before persisting to user_sources.
//   - IPv4: zero the last octet         (203.0.113.42  → 203.0.113.0)
//   - IPv6: keep the first 3 hextets,
//     compressed forms expanded first   (2001:db8::1   → 2001:db8:0::)
//   - "unknown" or malformed stays "unknown"
//
// The masked form preserves coarse ASN / city granularity (good enough
// for fraud heuristics + ops) but is no longer "personal data" under
// EU/UK/CA case law: an attacker with a DB dump cannot deanonymise an
// individual subscriber. If you ever need raw IP for a specific abuse
// investigation, log it short-lived to GlitchTip — never the long-lived
// user_sources table.
export function maskIp(ip: string): string {
  if (!ip || ip === "unknown") return "unknown";
  if (ip.includes(":")) {
    // IPv6. Expand the compressed `::` form before slicing — naive
    // split(":") on `2001:db8::1` returns ["2001","db8","","1"]
    // which would produce the malformed triple-colon `2001:db8:::`.
    const segments = expandIpv6(ip);
    if (!segments) return "unknown";
    return `${segments.slice(0, 3).join(":")}::`;
  }
  // IPv4 dotted-quad. Anything malformed → "unknown" rather than store
  // garbage that might still identify someone.
  const octets = ip.split(".");
  if (octets.length !== 4) return "unknown";
  return `${octets[0]}.${octets[1]}.${octets[2]}.0`;
}

// Returns the 8 normalised hextets of an IPv6 address, or null if the
// input isn't a parseable IPv6. We only handle the cases the CF edge
// emits (cf-connecting-ip is always a clean address); embedded IPv4
// suffixes like ::ffff:192.0.2.1 fall through to null and become
// "unknown" — better to drop than misclassify.
function expandIpv6(ip: string): string[] | null {
  if (!/^[0-9a-fA-F:]+$/.test(ip)) return null;
  const halves = ip.split("::");
  if (halves.length > 2) return null; // more than one `::` is invalid
  if (halves.length === 1) {
    const parts = halves[0]!.split(":");
    return parts.length === 8 ? parts : null;
  }
  const left = halves[0]!.length > 0 ? halves[0]!.split(":") : [];
  const right = halves[1]!.length > 0 ? halves[1]!.split(":") : [];
  const fill = 8 - left.length - right.length;
  if (fill < 0) return null;
  return [...left, ...Array.from({ length: fill }, () => "0"), ...right];
}

export function extractRequestContext(request: Request): RequestContext {
  const ua = request.headers.get("user-agent") ?? "";
  const lang = request.headers.get("accept-language");
  // CF populates request.cf at the edge with country, but in some local
  // dev / non-CF runtimes it's absent. Fall back to the cf-ipcountry
  // header which CF also sets for app workers.
  const cfCountry =
    (request as Request & { cf?: { country?: string } }).cf?.country ??
    request.headers.get("cf-ipcountry") ??
    null;
  return {
    ip: extractClientIp(request),
    country: cfCountry && cfCountry !== "XX" && cfCountry !== "T1" ? cfCountry : null,
    language: lang ? lang.split(",")[0]!.split("-")[0]!.toLowerCase() : null,
    ...parseUserAgent(ua),
  };
}

interface UaParseResult {
  browser: string;
  os: string;
  deviceType: "desktop" | "mobile" | "tablet" | "bot";
}

export function parseUserAgent(ua: string): UaParseResult {
  if (!ua) return { browser: "Other", os: "Other", deviceType: "desktop" };

  // Bot / crawler — check first because many crawlers spoof a desktop UA
  // tail but identify themselves up front.
  if (/bot|crawler|spider|slurp|crawling|preview|googlebot|bingbot/i.test(ua)) {
    return { browser: "Bot", os: "Bot", deviceType: "bot" };
  }

  // Browser. Order matters — Edge/Chromium share "Chrome" tokens, so
  // check Edge first; OPR ("Opera 15+") shares Chrome tokens too.
  let browser = "Other";
  if (/Edg\//.test(ua)) browser = "Edge";
  else if (/OPR\/|Opera/.test(ua)) browser = "Opera";
  else if (/Firefox\//.test(ua)) browser = "Firefox";
  else if (/Chrome\//.test(ua)) browser = "Chrome";
  else if (/Safari\//.test(ua)) browser = "Safari";

  // OS. iOS detected before macOS (Safari on iPad reports "Macintosh"
  // since iPadOS 13, so we lean on the Mobile/iPad token).
  let os = "Other";
  let deviceType: UaParseResult["deviceType"] = "desktop";
  if (/iPad/.test(ua) || (/Macintosh/.test(ua) && /Mobile/.test(ua))) {
    os = "iOS";
    deviceType = "tablet";
  } else if (/iPhone/.test(ua)) {
    os = "iOS";
    deviceType = "mobile";
  } else if (/Android/.test(ua)) {
    os = "Android";
    deviceType = /Mobile/.test(ua) ? "mobile" : "tablet";
  } else if (/Macintosh|Mac OS X/.test(ua)) {
    os = "macOS";
  } else if (/Windows/.test(ua)) {
    os = "Windows";
  } else if (/Linux/.test(ua)) {
    os = "Linux";
  }

  return { browser, os, deviceType };
}

export interface SaveUserSourceArgs {
  userId: string;
  attribution: AttributionCookie | null;
  context: RequestContext;
}

// Idempotent. If a source row already exists for this user (e.g.
// /auth/success was reloaded), we don't overwrite — first signup wins.
export async function saveUserSource(
  db: DB,
  args: SaveUserSourceArgs,
): Promise<{ inserted: boolean }> {
  const { userId, attribution, context } = args;

  const result = await db.insert(userSources).values({
    userId,
    firstTouchAt: attribution?.firstTouchAt ? new Date(attribution.firstTouchAt) : null,
    landingPath: attribution?.landingPath ?? null,
    utmSource: attribution?.utmSource ?? null,
    utmMedium: attribution?.utmMedium ?? null,
    utmCampaign: attribution?.utmCampaign ?? null,
    utmTerm: attribution?.utmTerm ?? null,
    utmContent: attribution?.utmContent ?? null,
    referrer: attribution?.referrer ?? null,
    affCode: attribution?.affCode ?? null,
    browser: context.browser,
    os: context.os,
    deviceType: context.deviceType,
    country: context.country,
    ip: maskIp(context.ip),
    language: context.language,
  }).onConflictDoNothing({ target: userSources.userId });
  return { inserted: (result.rowCount ?? 0) > 0 };
}
