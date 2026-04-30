import * as React from "react";
import { loadScriptOnce } from "@/lib/dom/load-script";

// Google One Tap prompt. Initialises Google Identity Services on mount,
// receives an ID token via the GIS callback, then POSTs it to
// `/api/auth/one-tap/callback` (the BetterAuth oneTap server plugin's
// endpoint). On success the cookie session is set and we reload to
// pick up the new auth state.
//
// We do GIS init directly rather than via authClient's oneTapClient
// plugin because the plugin locks the Google clientId at module load
// time but our clientId only arrives at render time via siteConfig
// (server-fn round-trip). This component receives clientId as a prop
// and passes it to GIS once.
//
// Renders nothing in the DOM beyond the script tag. Gated by:
//   - googleClientId from site-config (null = OAuth not configured)
//   - isAuthenticated already true (we never re-prompt a signed-in user)

interface OneTapPromptProps {
  googleClientId: string | null;
  isAuthenticated: boolean;
}

interface GoogleCredentialResponse {
  credential: string;
}

interface GoogleAccountsId {
  initialize: (options: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
    auto_select?: boolean;
    cancel_on_tap_outside?: boolean;
    use_fedcm_for_prompt?: boolean;
  }) => void;
  prompt: () => void;
}

declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleAccountsId } };
  }
}

const SCRIPT_ID = "google-one-tap-sdk";
const SCRIPT_SRC = "https://accounts.google.com/gsi/client";
const ONE_TAP_ENDPOINT = "/api/auth/one-tap/callback";

export function OneTapPrompt({ googleClientId, isAuthenticated }: OneTapPromptProps) {
  React.useEffect(() => {
    if (!googleClientId) return;
    if (isAuthenticated) return;

    let authChannel: BroadcastChannel | null = null;

    const handleCredential = async (response: GoogleCredentialResponse) => {
      try {
        const res = await fetch(ONE_TAP_ENDPOINT, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ idToken: response.credential }),
          credentials: "same-origin",
        });
        if (!res.ok) {
          // 404 = oneTap server plugin not enabled (template default).
          // 401/403 = token rejected. Both fail silently — One Tap is
          // an enhancement, not a primary auth flow.
          return;
        }
        // Signal other tabs/components via the same BroadcastChannel
        // used by the OAuth popup flow, avoiding a full page reload.
        if (typeof BroadcastChannel !== "undefined") {
          authChannel = new BroadcastChannel("auth");
          authChannel.postMessage("auth:signed-in");
          authChannel.close();
          authChannel = null;
        }
        window.location.reload();
      } catch {
        // Network blip, also non-fatal.
      }
    };

    return loadScriptOnce({
      src: SCRIPT_SRC,
      id: SCRIPT_ID,
      isReady: () => !!window.google?.accounts?.id,
      init: () => {
        const gid = window.google?.accounts?.id;
        if (!gid) return;
        gid.initialize({
          client_id: googleClientId,
          callback: handleCredential,
          // Don't auto-pick the previously-used Google account — show
          // the chooser so a user with multiple accounts can pick.
          auto_select: false,
          cancel_on_tap_outside: true,
        });
        gid.prompt();
      },
    });
  }, [googleClientId, isAuthenticated]);

  return null;
}
