import { describe, it, expect, vi, beforeEach } from "vitest";
import { redactEmail, sendEmail } from "./client";
import type { EmailEnv } from "./client";

// Mock @react-email/components render so we don't need a real React tree
vi.mock("@react-email/components", () => ({
  render: vi.fn().mockResolvedValue("<html><body>Hello</body></html>"),
}));

// Capture the send spy before the module under test instantiates Resend.
// We mock the constructor to store the spy on the instance so we can
// assert on call args after sendEmail runs.
const mockSend = vi.fn();
vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: { send: mockSend },
  })),
}));

const baseEnv: EmailEnv = {
  RESEND_API_KEY: "re_test_key",
  EMAIL_FROM: "noreply@example.com",
};

// Minimal React element — render is mocked so shape doesn't matter
const fakeReact = { type: "div", props: {}, key: null } as unknown as React.ReactElement;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("sendEmail", () => {
  it("returns { ok: false } without calling Resend when RESEND_API_KEY is unset", async () => {
    const env: EmailEnv = { EMAIL_FROM: "noreply@example.com" };
    const result = await sendEmail(env, {
      to: "user@test.com",
      subject: "Test",
      react: fakeReact,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/RESEND_API_KEY/);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("returns { ok: false } without calling Resend when EMAIL_FROM is unset", async () => {
    const env: EmailEnv = { RESEND_API_KEY: "re_test_key" };
    const result = await sendEmail(env, {
      to: "user@test.com",
      subject: "Test",
      react: fakeReact,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/EMAIL_FROM/);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("calls Resend with correct from/to/subject args on happy path", async () => {
    mockSend.mockResolvedValue({ data: { id: "email_123" }, error: null });

    const result = await sendEmail(baseEnv, {
      to: "alice@example.com",
      subject: "Purchase receipt",
      react: fakeReact,
      tag: "receipt",
    });

    expect(result.ok).toBe(true);
    expect(result.id).toBe("email_123");
    expect(mockSend).toHaveBeenCalledOnce();
    const callArgs = mockSend.mock.calls[0]![0];
    expect(callArgs.from).toBe("noreply@example.com");
    expect(callArgs.to).toBe("alice@example.com");
    expect(callArgs.subject).toBe("Purchase receipt");
    expect(callArgs.tags).toEqual([{ name: "template", value: "receipt" }]);
  });

  it("returns { ok: false, error } when Resend returns an error object (no throw)", async () => {
    mockSend.mockResolvedValue({ data: null, error: { message: "invalid_api_key" } });

    const result = await sendEmail(baseEnv, {
      to: "bob@example.com",
      subject: "Fail",
      react: fakeReact,
    });

    expect(result.ok).toBe(false);
    expect(result.error).toBe("invalid_api_key");
  });

  it("returns { ok: false, error } when Resend.send throws (network error)", async () => {
    mockSend.mockRejectedValue(new Error("network timeout"));

    const result = await sendEmail(baseEnv, {
      to: "charlie@example.com",
      subject: "Timeout",
      react: fakeReact,
    });

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/network timeout/);
  });

  it("uses EMAIL_REPLY_TO from env when no per-call replyTo provided", async () => {
    mockSend.mockResolvedValue({ data: { id: "email_456" }, error: null });
    const env: EmailEnv = {
      ...baseEnv,
      EMAIL_REPLY_TO: "support@example.com",
    };

    await sendEmail(env, { to: "user@example.com", subject: "Hi", react: fakeReact });

    const callArgs = mockSend.mock.calls[0]![0];
    expect(callArgs.replyTo).toBe("support@example.com");
  });

  it("per-call replyTo overrides EMAIL_REPLY_TO env", async () => {
    mockSend.mockResolvedValue({ data: { id: "email_789" }, error: null });
    const env: EmailEnv = {
      ...baseEnv,
      EMAIL_REPLY_TO: "support@example.com",
    };

    await sendEmail(env, {
      to: "user@example.com",
      subject: "Hi",
      react: fakeReact,
      replyTo: "override@example.com",
    });

    const callArgs = mockSend.mock.calls[0]![0];
    expect(callArgs.replyTo).toBe("override@example.com");
  });
});

describe("redactEmail", () => {
  it("keeps first char and domain, masks middle of local part", () => {
    expect(redactEmail("alice@example.com")).toBe("a****@example.com");
    expect(redactEmail("bob@foo.io")).toBe("b**@foo.io");
  });

  it("returns '***' for input without an @ symbol", () => {
    expect(redactEmail("notAnEmail")).toBe("***");
    expect(redactEmail("")).toBe("***");
  });

  it("masks at least 2 chars even for single-char local parts", () => {
    expect(redactEmail("x@y.com")).toBe("x**@y.com");
  });

  it("does not leak short local parts like 'ab'", () => {
    const result = redactEmail("ab@example.com");
    expect(result).toBe("a**@example.com");
    expect(result).not.toContain("ab");
  });
});
