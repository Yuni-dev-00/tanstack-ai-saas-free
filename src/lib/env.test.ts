import { describe, it, expect } from "vitest";
import { parseEnv } from "./env";

const validEnv = {
  APP_URL: "http://localhost:3000",
  BETTER_AUTH_SECRET: "a".repeat(32),
  BETTER_AUTH_URL: "http://localhost:3000",
  DATABASE_URL: "postgresql://u:p@host/db",
  GOOGLE_CLIENT_ID: "x",
  GOOGLE_CLIENT_SECRET: "x",
  RESEND_API_KEY: "x",
  EMAIL_FROM: "x@example.com",
  R2_ACCOUNT_ID: "x",
  R2_ACCESS_KEY_ID: "x",
  R2_SECRET_ACCESS_KEY: "x",
  R2_BUCKET: "x",
  R2_PUBLIC_BASE: "https://cdn.example.com",
  SENTRY_DSN: "",
  PLAUSIBLE_DOMAIN: "",
  PLAUSIBLE_SCRIPT_URL: "https://analytics.example.com/js.js",
  PLAUSIBLE_SCRIPT_SRI: "",
  APP_VERSION: "",
  GIT_COMMIT: "",
};

describe("parseEnv", () => {
  it("accepts a fully-formed env object", () => {
    const parsed = parseEnv(validEnv);
    expect(parsed.APP_URL).toBe("http://localhost:3000");
    expect(parsed.BETTER_AUTH_SECRET.length).toBe(32);
  });

  it("rejects missing BETTER_AUTH_SECRET with a clear error naming the key", () => {
    const { BETTER_AUTH_SECRET: _BETTER_AUTH_SECRET, ...rest } = validEnv;
    expect(() => parseEnv(rest)).toThrow(/BETTER_AUTH_SECRET/);
  });

  it("rejects non-URL APP_URL with a clear error", () => {
    expect(() => parseEnv({ ...validEnv, APP_URL: "not-a-url" })).toThrow(/APP_URL/);
  });

  it("rejects DATABASE_URL without postgresql:// prefix", () => {
    expect(() => parseEnv({ ...validEnv, DATABASE_URL: "mysql://x/y" })).toThrow(/DATABASE_URL/);
  });

  it("rejects BETTER_AUTH_SECRET shorter than 32 chars", () => {
    expect(() => parseEnv({ ...validEnv, BETTER_AUTH_SECRET: "short" })).toThrow(/BETTER_AUTH_SECRET/);
  });
});
