import { createAuthClient } from "better-auth/react";
import { passkeyClient } from "@better-auth/passkey/client";
import {
  magicLinkClient,
  emailOTPClient,
  anonymousClient,
} from "better-auth/client/plugins";

// Client-side Better Auth helpers — usable in React components.
// Exposes signIn.email, signIn.social, signUp.email, signOut, useSession,
// passkey.register / passkey.authenticate, magicLink.signIn, emailOtp.send,
// anonymous.signIn, etc. Same-origin baseURL.
//
// One Tap intentionally NOT registered as a client plugin: BetterAuth's
// oneTapClient locks the Google clientId at construct time, but this
// module is loaded before siteConfig (which carries the clientId) is
// fetched. The OneTapPrompt component therefore handles GIS init itself
// and POSTs the resulting ID token to /api/auth/one-tap/callback (the
// server-side endpoint exposed by the oneTap server plugin).
//
// All optional plugins are loaded unconditionally on the client — if the
// matching server plugin isn't enabled (env unset), the corresponding
// endpoint returns 404 and the call surfaces as an "endpoint not found"
// error. The UI gates user-facing buttons on the matching siteConfig
// fields so users never see actions that would 404 on submit.
export const authClient = createAuthClient({
  baseURL: typeof window === "undefined" ? "" : window.location.origin,
  plugins: [
    passkeyClient(),
    magicLinkClient(),
    emailOTPClient(),
    anonymousClient(),
  ],
});

export const { signIn, signUp, signOut, useSession } = authClient;
