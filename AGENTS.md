# AGENTS.md

AI agents working on this codebase must follow these conventions.

## Session & Auth

- **Use `@/hooks/use-session`**, NOT `@/lib/auth-client`'s `useSession`
- The project wraps BetterAuth's session into a TanStack Query hook at `src/hooks/use-session.ts`
- This hook returns `{ data: session, isPending, isFetching }` where `session` has `{ user, session }` shape
- `session.user.isAnonymous` — whether the current user is an anonymous trial user
- `useRefreshSession()` from the same file invalidates the session cache

```ts
// Correct
import { useSession } from "@/hooks/use-session";

// Wrong — do not use directly
import { useSession } from "@/lib/auth-client";
```

## Credits & Billing UX

- Buttons that require credits must NEVER be `disabled` when credits are insufficient
- Instead, on click → attempt the action → catch the credit error → show appropriate dialog:
  - Anonymous user (`session.user.isAnonymous`) → open `SignInDialog`
  - Real user → open `PricingDialog`
- `PricingDialog` and `SignInDialog` both support controlled `open`/`onOpenChange` props

## AI Generation (submit flow)

- All AI generation requires authentication (`requireAuthMiddleware`)
- Even anonymous-plugin users must have a session and credits
- Credits are always deducted — there is no "free without credits" path
- IP + UA fingerprint is recorded in job metadata for abuse tracking

## Rate Limiting

- Authenticated users: 30 requests / 60s (per user)
- Turnstile captcha protects: sign-up, sign-in, forget-password, magic-link, OTP, anonymous sign-in

## Provider Param Mapping

- All AI providers use `transformInput(config, input, { passthrough: true, schema: canonicalImageInputSchema })`
- The `canonicalImageInputSchema` (Zod) has defaults: `ratio: "1:1"`, `quality: "medium"`, `outputCount: 1`, `resolution: "2K"`
- Tests must account for these defaults being injected into provider request bodies
