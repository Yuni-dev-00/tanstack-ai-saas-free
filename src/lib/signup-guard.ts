// Signup abuse guards shared by the Better Auth hooks in auth.ts.
//
// Two independent defenses against signup-bonus farming (multi-account
// "wool pulling"):
//   1. Disposable-email domain blocklist — farmers registered batches of
//      throwaway inboxes (observed: smaqt.com, 2026-07) to collect the
//      signup bonus repeatedly.
//   2. Per-IP signup cap — enforced in auth.ts via the shared rate-limit
//      infrastructure (`signup-ip:<ip>` key), constants defined here so
//      the policy is documented and testable in one place.

// Domains whose mailboxes are throwaway/temporary. Signups (email,
// OAuth — any path that carries an email) from these domains are
// rejected before the user row is created. `anon.local` is NOT listed:
// that's the anonymous-plugin synthetic domain and anon users skip this
// check entirely (they're capped by ANONYMOUS_INITIAL_CREDITS instead).
const BLOCKED_EMAIL_DOMAINS = new Set([
  "smaqt.com", // observed farming grokvideomaker signup bonus, 2026-07
  "mailinator.com",
  "guerrillamail.com",
  "sharklasers.com",
  "10minutemail.com",
  "temp-mail.org",
  "tempmail.com",
  "yopmail.com",
  "getnada.com",
  "trashmail.com",
  "maildrop.cc",
  "dispostable.com",
  "fakeinbox.com",
  "mail.tm",
  "mohmal.com",
]);

// True when the email's domain (or any parent domain, so subdomain
// tricks like a.b.smaqt.com don't bypass the list) is blocked.
export function isBlockedEmailDomain(email: string): boolean {
  const at = email.lastIndexOf("@");
  if (at < 0) return false;
  const domain = email.slice(at + 1).trim().toLowerCase();
  if (!domain) return false;
  const labels = domain.split(".");
  for (let i = 0; i < labels.length - 1; i++) {
    if (BLOCKED_EMAIL_DOMAINS.has(labels.slice(i).join("."))) return true;
  }
  return false;
}

// Per-IP signup cap defaults: at most N user rows created per client IP
// per rolling window. Overridable via the SIGNUP_IP_LIMIT env (see
// env.ts / buildAuthOptions); 0 disables the cap.
export const SIGNUP_IP_DEFAULT_LIMIT = 3;
export const SIGNUP_IP_WINDOW_SEC = 24 * 60 * 60;
