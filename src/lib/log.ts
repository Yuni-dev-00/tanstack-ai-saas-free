// Structured JSON logger for CF Workers. Each request carries a short
// `requestId` threaded through x-request-id headers both inbound and outbound,
// so logs across our Worker, GlitchTip, and provider webhook callbacks
// can be tied together.
//
// Module-scoped `logContext` carries fields that should be on EVERY log line
// for the lifetime of the Worker isolate (build version, git commit, region,
// …). server.ts calls `setLogContext` on first request after reading env.
// Per-request fields (requestId, jobId, …) come in via the per-call `fields`
// arg and override matching context keys for that one line.

export type LogLevel = "debug" | "info" | "warn" | "error";
export type LogFields = Record<string, unknown> & { requestId?: string };

let logContext: Record<string, unknown> = {};

export function setLogContext(ctx: Record<string, unknown>): void {
  // Drop undefined entries so they don't override real context already
  // installed by an earlier request in the same isolate.
  const filtered: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(ctx)) {
    if (v !== undefined && v !== null && v !== "") filtered[k] = v;
  }
  logContext = { ...logContext, ...filtered };
}

export function getLogContext(): Readonly<Record<string, unknown>> {
  return logContext;
}

// Test-only: forget any context the previous test installed.
export function _resetLogContextForTest(): void {
  logContext = {};
}

export function log(level: LogLevel, message: string, fields: LogFields = {}): void {
  const payload = {
    ts: new Date().toISOString(),
    level,
    message,
    ...logContext,
    ...fields,
  };
  let line: string;
  try {
    line = JSON.stringify(payload);
  } catch {
    // JSON.stringify threw (circular ref or BigInt) — emit a stripped fallback line so we don't lose the message.
    line = JSON.stringify({ ts: payload.ts, level, message, err: "log-serialize-failed" });
  }
  const SINK: Record<LogLevel, (line: string) => void> = {
    error: console.error,
    warn: console.warn,
    debug: console.debug,
    info: console.info,
  };
  SINK[level](line);
}

// 12 hex chars, URL-safe, low-collision enough for our volume (≤ millions/day).
export function newRequestId(): string {
  const b = crypto.getRandomValues(new Uint8Array(6));
  let s = "";
  for (let i = 0; i < b.length; i++) s += (b[i]! < 16 ? "0" : "") + b[i]!.toString(16);
  return s;
}

// Defensive: accept the incoming x-request-id only if it looks sane
// (short, printable ASCII). Otherwise generate our own.
export function getOrCreateRequestId(request: Request): string {
  const raw = request.headers.get("x-request-id");
  if (raw && raw.length > 0 && raw.length <= 128 && /^[!-~]+$/.test(raw)) {
    return raw;
  }
  return newRequestId();
}

// Coerce an unknown thrown value (caught from try/catch) into a message string.
// Use instead of the `err instanceof Error ? err.message : String(err)` boilerplate.
export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
