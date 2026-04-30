// Tiny helper for the "load a third-party SDK script tag once, then run
// `init` when its global is ready" dance shared by:
//   - components/auth/one-tap-prompt.tsx (Google Identity Services)
//   - components/auth/turnstile-widget.tsx (Cloudflare Turnstile)
//   - components/monitoring/posthog-script.tsx (PostHog)
//
// Returns a cleanup function that, on unmount:
//   - removes the load listener if the script is still loading
//   - leaves the script element in the DOM (re-mounting the same SDK
//     should reuse the cached global, not re-download)
//
// `init` is invoked at most once per call regardless of whether the
// script was freshly inserted, was already loading from another mount,
// or was already loaded.

export interface LoadScriptOptions {
  src: string;
  // Stable id used to dedupe across mounts. Must be unique per SDK.
  id: string;
  // Optional dataset attributes applied before the script loads (used
  // by Tolt's `data-tolt={programId}` pattern, etc.).
  dataset?: Record<string, string>;
  // Optional crossorigin attribute (Tolt requires "anonymous").
  crossOrigin?: "anonymous" | "use-credentials";
  // Called when the global is verifiably present. Pass a cheap check
  // for window.<global>; the helper polls every 50ms until it returns
  // true OR the cleanup function fires.
  isReady: () => boolean;
  init: () => void;
}

export function loadScriptOnce(opts: LoadScriptOptions): () => void {
  if (typeof document === "undefined") return () => {};

  // Already loaded (different mount or full page navigation that
  // preserved the global).
  if (opts.isReady()) {
    opts.init();
    return () => {};
  }

  let cancelled = false;
  let pollHandle: number | null = null;
  // 50ms × 200 = 10s ceiling. Beyond this, the SDK is either blocked
  // by a corp firewall, ad-blocker, or 4xx — keep retrying forever
  // would be a hidden CPU/battery drain on long-lived components like
  // OneTapPrompt that mount in __root.
  const MAX_POLLS = 200;
  let polls = 0;

  const tryInit = () => {
    if (cancelled) return false;
    if (!opts.isReady()) return false;
    opts.init();
    return true;
  };

  const startPolling = () => {
    pollHandle = window.setInterval(() => {
      polls++;
      if (tryInit() || polls >= MAX_POLLS) {
        if (pollHandle !== null) window.clearInterval(pollHandle);
        pollHandle = null;
      }
    }, 50);
  };

  const existing = document.querySelector(`#${opts.id}`) as HTMLScriptElement | null;
  if (existing) {
    // Another mount started the load — wait for the global to arrive.
    startPolling();
    return () => {
      cancelled = true;
      if (pollHandle !== null) window.clearInterval(pollHandle);
    };
  }

  const script = document.createElement("script");
  script.id = opts.id;
  script.src = opts.src;
  script.async = true;
  script.defer = true;
  if (opts.crossOrigin) script.crossOrigin = opts.crossOrigin;
  if (opts.dataset) {
    for (const [k, v] of Object.entries(opts.dataset)) script.dataset[k] = v;
  }
  const onLoad = () => {
    // Some SDKs install their global on a microtask after the script
    // load event; poll briefly rather than assume it's synchronous.
    if (!tryInit()) startPolling();
  };
  const onError = () => {
    // 4xx / network failure — bail out without polling forever.
    cancelled = true;
  };
  script.addEventListener("load", onLoad);
  script.addEventListener("error", onError);
  document.head.appendChild(script);

  return () => {
    cancelled = true;
    script.removeEventListener("load", onLoad);
    script.removeEventListener("error", onError);
    if (pollHandle !== null) window.clearInterval(pollHandle);
    // Intentionally NOT removing the script element. Other mounts /
    // page navigations should reuse the cached SDK rather than
    // re-downloading.
  };
}
