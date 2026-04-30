# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## This is a template. When starting a new project from this repo — READ THIS FIRST.

This project (`ai-saas-base`) is the starting point for multiple downstream products. If you are spawning a **new product** from this template, **you MUST NOT silently inherit the current `.dev.vars` / `wrangler secret` values** — they are shared/borrowed credentials from sibling projects, and silent inheritance causes real problems:

- Real charges landing in another product's Stripe merchant account
- OAuth redirects failing because the redirect URI list belongs to a different domain
- Emails delivered from someone else's sender identity
- Webhook events crossing wires between products
- Billing events from Project A firing Project B's credit grants

### Bootstrap checklist — work through these with the user before writing any product code

**Do not assume. Ask the user. Surface the risk.** If you cannot get an answer, stop and flag it — do not silently use the placeholder / shared value.

| Credential / account | What to ask the user |
|---|---|
| **Domain** | Is there a domain registered yet? Rules for `support@<domain>` Neon/Upstash accounts (see `~/.claude/rules` global) apply only when a domain exists. If no domain, say so and defer Neon/Upstash creation. |
| **Neon Postgres** | Create new project under `support@<domain>`? Or borrow from an existing project (must surface the risk)? Requires pooled + non-pooled connection strings. Per global rule `feedback_neon_upstash_per_project.md`: each project gets its own Neon. |
| **Cloudflare Workers + R2** | Which CF account? What Worker name? Which R2 bucket (create a new one — buckets are cheap)? Confirm `wrangler.jsonc` has the right `account_id`. |
| **Google OAuth client** | New Google Cloud OAuth 2.0 client, or reuse an existing one? If reusing, the redirect URIs `http://localhost:3000/api/auth/callback/google` and `https://<worker-url>/api/auth/callback/google` must be ADDED to the existing client — remind the user to do it, login won't work otherwise. |
| **Stripe** | Which account? Three common paths: (a) new Stripe account for this product, (b) existing account in test mode, (c) existing account in live mode (⚠️ real charges). If (c), flag that `allow_promotion_codes: false` stays, and a dedicated webhook endpoint must be created for this product so events don't fire siblings' handlers. |
| **Stripe products** | Run `scripts/seed-stripe-products.sh` to create the four products (Basic sub / Pro sub / 100-credit pack / 500-credit pack). Confirm the default prices ($9.99/mo, $29.99/mo, $9.99, $39.99) and currency (`usd`). If different, edit the script before running. |
| **Stripe webhook** | User must create a webhook endpoint in Stripe Dashboard pointing at `https://<worker-url>/api/stripe/webhook`, subscribe to `checkout.session.completed` + `invoice.paid` + `customer.subscription.created|updated|deleted`. The signing secret from Stripe must overwrite `STRIPE_WEBHOOK_SECRET` — the value in a freshly-cloned `.dev.vars` is someone else's and signature verification will 400. |
| **Resend / email** | New Resend API key + verified sending domain, or reuse? `EMAIL_FROM` must be on a domain verified in whatever Resend account is active. Optional: `EMAIL_REPLY_TO` for a support inbox. Transactional templates (verify, password reset, purchase receipt) live at `src/lib/email/templates/` — preview them locally with `pnpm email:preview` (opens on port 3001). |
| **AI provider keys** (Replicate, FAL, Kie, Evolink) | Reuse or fresh? These are usage-billed; reusing means your usage hits the other project's bill. |
| **Sentry / GlitchTip** | Create a dedicated project? The default DSN points at a shared GlitchTip project — surfacing another product's errors next to yours. |
| **Plausible** | New domain in Plausible? The DOMAIN env must match the Worker URL exactly. |

### How to onboard a new product from this template (the actual flow)

1. `git clone` this repo under a new directory, re-point `origin` to the new repo
2. Walk the user through the checklist above, filling one item at a time. For each, paste the value into `.dev.vars` AND run `echo "<value>" | npx wrangler secret put <NAME>` to mirror to prod. Never commit `.dev.vars`.
3. Update `wrangler.jsonc`: `name`, `account_id`, R2 bucket name, any Hyperdrive id
4. Update `src/lib/site.ts`: `SITE_URL`, `SITE_NAME`, `SITE_DESCRIPTION`, `SITE_LOCALE` — these drive SEO meta, sitemap, robots, manifest
5. Grep for `[BRAND TODO]` and customize the surfaces listed in "Brand-sensitive surfaces" below
6. Run the Stripe seed script
7. Create the Stripe webhook endpoint, copy whsec into the prod Worker
8. Deploy, verify `/health` returns `db: true`, then verify a test checkout round-trip

### Optional plugin activation — env-gated features

These features are **wired into the code but default OFF** in the template. Each one ships with a graceful fallback so the app keeps working when the env is unset. Enable them by setting the matching `wrangler secret`s. The list below is the canonical setup reference — when a user asks "how do I turn on X" or "the X feature isn't working", check this table.

| Feature | Where in code | Env vars to set | Manual steps |
|---|---|---|---|
| **Stripe Customer Portal** ("管理订阅" button in navbar) | `src/_server-fns/stripe-portal.ts`, `src/components/navigation/navigation-bar.tsx` (`ManageBillingButton`) | none — uses existing `STRIPE_SECRET_KEY` | **Stripe Dashboard → Settings → Customer portal → Activate** + configure allowed actions (cancel sub, update payment, view invoices). No secret to push; the button works the moment Stripe-side is enabled. |
| **Cloudflare Turnstile** (captcha on signup / sign-in / forget-pwd / magic-link / OTP / anonymous) | `src/lib/auth.ts` captcha plugin, `src/components/auth/turnstile-widget.tsx`, `src/components/auth/sign-in-dialog.tsx` | `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | Cloudflare Dashboard → Turnstile → create site bound to your Worker domain → copy site key + secret. Without these, captcha widget hides + plugin doesn't load. |
| **Anonymous user trial** (5-credit "Try without an account" button) | `src/lib/auth.ts` anonymous plugin + `databaseHooks.user.create.after` (initial credits) + `onLinkAccount` (carries credits forward on signup) | `ANONYMOUS_INITIAL_CREDITS` (positive integer, e.g. `5`) | None. Empty / `0` / non-integer disables the plugin entirely. Carries forward to the real account on email/Google/passkey upgrade. |
| **PostHog** (funnels + session replay; coexists with Plausible) | `src/components/monitoring/posthog-script.tsx`, mounted in `__root.tsx` | `POSTHOG_KEY` (project key, `phc_…`), `POSTHOG_HOST` (e.g. `https://us.i.posthog.com` or self-hosted) | Register at posthog.com (or self-host). `identified_only` profiles — only signed-in users get a PostHog person. |
| **Upstash Redis** (cross-region rate-limit, falls back to PG when unset) | `src/lib/rate-limit-redis.ts` + `src/lib/rate-limit.ts` (`consume` tries Redis first, PG on failure) | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | upstash.com → create Redis DB → REST tab → copy URL + token. Without these, all rate-limits route through the existing PG `rate_limits` table — slower in multi-region but always available. |
| **Tolt affiliate** (loads `cdn.tolt.io/tolt.js` + snapshots `?aff=` / `?ref=` / `?via=` / `?tolt_referral=` into `user_sources`) | `src/components/monitoring/tolt-script.tsx`, `src/lib/tracking/client.ts` `captureFirstTouch` | `TOLT_PROGRAM_ID` | tolt.com → create program → copy program id. The DB snapshot in `user_sources.affCode` lets finance reconcile payouts against the DB without touching Tolt's API. |
| **TapTap blog footer link** | `src/components/landing/footer.tsx` (Resources column appears only when set) | `TAPTAP_BLOG_URL` (full URL, e.g. `https://taptap.io/your-blog`) | Create blog at taptap.io. Footer renders nothing for this slot when env is unset. |
| **Google One Tap prompt** | `src/components/auth/one-tap-prompt.tsx` mounted in `__root.tsx`; uses BetterAuth `oneTap` server endpoint | none additional — uses existing `GOOGLE_CLIENT_ID` | None. Visitors with an active Google session AND no app session see the prompt automatically. |
| **Magic Link / Email OTP** (passwordless flows) | `src/lib/auth.ts` `magicLink()` + `emailOTP()` plugins; templates `src/lib/email/templates/{magic-link,otp-code}.tsx` | none — uses existing `RESEND_API_KEY` + `EMAIL_FROM` | None. Buttons live in the auth dialog ("发送邮件登录链接", "用验证码登录"). When `RESEND_API_KEY` is unset, the email no-ops silently and the user sees "已发送" with no actual email — only enable in prod when Resend is configured. |
| **Stripe Radar fraud handler** | `src/lib/stripe-fraud.tsx` | `STRIPE_RADAR_EARLY_FRAUD_WARNING_TYPE` (refund/email/refund,email), `ADMIN_EMAIL` | Stripe Dashboard → enable Radar. Auto-refund + admin email + Discord. |
| **Discord payment notifications** | `src/lib/discord.ts` | `DISCORD_WEBHOOK_URL` | Discord channel → Integrations → Webhook. |
| **Newsletter** | `src/lib/newsletter.ts`, `src/_server-fns/newsletter-subscribe.ts` | `NEWSLETTER_TOKEN_SECRET` (required, min 16), `RESEND_AUDIENCE_ID` (optional) | `openssl rand -hex 32` for secret. Resend audience optional. |
| **Cookie consent** | `src/components/shared/cookie-consent.tsx` | `COOKIE_CONSENT_ENABLED=true` | Renders banner on first visit; stores choice in localStorage. |
| **Locale auto-detection** | `src/lib/i18n/detect.ts`, `src/server.ts` | `LOCALE_DETECTION=true` | Redirects `/` to `/{locale}` based on Accept-Language header. |
| **Discord community widget** | `src/components/shared/discord-invite-widget.tsx` | `DISCORD_INVITE_URL` | Fixed-position invite button. |
| **Google Analytics** | `src/components/monitoring/google-analytics.tsx` | `GOOGLE_ANALYTICS_ID` | GA4 Measurement ID (G-xxx). |
| **Clarity** | `src/components/monitoring/clarity.tsx` | `CLARITY_PROJECT_ID` | clarity.microsoft.com project. |
| **Umami** | `src/components/monitoring/umami.tsx` | `UMAMI_SCRIPT_URL`, `UMAMI_WEBSITE_ID` | Self-hosted or umami.is. |
| **Rybbit** | `src/components/monitoring/rybbit.tsx` | `RYBBIT_SCRIPT_URL`, `RYBBIT_SITE_ID`, `RYBBIT_SESSION_REPLAY`, `RYBBIT_REPLAY_MASK_SELECTORS` | Session replay opt-in. Default mask: `input[type=password]`. |
| **Google AdSense** | `src/components/monitoring/google-adsense.tsx` | `GOOGLE_ADSENSE_ID` | AdSense client ID (ca-pub-xxx). |
| **Crisp** | `src/components/monitoring/crisp.tsx` | `CRISP_WEBSITE_ID` | crisp.chat live chat widget. |
| **Built-with badge** | `src/components/shared/built-with-badge.tsx` | `BUILT_WITH_BADGE_ENABLED=true`, `BUILT_WITH_BADGE_URL` | Fixed-position badge link. |

**Activation pattern (any secret-based feature above)**:

```bash
echo "<value>" | npx wrangler secret put <NAME>
# verify the deploy bound it:
npx wrangler secret list
# redeploy isn't required for vars — wrangler secret applies live.
```

**Verification**: after enabling, hit `/health` (always-on) and the feature's UI surface to confirm. Most plugins also degrade gracefully — a 4xx from PostHog/Upstash/Plausible logs but never breaks user flow.

### For every OTHER conversation where the user asks you to wire in a new external service

Always tell the user *before* writing code:
- Which env vars the service needs
- Where to get them (account creation URL, dashboard path to the key)
- Whether this must be a dedicated account/project or can be shared (surface the risk either way)
- Redirect URIs / webhook URLs they'll need to register manually on the provider's side
- Whether local dev needs extra steps (e.g. `stripe listen`, `ngrok`)

The worst-case pattern to avoid: silently editing `.dev.vars` with values copied from a sibling project without telling the user, then later discovering real charges / crossed wires. **Ask first, document the choice, then wire.**


## Commands

### Development
- `pnpm dev` - Start development server on port 3000
- `pnpm build` - Build for production
- `pnpm serve` - Preview production build
- `pnpm test` - Run tests with Vitest

### Shadcn Components
- `pnpx shadcn@latest add <component>` - Add new Shadcn components (use latest version)

## Architecture

This is a TanStack Start application - a type-safe, client-first, full-stack React framework built on top of:

### Core Stack
- **TanStack Router**: File-based routing with type-safe navigation
- **TanStack Query**: Server state management with SSR integration
- **React 19**: Latest React with concurrent features
- **Vite**: Build tool and dev server
- **TypeScript**: Strict type checking enabled
- **Tailwind CSS v4**: Utility-first styling with CSS variables

### Project Structure
- `src/routes/` - File-based routes (auto-generates `routeTree.gen.ts`)
- `src/components/` - Reusable React components  
- `src/integrations/tanstack-query/` - Query client setup and providers
- `src/lib/utils.ts` - Utility functions (includes clsx/tailwind-merge)
- `src/utils/seo.ts` - SEO helper functions
- Path aliases: `@/*` maps to `src/*`

### Key Architecture Patterns

**Router Setup**: The router is created via `getRouter()` in `src/router.tsx` which integrates TanStack Query context and SSR. Routes are auto-generated from the file system.

**Query Integration**: TanStack Query is pre-configured with SSR support through `setupRouterSsrQueryIntegration`. The query client is accessible in route contexts.

**Root Layout**: `src/routes/__root.tsx` defines the HTML document structure, includes devtools, and provides navigation links. It uses `createRootRouteWithContext` for type-safe context passing.

**Styling**: Uses Tailwind CSS v4 with the Vite plugin. Shadcn components are configured with "new-york" style, Zinc base color, and CSS variables enabled.

**TypeScript**: Strict mode with additional linting rules (`noUnusedLocals`, `noUnusedParameters`, etc.). Uses modern ESNext module resolution.

### Development Notes
- Demo files (prefixed with `demo`) can be safely deleted
- The project uses pnpm as the package manager
- Devtools are included for both Router and Query in development
- Routes support loaders, error boundaries, and not-found components
- File-based routing automatically generates type-safe route definitions

## Runbooks

### Provision / re-sync Stripe products + prices

Phase 3 checkout needs four Stripe products (Basic sub, Pro sub, 100-credit pack, 500-credit pack). Create them **via CLI**, not the Stripe dashboard — reproducible, idempotent, and captured in git.

```bash
bash scripts/seed-stripe-products.sh
```

The script operates against whatever account `STRIPE_SECRET_KEY` in `.dev.vars` points at. It:

1. Searches for each product by `metadata[ai_saas_base_tier]` and each price by `lookup_key` — reuses if found, creates if not (so re-running is safe)
2. Writes the four `STRIPE_PRICE_*` IDs back into `.dev.vars`
3. Prints the `wrangler secret put` loop to push to prod Worker

Defaults (override by editing the script):
- Basic recurring — $9.99/month — tier `basic`
- Pro recurring — $29.99/month — tier `pro`
- 100-credit pack — $9.99 one-time — `metadata[credits]=100` on price
- 500-credit pack — $39.99 one-time — `metadata[credits]=500` on price
- Currency `usd` (override with `STRIPE_CURRENCY=hkd bash scripts/seed-...`)

**Stripe CLI syntax gotchas** (codified here so the next session doesn't rediscover them):
- Free-form request fields (metadata, shipping) → `-d "metadata[key]=value"`. The CLI does **not** have a `--metadata` flag.
- Nested scalar fields use dotted flags: `--recurring.interval month` (not `--recurring "interval=month"`)
- `stripe products update` / `prices update` are destructive — pass `-c` to skip the confirmation prompt, else stdout begins with a prompt and downstream jq parses choke.
- `stripe products search` / `prices search` both take `--query` with a syntax like `metadata['tier']:'basic' AND active:'true'`

To change the price amounts later: edit the unit-amount numbers in the script, bump the `lookup_key` (e.g. `ai_saas_base_basic_monthly_usd_v2`) so the script creates a new price rather than reusing the old one, re-run, push to prod. Stripe does not allow mutating a price's amount in place.

### Push env values to prod Worker

Any time `.dev.vars` changes, mirror to the Worker:

```bash
for V in SECRET_NAME_1 SECRET_NAME_2; do
  grep "^$V=" .dev.vars | cut -d= -f2- | npx wrangler secret put "$V"
done
```

(Piping via stdin means the secret value never appears in the shell command history.) Full secret list: `npx wrangler secret list`.

## Brand-sensitive surfaces (TODO when the product gets a brand)

These are surfaces that currently use generic copy + neutral colors and MUST be customized when the product name, logo, and brand palette are locked in. Grep for `[BRAND TODO]` in the codebase to find them.

### OAuth popup loading screen — `src/components/auth/sign-in-dialog.tsx` (`handleGoogle`)

Inline HTML written via `popup.document.write(...)` to fill the ~0.5–2s gap between popup open and the Google OAuth redirect. Currently renders `"正在跳转到 Google…"` on a `Canvas`/`CanvasText` neutral palette that follows the OS light/dark scheme.

When branding lands, customize:
- **Product name** in `<title>` and the body copy (e.g. `"正在登录到 {Brand}…"`)
- **Logo / mark** — inline SVG above the spinner
- **Colors** — replace `Canvas` / `CanvasText` / `color-mix(... CanvasText ...)` with the brand palette (still honor light/dark via `@media (prefers-color-scheme: dark)` or `:root { color-scheme: ... }`)
- **Font stack** — match the main app's font (currently system stack)
- **Keywords / tagline** — if the brand has one, it can go below the "正在跳转" line as secondary text

Keep the page self-contained (no external CSS/JS/fonts) — the popup is written synchronously into `about:blank` and cannot fetch resources before it navigates away to Google.

### Other brand-touchable surfaces to revisit

- `src/routes/auth.success.tsx` — "登录成功，窗口将自动关闭…" copy
- `src/components/navigation/navigation-bar.tsx` — "TanStack Start" / "on CLOUDFLARE" brand lockup
- `src/utils/seo.ts` — default title/description/OG metadata
- `src/components/landing/*` — hero copy, features copy, footer
- Favicon + `site.webmanifest` (under `public/`)