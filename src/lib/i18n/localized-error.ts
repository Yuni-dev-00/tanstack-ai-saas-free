import {
  getMessages,
  resolveLocale,
  t,
  type MessageKey,
} from "./resolver";

export const ErrorCode = {
  UNAUTHORIZED: "errors.unauthorized",
  RATE_LIMITED: "errors.rateLimited",
  NOT_AUTHORIZED: "errors.notAuthorized",
} as const;

export type ErrorCodeValue = (typeof ErrorCode)[keyof typeof ErrorCode];

export function localizedError(
  request: Request,
  key: MessageKey,
  vars?: Record<string, string | number>,
): Error {
  const locale = resolveLocale(request);
  const messages = getMessages(locale);
  return new Error(`[${key}] ${t(messages, key, vars)}`);
}

export function parseErrorCode(message: string): ErrorCodeValue | null {
  const match = message.match(/^\[([^\]]+)\]/);
  return match ? (match[1] as ErrorCodeValue) : null;
}
