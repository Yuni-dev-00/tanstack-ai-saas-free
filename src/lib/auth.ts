import { betterAuth, type BetterAuthPlugin } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { passkey } from "@better-auth/passkey";
import { magicLink } from "better-auth/plugins/magic-link";
import { emailOTP } from "better-auth/plugins/email-otp";
import { anonymous } from "better-auth/plugins/anonymous";
// `one-tap` and `captcha` are bundled in better-auth/plugins (no
// dedicated subpath export, unlike the others above).
import { oneTap, captcha } from "better-auth/plugins";
import { sendEmail, type EmailEnv } from "@/lib/email/client";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import type { WorkerEnv } from "@/lib/env";
import { createDb, resolveConnectionString, type DB } from "../db/client";

// Runtime-only module: factory that creates a per-request BetterAuth
// instance using secrets handed in from the cloudflare:workers env. The
// CLI-time `auth` named export used to live here too and fired a
// betterAuth() call at module load (H-3); that's been moved to
// src/lib/auth-cli.ts so it only runs when the @better-auth/cli tool
// explicitly imports it, not on every Worker cold start.

// Business fields we add to Better Auth's `users` table. Keep this list
// in sync with src/db/schema.ts AND with src/lib/auth-cli.ts — the
// drizzleAdapter with usePlural + these additionalFields drives the
// schema CLI output.
export const additionalUserFields = {
  isAnonymous: { type: "boolean" as const, defaultValue: false, required: true },
};

export interface CreateAuthOptions {
  secret: string;
  baseURL: string;
  googleClientId: string;
  googleClientSecret: string;
  // Email sender config — optional because auth-cli imports this factory
  // at schema-generation time with no secrets. When omitted,
  // sendVerificationEmail / sendResetPassword no-op (templates just aren't
  // dispatched), preserving existing behaviour for local dev without
  // Resend configured.
  email?: EmailEnv;
  // Each of these enables a corresponding BetterAuth plugin only when
  // configured. All optional — none is required for sign-in/sign-up to
  // function. The unset state is the documented "feature off" default.
  turnstile?: { siteKey: string; secretKey: string };
  appUrl?: string;
}

// Build a Better Auth instance bound to an existing Drizzle db. Use this
// from middleware/server-fn paths that already hold a db+pool and want to
// add auth without opening a second pool. CF Workers secrets are NOT on
// process.env — callers pull them from `cloudflare:workers` and pass here.
export function createAuthInstance(db: DB, opts: CreateAuthOptions) {
  // Compose the optional plugin list. Every entry is gated by an env
  // value — the template ships with all OFF, downstream products opt in
  // by setting the matching wrangler secret.
  const optionalPlugins: BetterAuthPlugin[] = [];

  // Captcha — Cloudflare Turnstile. Enforces challenges on every
  // unauthenticated entry point that creates a user OR consumes an
  // email-send budget. Magic-link, OTP, and anonymous flows are all
  // included so they can't be used as bypass vectors when captcha is
  // deployed for password-form spam protection. Sign-out / verify-email
  // are intentionally excluded — they're already auth-bound or
  // crypto-bound.
  if (opts.turnstile) {
    optionalPlugins.push(
      captcha({
        provider: "cloudflare-turnstile",
        secretKey: opts.turnstile.secretKey,
        endpoints: [
          "/sign-up/email",
          "/sign-in/email",
          "/forget-password",
          "/sign-in/magic-link",
          "/email-otp/send-verification-otp",
          "/sign-in/anonymous",
        ],
      }),
    );
  }

  // Anonymous users are available in the free starter without any
  // credit ledger or payment wiring.
  optionalPlugins.push(
    anonymous({
      emailDomainName: "anon.local",
    }),
  );

  // One Tap — Google's prompt for visitors who already have a Google
  // session. Only useful when Google OAuth is configured (we always
  // configure it below from env). No env gate.
  optionalPlugins.push(oneTap());

  // Magic Link — email-only passwordless flow. Always available; the
  // Resend send is no-op'd inside `sendEmail` when RESEND_API_KEY is
  // missing, so this stays safe in dev without Resend.
  optionalPlugins.push(
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        if (!opts.email) return;
        const { MagicLinkEmail } = await import("@/lib/email/templates/magic-link");
        await sendEmail(opts.email, {
          to: email,
          subject: `Sign in to ${SITE_NAME}`,
          react: MagicLinkEmail({
            magicLinkUrl: url,
            siteName: SITE_NAME,
            siteUrl: SITE_URL,
          }),
          tag: "magic-link",
        });
      },
    }),
  );

  // Email OTP — 6-digit code flow used for sign-in, signup verification,
  // AND password reset. Same email path as Magic Link.
  optionalPlugins.push(
    emailOTP({
      sendVerificationOTP: async ({ email, otp, type }) => {
        if (!opts.email) return;
        const { OtpCodeEmail } = await import("@/lib/email/templates/otp-code");
        await sendEmail(opts.email, {
          to: email,
          subject: `Your ${SITE_NAME} code: ${otp}`,
          react: OtpCodeEmail({
            code: otp,
            type,
            siteName: SITE_NAME,
            siteUrl: SITE_URL,
          }),
          tag: `otp-${type}`,
        });
      },
    }),
  );

  return betterAuth({
    secret: opts.secret,
    baseURL: opts.baseURL,
    // Explicit CSRF boundary; matches the Worker URL.
    trustedOrigins: [opts.baseURL],
    database: drizzleAdapter(db, { provider: "pg", usePlural: true }),
    user: { additionalFields: additionalUserFields },
    // H-1: require email verification so a squatter can't register
    // victim@company.com and get a session indistinguishable from the
    // real user's (before they've ever logged in via the same email).
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      sendResetPassword: async ({ user, url }) => {
        if (!opts.email) return;
        const { PasswordReset } = await import("@/lib/email/templates/password-reset");
        await sendEmail(opts.email, {
          to: user.email,
          subject: `Reset your ${SITE_NAME} password`,
          react: PasswordReset({
            resetUrl: url,
            siteName: SITE_NAME,
            siteUrl: SITE_URL,
          }),
          tag: "password-reset",
        });
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => {
        if (!opts.email) return;
        const { VerifyEmail } = await import("@/lib/email/templates/verify-email");
        await sendEmail(opts.email, {
          to: user.email,
          subject: `Verify your email for ${SITE_NAME}`,
          react: VerifyEmail({
            verifyUrl: url,
            siteName: SITE_NAME,
            siteUrl: SITE_URL,
          }),
          tag: "verify-email",
        });
      },
    },
    socialProviders: {
      google: {
        clientId: opts.googleClientId,
        clientSecret: opts.googleClientSecret,
      },
    },
    plugins: [passkey(), ...optionalPlugins],
    // 7-day expiry keeps the session short-lived for a public starter.
    // updateAge stays at 24h so active users get a rolling refresh.
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
      cookieCache: {
        enabled: true,
        maxAge: 5 * 60,
        strategy: "compact",
      },
      deferSessionRefresh: true,
    },
    deleteUser: {
      enabled: true,
      sendDeleteAccountVerification: undefined,
      beforeDelete: async (user: { id: string; email: string }) => {
      },
    },
  });
}

// Centralised constructor for CreateAuthOptions from a WorkerEnv.
// Both server.ts and middleware/auth.ts use this so a new option (e.g. a
// new OAuth provider) only needs to be wired in one place.
export function buildAuthOptions(env: WorkerEnv): CreateAuthOptions {
  const turnstile =
    env.TURNSTILE_SITE_KEY && env.TURNSTILE_SECRET_KEY
      ? { siteKey: env.TURNSTILE_SITE_KEY, secretKey: env.TURNSTILE_SECRET_KEY }
      : undefined;
  return {
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL ?? env.APP_URL,
    googleClientId: env.GOOGLE_CLIENT_ID,
    googleClientSecret: env.GOOGLE_CLIENT_SECRET,
    email: {
      RESEND_API_KEY: env.RESEND_API_KEY,
      EMAIL_FROM: env.EMAIL_FROM,
      EMAIL_REPLY_TO: env.EMAIL_REPLY_TO,
    },
    turnstile,
    appUrl: env.APP_URL,
  };
}

// Per-request auth factory. Follows Hyperdrive docs: create a new
// pg.Client per request, Hyperdrive pools at the edge. Returns the
// auth instance + client so the caller can clean up with client.end().
export async function createAuthForRequest(env: WorkerEnv): Promise<{
  auth: ReturnType<typeof createAuthInstance>;
  db: DB;
  client: import("pg").Client;
}> {
  const connectionString = resolveConnectionString(env);
  const { db, client } = await createDb(connectionString);
  const auth = createAuthInstance(db, buildAuthOptions(env));
  return { auth, db, client };
}
