// Security headers applied to every SSR / API response out of src/server.ts.
// CSP allowlist is scoped to the external services the starter actually
// talks to (analytics, auth providers, and optional embed services).

export interface CspOptions {
  nonce?: string;
  umamiScriptUrl?: string;
  rybbitScriptUrl?: string;
}

function safeOrigin(url: string): string {
  try { return new URL(url).origin; } catch { return ""; }
}

function buildCsp(opts: CspOptions = {}): string {
  const { nonce } = opts;
  const GOOGLE_GIS = "https://accounts.google.com";

  // Analytics script origins (fixed + dynamic user-hosted)
  const analyticsScriptOrigins = [
    "https://www.googletagmanager.com",
    "https://www.clarity.ms",
    "https://pagead2.googlesyndication.com",
    "https://client.crisp.chat",
    ...(opts.umamiScriptUrl ? [safeOrigin(opts.umamiScriptUrl)] : []),
    ...(opts.rybbitScriptUrl ? [safeOrigin(opts.rybbitScriptUrl)] : []),
  ].filter(Boolean).join(" ");

  const scriptSrc = nonce
    ? `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-inline' https://analytics.ai-yuni.com ${GOOGLE_GIS} ${analyticsScriptOrigins}`
    : `script-src 'self' 'unsafe-inline' https://analytics.ai-yuni.com ${GOOGLE_GIS} ${analyticsScriptOrigins}`;
  // style-src intentionally stays on 'unsafe-inline' without a nonce.
  // Adding a nonce to style-src would cause modern browsers to IGNORE
  // 'unsafe-inline', which breaks every runtime-injected <style> that
  // doesn't carry the nonce attribute — TanStack Query/Router Devtools,
  // next-themes flash-prevention, Google One Tap, Radix popovers.
  // Keeping 'unsafe-inline' for styles while script-src stays
  // nonce+strict-dynamic is the standard trade-off: script injection is
  // the XSS vector; style injection alone can't run code.
  const styleSrc = `style-src 'self' 'unsafe-inline' ${GOOGLE_GIS}`;
  return [
    "default-src 'self'",
    "img-src 'self' data: https:",
    styleSrc,
    scriptSrc,
    [
      "connect-src 'self'",
      "https://analytics.ai-yuni.com",
      "https://errors.ai-yuni.com",
      "https://*.r2.cloudflarestorage.com",
      "https://*.r2.dev",
      GOOGLE_GIS,
      "https://www.google-analytics.com",
      "https://analytics.google.com",
      "https://*.google-analytics.com",
      "https://www.clarity.ms",
      "https://pagead2.googlesyndication.com",
      "https://client.crisp.chat",
      "wss://client.relay.crisp.chat",
      ...(opts.umamiScriptUrl ? [safeOrigin(opts.umamiScriptUrl)] : []),
      ...(opts.rybbitScriptUrl ? [safeOrigin(opts.rybbitScriptUrl)] : []),
    ].filter(Boolean).join(" "),
    `frame-src ${GOOGLE_GIS} https://game.crisp.chat`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}

const STATIC_HEADERS: Record<string, string> = {
  "x-frame-options": "DENY",
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy": "geolocation=(), microphone=(), camera=()",
  // HSTS: 1 year + subdomains. CF Workers always terminate TLS, so a
  // downgrade attack would have to hit the CF edge — this header adds a
  // client-side belt to the CF suspenders. `preload` is intentionally
  // omitted until the domain is actually submitted to the HSTS preload
  // list (one-way door, don't do on workers.dev subdomains).
  "strict-transport-security": "max-age=31536000; includeSubDomains",
};

// Returns a NEW Response with security headers merged onto the original.
// Keeps status, body, and existing headers intact. Optional `nonce` lifts
// CSP from `unsafe-inline` to `'nonce-<value>' 'strict-dynamic'`.
export function applySecurityHeaders(
  res: Response,
  opts: CspOptions = {},
): Response {
  const merged = new Headers(res.headers);
  if (!merged.has("content-security-policy")) {
    merged.set("content-security-policy", buildCsp(opts));
  }
  for (const [k, v] of Object.entries(STATIC_HEADERS)) {
    if (!merged.has(k)) merged.set(k, v);
  }
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers: merged,
  });
}

// Generate a per-request CSP nonce. URL-safe base64, 16 bytes random
// → 22 chars after stripping padding. Plenty for nonce purposes.
export function generateCspNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCodePoint(bytes[i]!);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Guard mutating Server Functions against CSRF. Call at the top of any
// handler that writes to the DB or calls third-party APIs on behalf of the
// current user.
//
// Rule: if an Origin header is present (browser cross-origin fetch), it must
// match appUrl's origin. If absent (server-to-server, curl, native app),
// we allow — same-origin policy only applies when a browser sets Origin.
// Additional defense should come from auth session checks in the handler.
export function assertSameOrigin(request: Request, appUrl: string): void {
  const origin = request.headers.get("origin");
  if (!origin) return;
  try {
    if (new URL(origin).origin !== new URL(appUrl).origin) {
      throw new Error(`forbidden origin: ${origin}`);
    }
  } catch (e) {
    throw new Error(`invalid origin header: ${origin} (${String(e)})`);
  }
}
