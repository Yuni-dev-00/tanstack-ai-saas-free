// Server-side Plausible event emission.
//
// Used from request handlers that don't have a browser to fire from —
// notably webhooks and scheduled cron jobs.
//
// Plausible's events API (https://plausible.io/docs/events-api):
//   POST {scriptOrigin}/api/event
//   body: { name, url, domain, props?, revenue? }
//   headers must forward the original visitor UA + IP so geolocation +
//   browser stats stay accurate. For server-fired events we forward the
//   originating webhook's headers when available; falling back to a
//   neutral UA marks the event as `direct/none` which is fine for
//   server-only events.
//
// All calls are fire-and-forget — analytics MUST NOT block business
// logic. We log + swallow on failure rather than throwing.

import { log, errorMessage } from "@/lib/log";
import type { EventName, EventProps, RevenueProps } from "./events";

export interface PlausibleServerEnv {
  // The Plausible domain identifier (matches what the client script's
  // data-domain attribute would use). REQUIRED — without this Plausible
  // can't bucket the event into a site.
  PLAUSIBLE_DOMAIN?: string;
  // The script URL also tells us the API host. e.g.
  // https://analytics.example.com/js/script.js → https://analytics.example.com
  PLAUSIBLE_SCRIPT_URL?: string;
  APP_URL?: string;
}

export interface ServerTrackArgs {
  // Originating request — used to forward UA/IP/Referer so events don't
  // appear as if they came from a Worker IP. Optional: cron / background
  // jobs may not have one.
  request?: Request;
  // The page URL to attribute the event to. Falls back to APP_URL root
  // if not provided.
  url?: string;
  props?: EventProps;
  revenue?: RevenueProps;
}

export async function serverTrack(
  env: PlausibleServerEnv,
  name: EventName,
  args: ServerTrackArgs = {},
): Promise<void> {
  if (!env.PLAUSIBLE_DOMAIN || !env.PLAUSIBLE_SCRIPT_URL) {
    // Analytics not configured — silently no-op. Same behaviour as the
    // client `track()` so dev/preview without Plausible stay clean.
    return;
  }

  let apiUrl: string;
  try {
    const u = new URL(env.PLAUSIBLE_SCRIPT_URL);
    apiUrl = `${u.origin}/api/event`;
  } catch {
    // new URL() threw — PLAUSIBLE_SCRIPT_URL is not a valid URL; log below handles it.
    log("warn", "tracking.plausible.bad_script_url", {
      scriptUrl: env.PLAUSIBLE_SCRIPT_URL,
    });
    return;
  }

  const eventUrl = args.url ?? env.APP_URL ?? "https://localhost/";
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (args.request) {
    const ua = args.request.headers.get("user-agent");
    const xff =
      args.request.headers.get("cf-connecting-ip") ??
      args.request.headers.get("x-forwarded-for");
    if (ua) headers["user-agent"] = ua;
    if (xff) headers["x-forwarded-for"] = xff;
  } else {
    // Identify the source so it doesn't get filtered as bot traffic.
    headers["user-agent"] = "tanstack-cf-test-server";
  }

  const cleanedProps: EventProps | undefined = args.props
    ? Object.fromEntries(
        Object.entries(args.props).filter(([, v]) => v !== undefined && v !== null),
      )
    : undefined;

  const body = JSON.stringify({
    name,
    url: eventUrl,
    domain: env.PLAUSIBLE_DOMAIN,
    ...(cleanedProps && Object.keys(cleanedProps).length > 0 ? { props: cleanedProps } : {}),
    ...(args.revenue ? { revenue: args.revenue } : {}),
  });

  try {
    // 3s timeout — Plausible should respond in <100ms; anything longer
    // means an outage and we don't want to hold up a webhook response.
    const res = await fetch(apiUrl, {
      method: "POST",
      headers,
      body,
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) {
      log("warn", "tracking.plausible.api_error", {
        event: name,
        status: res.status,
      });
    }
  } catch (err) {
    log("warn", "tracking.plausible.fetch_failed", {
      event: name,
      error: errorMessage(err),
    });
  }
}
