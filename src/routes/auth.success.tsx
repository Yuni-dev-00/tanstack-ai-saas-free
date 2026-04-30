import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { seo } from "@/utils/seo";
import { recordSignupSource } from "@/_server-fns/record-signup-source";

export const Route = createFileRoute("/auth/success")({
  head: () => seo({ title: "登录成功", noindex: true }),
  component: AuthSuccess,
});

// OAuth callback landing inside the sign-in popup. Better Auth has already
// set the session cookie by the time we render here — we just need to tell
// the opener window and close ourselves.
//
// Google's OAuth pages set Cross-Origin-Opener-Policy: same-origin, which
// severs `window.opener` on the popup side for the rest of its life. So we
// can't rely on postMessage through opener. Use BroadcastChannel (same-origin
// cross-window, no opener needed) as the primary signal, plus a localStorage
// + postMessage fallback for ancient browsers / weird environments.
function AuthSuccess() {
  const recordSource = useServerFn(recordSignupSource);
  React.useEffect(() => {
    // Snapshot the attribution cookie + cf headers into user_sources
    // (idempotent — first call wins; reload-on-success is a no-op).
    // Fire-and-forget; popup-close shouldn't block on analytics.
    // Same pattern as sign-in-dialog's `fireRecordSource`.
    recordSource().catch(() => { /* server-logged */ });

    // Primary: BroadcastChannel — works regardless of COOP severance.
    if (typeof BroadcastChannel !== "undefined") {
      const bc = new BroadcastChannel("auth");
      try {
        bc.postMessage({ type: "auth:signed-in" });
      } finally {
        bc.close();
      }
    }

    // Fallback #1: cross-tab ping via localStorage storage event. Also works
    // even if the user happens to be signed in from another tab.
    try {
      localStorage.setItem("auth:signed-in-at", String(Date.now()));
    } catch {
      // private mode / storage disabled — no-op
    }

    // Fallback #2: opener.postMessage, in case COOP didn't actually sever.
    try {
      window.opener?.postMessage(
        { type: "auth:signed-in" },
        window.location.origin,
      );
    } catch {
      // opener null / cross-origin — ignore
    }

    // Try to close the popup. If the browser refuses (e.g. opened manually
    // in a tab, not a popup), redirect the tab back to /.
    window.close();
    const t = window.setTimeout(() => {
      if (!window.closed) {
        window.location.href = "/";
      }
    }, 800);
    return () => window.clearTimeout(t);
    // recordSource is a stable serverFn binding — it won't change
    // between renders, so depending on it would just be noise.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <p className="text-sm text-muted-foreground">登录成功，窗口将自动关闭…</p>
    </div>
  );
}
