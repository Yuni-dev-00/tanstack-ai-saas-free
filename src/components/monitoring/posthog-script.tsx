import * as React from "react";
import { loadScriptOnce } from "@/lib/dom/load-script";

// PostHog client SDK loader. Renders nothing in the DOM — the SDK
// installs an event handler on window. Coexists with Plausible:
//   - Plausible: lightweight pageviews, EU-friendly, our primary
//     dashboard for traffic + conversion counts.
//   - PostHog: funnels, session replay, deeper behavioural analysis.
// They listen to different events (Plausible to our `track()` shim;
// PostHog to autocapture + manual `posthog.capture(...)` if added).
//
// Loaded lazily via <script src> rather than `pnpm add posthog-js` so
// products that never set POSTHOG_KEY don't pay the ~50KB bundle cost.
//
// Two SEPARATE effects for clarity / correctness:
//   1. Load + init — runs once per `config`. Uses `loadScriptOnce` and
//      flips `readyTick` when init completes so the identify effect
//      knows the SDK is callable.
//   2. Identify — runs whenever `userId` or `readyTick` changes. Calls
//      posthog.identify(userId) if both the SDK is loaded AND a user
//      is signed in. Calls posthog.reset() on sign-out so events from
//      the next browser session aren't tied to the previous user.
//
// Splitting the concerns means a sign-in after page load reliably
// identifies the user, and sign-out reliably anonymises them, instead
// of relying on accidental `init()` re-execution to do both.

interface PosthogScriptProps {
  config: { key: string; host: string } | null;
  // The signed-in user's id (better-auth session). When non-null,
  // posthog.identify(userId) ties subsequent events to the user.
  userId: string | null;
}

const SDK_ID = "posthog-sdk";

type PosthogWindow = Window & {
  posthog?: {
    init?: (key: string, opts: Record<string, unknown>) => void;
    identify?: (id: string) => void;
    reset?: () => void;
  };
};

export function PosthogScript({ config, userId }: PosthogScriptProps) {
  // Bumped after init() completes. Used as a dep of the identify
  // effect so identify fires the moment the SDK is ready, not just
  // when userId changes later.
  const [readyTick, setReadyTick] = React.useState(0);

  // Load + init. Runs only when `config` changes (i.e. once per app
  // load when env is configured). Cleanup is from loadScriptOnce.
  React.useEffect(() => {
    if (!config) return;
    const w = window as PosthogWindow;
    return loadScriptOnce({
      src: `${config.host.replace(/\/$/, "")}/static/array.js`,
      id: SDK_ID,
      isReady: () => !!w.posthog?.init,
      init: () => {
        if (!w.posthog?.init) return;
        w.posthog.init(config.key, {
          api_host: config.host,
          // identified_only — don't send anonymous events that aren't
          // tied to a user_id. Reduces noise and cost; we already have
          // Plausible counting anonymous pageviews.
          person_profiles: "identified_only",
          // We fire our own events via lib/tracking/client.ts;
          // PostHog's autocapture is too noisy for a small bootstrapped
          // product.
          autocapture: false,
          capture_pageview: false,
          capture_pageleave: false,
        });
        setReadyTick((n) => n + 1);
      },
    });
  }, [config]);

  // Identify / reset. Fires on userId change AND when init completes
  // (readyTick bump). Guarded against missing SDK so a slow load
  // doesn't crash, and against config=null so a runtime opt-out
  // doesn't ghost-identify previous user.
  React.useEffect(() => {
    if (!config) return;
    const w = window as PosthogWindow;
    if (!w.posthog) return;
    if (userId) {
      w.posthog.identify?.(userId);
    } else {
      // Sign-out — reset the device id so events from the next user
      // (or anonymous browsing) don't get tied to the previous user.
      w.posthog.reset?.();
    }
  }, [userId, readyTick, config]);

  return null;
}
