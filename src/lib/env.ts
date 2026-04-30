import { z } from "zod";

// Keep the schema loose for fields whose strict format is only relevant
// in specific deployment setups. Tighten later via branded types if
// a downstream product needs stricter validation.
export const envSchema = z.object({
  APP_URL: z.string().url(),
  BETTER_AUTH_SECRET: z.string().min(32, "must be 32+ chars (openssl rand -base64 32)"),
  BETTER_AUTH_URL: z.string().url(),

  DATABASE_URL: z.string().startsWith("postgresql://", "must be a Neon/Postgres connection URL"),

  GOOGLE_CLIENT_ID: z.string(),
  GOOGLE_CLIENT_SECRET: z.string(),

  RESEND_API_KEY: z.string(),
  EMAIL_FROM: z.string(),
  // Optional reply-to inbox forwarded into transactional emails. When
  // unset (template default), Resend falls back to EMAIL_FROM.
  EMAIL_REPLY_TO: z.string().optional(),

  R2_ACCOUNT_ID: z.string(),
  R2_ACCESS_KEY_ID: z.string(),
  R2_SECRET_ACCESS_KEY: z.string(),
  R2_BUCKET: z.string(),
  R2_PUBLIC_BASE: z.string().url(),

  SENTRY_DSN: z.string().optional(),
  PLAUSIBLE_DOMAIN: z.string().optional(),
  PLAUSIBLE_SCRIPT_URL: z.string().url().optional(),
  PLAUSIBLE_SCRIPT_SRI: z.string().optional(),

  APP_VERSION: z.string().optional(),
  GIT_COMMIT: z.string().optional(),

  // Cloudflare Turnstile (captcha). When BOTH keys are set, the
  // BetterAuth `captcha` plugin enforces verification on signup +
  // password-reset flows; when unset, the plugin isn't loaded so
  // existing flows stay open.
  TURNSTILE_SITE_KEY: z.string().optional(),
  TURNSTILE_SECRET_KEY: z.string().optional(),

  // PostHog product analytics — optional. We keep Plausible as the
  // primary pageview tracker (lightweight, self-hosted, EU-friendly)
  // and bolt PostHog on for funnels + session replay when this is set.
  POSTHOG_KEY: z.string().optional(),
  POSTHOG_HOST: z.string().optional(),

  // Upstash Redis REST API (optional). When configured, rate-limit
  // operations route through Redis for cross-region atomicity; when
  // unset, falls back to the existing PG `rate_limits` table — single-
  // region but always available, no extra infra to provision.
  UPSTASH_REDIS_REST_URL: z.string().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

  // Accept-Language locale auto-detection redirect. "true" to enable.
  LOCALE_DETECTION: z.string().optional(),
  // Cookie consent banner. "true" to show.
  COOKIE_CONSENT_ENABLED: z.string().optional(),

  // Analytics (all env-gated — unset = not loaded)
  GOOGLE_ANALYTICS_ID: z.string().optional(),
  CLARITY_PROJECT_ID: z.string().optional(),
  UMAMI_SCRIPT_URL: z.string().url().optional(),
  UMAMI_WEBSITE_ID: z.string().optional(),
  RYBBIT_SCRIPT_URL: z.string().url().optional(),
  RYBBIT_SITE_ID: z.string().optional(),
  RYBBIT_SESSION_REPLAY: z.enum(["true", "false"]).optional(),
  RYBBIT_REPLAY_MASK_SELECTORS: z.string().optional(),
  GOOGLE_ADSENSE_ID: z.string().optional(),
  CRISP_WEBSITE_ID: z.string().optional(),
  VERCEL_ANALYTICS_ID: z.string().optional(),

  // Built-with badge
  BUILT_WITH_BADGE_ENABLED: z.string().optional(),
  BUILT_WITH_BADGE_URL: z.string().url().optional(),
});

// Application-side env type — derived from the Zod schema so adding a
// new field is a one-line change in the schema above. Optional fields
// (`.optional()`) become `string | undefined` automatically; required
// fields stay required.
export type SchemaEnv = z.infer<typeof envSchema>;

// Runtime CF Workers env shape used at every site that reads `env`.
// Combines:
//   - The cf-typegen GLOBAL `Env` (bindings: HYPERDRIVE, ASSETS_BUCKET,
//     and wrangler.jsonc `vars`). Referenced by name, not imported.
//   - The Zod-inferred SchemaEnv (every secret + var declared in the
//     application schema). Single source of truth for "what fields
//     exist" — adding a new optional secret means editing envSchema
//     above and nothing else.
//
// The intersection is safe because the only overlap is fields declared
// in BOTH wrangler.jsonc vars AND envSchema (e.g. APP_URL), which both
// type as `string`.
//
// `globalThis.Env` is the cf-typegen interface; we alias it to
// CloudflareEnv so the intersection reads cleanly.
type CloudflareEnv = globalThis.Env;
export type WorkerEnv = CloudflareEnv & SchemaEnv;

export function parseEnv(raw: unknown): SchemaEnv {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return result.data;
}

// Lazy-cached accessor for the Cloudflare Workers runtime env.
// Call from src/server.ts or inside createServerFn handlers.
// Fails fast with a precise error the first time any required key is missing.
//
// The actual cloudflare:workers import is done via dynamic import() so that
// this module stays importable in Node (vitest). Unit tests exercise parseEnv
// directly and never call env(); production code calls env() inside a request
// handler where cloudflare:workers is available.
let cached: SchemaEnv | null = null;

export async function env(): Promise<SchemaEnv> {
  if (cached) return cached;
  const mod = await import(/* @vite-ignore */ "cloudflare:workers");
  cached = parseEnv((mod as { env: unknown }).env);
  return cached;
}

// Sync variant — callable only in Workers runtime after the first async call
// has populated the cache. Prefer `await env()` in new code.
export function envSync(): SchemaEnv {
  if (!cached) {
    throw new Error("envSync() called before env() primed the cache — use `await env()` first, or call from a handler that has already awaited env().");
  }
  return cached;
}

// Test/server.ts may call this to force-reload (useful after secret rotation).
export function _resetEnvCache() {
  cached = null;
}
