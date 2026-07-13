import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const resendInstances: Array<{ emails: { send: ReturnType<typeof vi.fn> } }> = [];
let resendSendResult: { data: { id: string } | null; error: null | { name: string; message: string; statusCode: number | null }; headers: Record<string, string> } = {
  data: { id: "msg-1" },
  error: null,
  headers: {},
};

vi.mock("resend", () => ({
  Resend: class MockResend {
    emails = {
      send: vi.fn(async () => resendSendResult),
    };

    constructor(apiKey: string) {
      resendInstances.push(this);
      void apiKey;
    }
  },
}));

import { configuredAuthEmailProvider, isAuthEmailConfigured, sendAuthEmail } from "../../server/services/emailService";

describe("emailService", () => {
  const previousEnv = {
    AUTH_EMAIL_PROVIDER: process.env.AUTH_EMAIL_PROVIDER,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    AUTH_EMAIL_FROM: process.env.AUTH_EMAIL_FROM,
    EMAIL_FROM: process.env.EMAIL_FROM,
    RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL,
    AUTH_EMAIL_REPLY_TO: process.env.AUTH_EMAIL_REPLY_TO,
    APP_PUBLIC_URL: process.env.APP_PUBLIC_URL,
    PUBLIC_APP_URL: process.env.PUBLIC_APP_URL,
    APP_URL: process.env.APP_URL,
    APP_BASE_URL: process.env.APP_BASE_URL,
  };

  beforeEach(() => {
    resendInstances.length = 0;
    resendSendResult = {
      data: { id: "msg-1" },
      error: null,
      headers: {},
    };
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env.AUTH_EMAIL_PROVIDER = previousEnv.AUTH_EMAIL_PROVIDER;
    process.env.RESEND_API_KEY = previousEnv.RESEND_API_KEY;
    process.env.AUTH_EMAIL_FROM = previousEnv.AUTH_EMAIL_FROM;
    process.env.EMAIL_FROM = previousEnv.EMAIL_FROM;
    process.env.RESEND_FROM_EMAIL = previousEnv.RESEND_FROM_EMAIL;
    process.env.AUTH_EMAIL_REPLY_TO = previousEnv.AUTH_EMAIL_REPLY_TO;
    process.env.APP_PUBLIC_URL = previousEnv.APP_PUBLIC_URL;
    process.env.PUBLIC_APP_URL = previousEnv.PUBLIC_APP_URL;
    process.env.APP_URL = previousEnv.APP_URL;
    process.env.APP_BASE_URL = previousEnv.APP_BASE_URL;
  });

  it("fails safely when the Resend API key is missing", async () => {
    process.env.AUTH_EMAIL_PROVIDER = "RESEND";
    delete process.env.RESEND_API_KEY;
    process.env.AUTH_EMAIL_FROM = "SSAMENJ Team <no-reply@notify.ssamenj.online>";
    process.env.APP_PUBLIC_URL = "https://ssamenj.online/report-lab";

    expect(configuredAuthEmailProvider()).toBe("RESEND");
    expect(isAuthEmailConfigured()).toBe(false);

    await expect(sendAuthEmail({
      to: "admin@example.com",
      subject: "Test",
      html: "<p>Test</p>",
      text: "Test",
    })).resolves.toEqual({
      ok: false,
      provider: "NONE",
      reason: "NOT_CONFIGURED",
      safeErrorCode: "missing_api_key",
      safeErrorMessage: "RESEND_API_KEY is missing.",
    });
  });

  it("fails safely when AUTH_EMAIL_FROM is missing", async () => {
    process.env.AUTH_EMAIL_PROVIDER = "RESEND";
    process.env.RESEND_API_KEY = "resend-key";
    delete process.env.AUTH_EMAIL_FROM;
    delete process.env.EMAIL_FROM;
    delete process.env.RESEND_FROM_EMAIL;
    process.env.APP_PUBLIC_URL = "https://ssamenj.online/report-lab";

    expect(isAuthEmailConfigured()).toBe(false);

    await expect(sendAuthEmail({
      to: "admin@example.com",
      subject: "Test",
      html: "<p>Test</p>",
      text: "Test",
    })).resolves.toEqual({
      ok: false,
      provider: "NONE",
      reason: "NOT_CONFIGURED",
      safeErrorCode: "missing_auth_email_from",
      safeErrorMessage: "AUTH_EMAIL_FROM is missing.",
    });
  });

  it("logs safe Resend validation details and returns a sender/domain error when the sender is unverified", async () => {
    process.env.AUTH_EMAIL_PROVIDER = "RESEND";
    process.env.RESEND_API_KEY = "resend-key";
    process.env.AUTH_EMAIL_FROM = "SSAMENJ Team <no-reply@notify.ssamenj.online>";
    process.env.APP_PUBLIC_URL = "https://ssamenj.online/report-lab";
    process.env.AUTH_EMAIL_REPLY_TO = "support@ssamenj.online";
    resendSendResult = {
      data: null,
      error: {
        name: "validation_error",
        message: "The from address is not verified.",
        statusCode: 400,
      },
      headers: {},
    };

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    await expect(sendAuthEmail({
      to: "recipient@gmail.com",
      subject: "Test",
      html: "<p>Test</p>",
      text: "Test",
    })).resolves.toEqual({
      ok: false,
      provider: "RESEND",
      reason: "SEND_FAILED",
      safeErrorCode: "sender_domain_not_verified",
      safeErrorMessage: "Email provider sender/domain is not verified.",
      safeStatusCode: 400,
    });

    const instance = resendInstances[0];
    expect(instance).toBeTruthy();
    expect(instance.emails.send).toHaveBeenCalledWith(expect.objectContaining({
      from: "SSAMENJ Team <no-reply@notify.ssamenj.online>",
      to: "recipient@gmail.com",
      subject: "Test",
      html: "<p>Test</p>",
      text: "Test",
      replyTo: "support@ssamenj.online",
    }));
    expect(warnSpy).toHaveBeenCalledWith("[auth-email-send-failed]", expect.objectContaining({
      provider: "RESEND",
      code: "validation_error",
      message: "The from address is not verified.",
      statusCode: 400,
      recipientDomain: "gmail.com",
    }));
  });

  it("accepts the documented auth email aliases", () => {
    expect(isAuthEmailConfigured({
      AUTH_EMAIL_PROVIDER: "RESEND",
      RESEND_API_KEY: "resend-key",
      EMAIL_FROM: "SSAMENJ <no-reply@example.com>",
      PUBLIC_APP_URL: "https://ssamenj.online/report-lab",
    })).toBe(true);
    expect(isAuthEmailConfigured({
      AUTH_EMAIL_PROVIDER: "RESEND",
      RESEND_API_KEY: "resend-key",
      RESEND_FROM_EMAIL: "SSAMENJ <no-reply@example.com>",
      APP_URL: "https://ssamenj.online/report-lab",
    })).toBe(true);
  });
});
