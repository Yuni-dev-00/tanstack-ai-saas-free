import { describe, expect, it } from "vitest";
import {
  isBlockedEmailDomain,
  SIGNUP_IP_DEFAULT_LIMIT,
  SIGNUP_IP_WINDOW_SEC,
} from "./signup-guard";

describe("isBlockedEmailDomain", () => {
  it("blocks known disposable domains", () => {
    expect(isBlockedEmailDomain("kennethkelley74067@smaqt.com")).toBe(true);
    expect(isBlockedEmailDomain("someone@mailinator.com")).toBe(true);
    expect(isBlockedEmailDomain("a@yopmail.com")).toBe(true);
  });

  it("is case-insensitive and trims whitespace around the domain", () => {
    expect(isBlockedEmailDomain("user@SMAQT.COM")).toBe(true);
    expect(isBlockedEmailDomain("user@ smaqt.com ")).toBe(true);
  });

  it("blocks subdomains of a blocked domain", () => {
    expect(isBlockedEmailDomain("user@mail.smaqt.com")).toBe(true);
  });

  it("allows normal providers", () => {
    expect(isBlockedEmailDomain("user@gmail.com")).toBe(false);
    expect(isBlockedEmailDomain("user@hotmail.com")).toBe(false);
    expect(isBlockedEmailDomain("user@company.co.uk")).toBe(false);
  });

  it("does not block the anonymous-plugin synthetic domain", () => {
    expect(isBlockedEmailDomain("temp-abc123@anon.local")).toBe(false);
  });

  it("does not false-positive on lookalike domains", () => {
    // suffix match must be label-aligned, not substring
    expect(isBlockedEmailDomain("user@notsmaqt.com")).toBe(false);
    expect(isBlockedEmailDomain("user@smaqt.company.com")).toBe(false);
  });

  it("handles malformed input without throwing", () => {
    expect(isBlockedEmailDomain("")).toBe(false);
    expect(isBlockedEmailDomain("no-at-sign")).toBe(false);
    expect(isBlockedEmailDomain("trailing@")).toBe(false);
  });
});

describe("signup IP cap constants", () => {
  it("keeps the documented defaults", () => {
    expect(SIGNUP_IP_DEFAULT_LIMIT).toBe(3);
    expect(SIGNUP_IP_WINDOW_SEC).toBe(86400);
  });
});
