import * as React from "react";
import { loadScriptOnce } from "@/lib/dom/load-script";

// Cloudflare Turnstile captcha widget (client-rendered). Loads
// https://challenges.cloudflare.com/turnstile/v0/api.js once per page;
// subsequent mounts reuse the loaded global. The widget posts a token
// in the form's hidden `cf-turnstile-response` field which the
// BetterAuth `captcha` plugin (server-side) verifies against
// Turnstile's /siteverify endpoint before the protected handler runs.
//
// Renders nothing if siteKey is null (template default — no Turnstile
// configured). Forms render unaffected; signup goes through.

interface TurnstileWidgetProps {
  siteKey: string | null;
  // Optional theme — Turnstile picks up "auto" by default which follows
  // prefers-color-scheme. Override per-mount if needed.
  theme?: "light" | "dark" | "auto";
  // Forwarded to the widget's data-callback so the parent can react
  // (e.g. enable submit button) — Turnstile passes the captcha token.
  // Tokens are valid for ~300s; on expiry the widget calls this with
  // null so the parent can disable submit + re-prompt.
  onVerified?: (token: string | null) => void;
}

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        opts: {
          sitekey: string;
          theme?: "light" | "dark" | "auto";
          callback?: (token: string) => void;
          "expired-callback"?: () => void;
          "error-callback"?: () => void;
        },
      ) => string; // widget id
      remove: (widgetId: string) => void;
    };
  }
}

const SDK_URL =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const SDK_ID = "cf-turnstile-sdk";

export function TurnstileWidget({ siteKey, theme = "auto", onVerified }: TurnstileWidgetProps) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const widgetIdRef = React.useRef<string | null>(null);
  // Stash the latest callback in a ref so the effect doesn't tear down
  // and re-render the widget when the parent passes a fresh inline
  // arrow function. Only siteKey + theme actually justify a re-render.
  // ref update goes in an effect (not during render — react-hooks/refs).
  const onVerifiedRef = React.useRef(onVerified);
  React.useEffect(() => {
    onVerifiedRef.current = onVerified;
  }, [onVerified]);

  React.useEffect(() => {
    if (!siteKey) return;
    if (typeof window === "undefined" || !containerRef.current) return;

    const container = containerRef.current;
    const cleanup = loadScriptOnce({
      src: SDK_URL,
      id: SDK_ID,
      isReady: () => !!window.turnstile,
      init: () => {
        if (!window.turnstile) return;
        widgetIdRef.current = window.turnstile.render(container, {
          sitekey: siteKey,
          theme,
          callback: (token) => onVerifiedRef.current?.(token),
          // Token expired (~300s) — clear it so the parent's submit
          // button disables and the user gets a fresh challenge.
          "expired-callback": () => onVerifiedRef.current?.(null),
          // Network / iframe error — same treatment so a stale token
          // can't be sent to the server.
          "error-callback": () => onVerifiedRef.current?.(null),
        });
      },
    });

    return () => {
      cleanup();
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          // Widget already gone (DOM replaced) — non-fatal.
        }
      }
    };
  }, [siteKey, theme]);

  if (!siteKey) return null;
  return <div ref={containerRef} className="cf-turnstile" />;
}
