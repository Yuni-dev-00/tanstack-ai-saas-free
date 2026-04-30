import { env } from "cloudflare:workers";
import { createServerFn } from "@tanstack/react-start";
import { assertSameOrigin } from "@/lib/security-headers";
import { log } from "@/lib/log";
import {
  ATTRIBUTION_COOKIE_NAME,
  extractRequestContext,
  getRequestCookie,
  parseAttributionCookie,
  saveUserSource,
} from "@/lib/tracking/server";
import { serverTrack } from "@/lib/tracking/plausible";
import { optionalAuthMiddleware } from "@/lib/middleware/auth";

// Called by client immediately after a successful sign-in / sign-up.
// Idempotent: if a user_sources row already exists, no-op (first-touch
// wins, repeat calls don't overwrite).
//
// Two side effects when a NEW row is inserted:
//   1. Snapshot UTM/referrer/aff/device/geo into user_sources
//   2. Fire `signup_completed` to Plausible from the server (so cron-job
//      / private-window users without JS analytics still get counted)
//
// Triggered from THREE places, all of which call this fn fire-and-forget:
//   - sign-in-dialog email-signup `handleEmail` onSuccess
//   - sign-in-dialog Google BroadcastChannel onSignedIn handler
//   - /auth/success route effect (Google popup landing)
// Calling it from multiple places is safe by design; idempotency is in
// the SQL (existing row check).

export const recordSignupSource = createServerFn({ method: "POST" })
  .middleware([optionalAuthMiddleware])
  .inputValidator((raw: unknown) => {
    if (raw !== undefined && raw !== null) {
      throw new Error("recordSignupSource takes no input");
    }
    return undefined;
  })
  .handler(async ({ context }) => {
    const { db, user, request, appUrl } = context;
    assertSameOrigin(request, appUrl);

    if (!user) {
      // Anonymous caller — nothing to record. Don't 401, just return
      // gracefully so the client's fire-and-forget doesn't surface as
      // an error in the console.
      return { inserted: false, reason: "no session" as const };
    }

    const attributionRaw = getRequestCookie(request, ATTRIBUTION_COOKIE_NAME);
    const attribution = parseAttributionCookie(attributionRaw);
    const ctx = extractRequestContext(request);

    const { inserted } = await saveUserSource(db, {
      userId: user.id,
      attribution,
      context: ctx,
    });

    if (inserted) {
      log("info", "tracking.user_source.inserted", {
        userId: user.id,
        utmSource: attribution?.utmSource ?? null,
        affCode: attribution?.affCode ?? null,
        country: ctx.country,
        deviceType: ctx.deviceType,
      });

      // Fire signup_completed server-side. This is the canonical event
      // (vs the optional client-side `signup_started` which only fires
      // for users with JS + analytics enabled).
      const e = env as {
        PLAUSIBLE_DOMAIN?: string;
        PLAUSIBLE_SCRIPT_URL?: string;
        APP_URL?: string;
      };
      await serverTrack(e, "signup_completed", {
        request,
        url: appUrl,
        props: {
          utm_source: attribution?.utmSource ?? "direct",
          aff_code: attribution?.affCode ?? null,
          country: ctx.country ?? "unknown",
          device_type: ctx.deviceType,
        },
      });
    }

    return { inserted };
  });
