import { Resend } from "resend";
import { render } from "@react-email/components";
import type { ReactElement } from "react";
import { log, errorMessage } from "@/lib/log";

let _resend: Resend | null = null;
let _resendKey: string | null = null;
export function getResend(apiKey: string): Resend {
  if (_resend && _resendKey === apiKey) return _resend;
  _resend = new Resend(apiKey);
  _resendKey = apiKey;
  return _resend;
}

// Thin wrapper around Resend. Templates pass a React element; we pre-render
// to HTML + text here so failures surface in our logs rather than inside
// Resend's retry loop (which is invisible to us).
//
// Env is passed explicitly instead of imported from `cloudflare:workers` so
// this file stays importable from unit tests that build a mock env.

export interface EmailEnv {
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  EMAIL_REPLY_TO?: string;
}

export interface SendEmailArgs {
  to: string;
  subject: string;
  react: ReactElement;
  replyTo?: string;
  // Optional tag for Resend analytics — also logged locally so we can
  // correlate "email failed" reports back to the transactional flow.
  tag?: string;
}

export interface SendEmailResult {
  ok: boolean;
  id?: string;
  error?: string;
}

export async function sendEmail(
  env: EmailEnv,
  args: SendEmailArgs,
): Promise<SendEmailResult> {
  if (!env.RESEND_API_KEY) {
    log("warn", "email.send.skipped", {
      reason: "RESEND_API_KEY missing",
      to: redactEmail(args.to),
      subject: args.subject,
      tag: args.tag,
    });
    return { ok: false, error: "RESEND_API_KEY missing" };
  }
  if (!env.EMAIL_FROM) {
    log("warn", "email.send.skipped", {
      reason: "EMAIL_FROM missing",
      to: redactEmail(args.to),
      subject: args.subject,
      tag: args.tag,
    });
    return { ok: false, error: "EMAIL_FROM missing" };
  }

  const [html, text] = await Promise.all([
    render(args.react),
    render(args.react, { plainText: true }),
  ]);

  const resend = getResend(env.RESEND_API_KEY);
  try {
    const { data, error } = await resend.emails.send({
      from: env.EMAIL_FROM,
      to: args.to,
      subject: args.subject,
      html,
      text,
      replyTo: args.replyTo ?? env.EMAIL_REPLY_TO,
      tags: args.tag ? [{ name: "template", value: args.tag }] : undefined,
    });
    if (error) {
      log("warn", "email.send.failed", {
        to: redactEmail(args.to),
        subject: args.subject,
        tag: args.tag,
        error: error.message,
      });
      return { ok: false, error: error.message };
    }
    log("info", "email.send.ok", {
      to: redactEmail(args.to),
      subject: args.subject,
      tag: args.tag,
      id: data?.id,
    });
    return { ok: true, id: data?.id };
  } catch (err) {
    const msg = errorMessage(err);
    log("warn", "email.send.threw", {
      to: redactEmail(args.to),
      subject: args.subject,
      tag: args.tag,
      error: msg,
    });
    return { ok: false, error: msg };
  }
}

// Keep raw addresses out of logs. `a***@example.com` style — enough to
// correlate during debugging without storing PII.
export function redactEmail(addr: string): string {
  const at = addr.indexOf("@");
  if (at <= 0) return "***";
  const local = addr.slice(0, at);
  const domain = addr.slice(at + 1);
  const head = local.slice(0, 1);
  return `${head}${"*".repeat(Math.max(2, local.length - 1))}@${domain}`;
}
