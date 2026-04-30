// Shared cookie helpers for server-side request parsing.

// Parse a single named cookie from a raw Cookie header string.
// Returns null when the header is absent or the name is not found.
export function parseCookieHeader(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const k = part.slice(0, eq).trim();
    if (k === name) return decodeURIComponent(part.slice(eq + 1).trim());
  }
  return null;
}

// Read a single named cookie from a Request's Cookie header.
export function getRequestCookie(request: Request, name: string): string | null {
  return parseCookieHeader(request.headers.get("cookie"), name);
}
