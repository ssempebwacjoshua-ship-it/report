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

import {
  configuredAuthEmailProvider,
  configuredCompanyReplyTo,
  configuredCompanySender,
  isAuthEmailConfigured,
  OFFICIAL_COMPANY_OUTREACH_SENDER,
  OFFICIAL_SUPPORT_EMAIL,
  sendAuthEmail,
  sendOutreachEmail,
} from "../../server/services/emailService";

describe("emailService", () => {
  const previousEnv = {
    AUTH_EMAIL_PROVIDER: process.env.AUTH_EMAIL_PROVIDER,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    AUTH_EMAIL_FROM: process.env.AUTH_EMAIL_FROM,
    EMAIL_FROM: process.env.EMAIL_FROM,
    RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL,
    OUTREACH_EMAIL_FROM: process.env.OUTREACH_EMAIL_FROM,
    OUTREACH_REPLY_TO: process.env.OUTREACH_REPLY_TO,
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
    process.env.OUTREACH_EMAIL_FROM = previousEnv.OUTREACH_EMAIL_FROM;
    process.env.OUTREACH_REPLY_TO = previousEnv.OUTREACH_REPLY_TO;
    process.env.AUTH_EMAIL_REPLY_TO = previousEnv.AUTH_EMAIL_REPLY_TO;
    process.env.APP_PUBLIC_URL = previousEnv.APP_PUBLIC_URL;
    process.env.PUBLIC_APP_URL = previousEnv.PUBLIC_APP_URL;
    process.env.APP_URL = previousEnv.APP_URL;
    process.env.APP_BASE_URL = previousEnv.APP_BASE_URL;
  });

  it("fails safely when the Resend API key is missing", async () => {
    process.env.AUTH_EMAIL_PROVIDER = "RESEND";
    delete process.env.RESEND_API_KEY;
    process.env.AUTH_EMAIL_FROM = "SSAMENJ Report Lab <support@ssamenj.online>";
    delete process.env.OUTREACH_EMAIL_FROM;
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
    delete process.env.OUTREACH_EMAIL_FROM;
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
    process.env.AUTH_EMAIL_FROM = "SSAMENJ Report Lab <support@ssamenj.online>";
    delete process.env.OUTREACH_EMAIL_FROM;
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
      from: "SSAMENJ Report Lab <support@ssamenj.online>",
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

  it("prefers the company outreach sender when available", () => {
    process.env.OUTREACH_EMAIL_FROM = "SSAMENJ Technologies <support@ssamenj.online>";
    process.env.AUTH_EMAIL_FROM = "SSAMENJ Report Lab <support@ssamenj.online>";

    expect(configuredCompanySender()).toBe("SSAMENJ Technologies <support@ssamenj.online>");
  });

  it("falls back to the official company outreach sender when the env var is absent", () => {
    delete process.env.OUTREACH_EMAIL_FROM;

    expect(configuredCompanySender()).toBe(OFFICIAL_COMPANY_OUTREACH_SENDER);
  });

  it("prefers the company outreach reply-to when available", () => {
    process.env.OUTREACH_REPLY_TO = "support@ssamenj.online";
    process.env.AUTH_EMAIL_REPLY_TO = "reply@fallback.example.com";

    expect(configuredCompanyReplyTo()).toBe("support@ssamenj.online");
  });

  it("falls back to the official support reply-to when outreach reply-to is absent", () => {
    delete process.env.OUTREACH_REPLY_TO;
    delete process.env.AUTH_EMAIL_REPLY_TO;

    expect(configuredCompanyReplyTo()).toBe(OFFICIAL_SUPPORT_EMAIL);
  });

  it("fails safely when outreach sender is missing", async () => {
    process.env.AUTH_EMAIL_PROVIDER = "RESEND";
    process.env.RESEND_API_KEY = "resend-key";
    delete process.env.OUTREACH_EMAIL_FROM;
    delete process.env.OUTREACH_REPLY_TO;
    process.env.APP_PUBLIC_URL = "https://ssamenj.online/report-lab";

    await expect(sendOutreachEmail({
      to: "admin@example.com",
      subject: "Outreach",
      html: "<p>Outreach</p>",
      text: "Outreach",
    })).resolves.toEqual({
      ok: false,
      provider: "NONE",
      reason: "NOT_CONFIGURED",
      safeErrorCode: "missing_outreach_email_from",
      safeErrorMessage: "OUTREACH_EMAIL_FROM is missing.",
    });
  });

  it("fails safely when outreach sender is unsafe", async () => {
    process.env.AUTH_EMAIL_PROVIDER = "RESEND";
    process.env.RESEND_API_KEY = "resend-key";
    process.env.OUTREACH_EMAIL_FROM = "Joshua <ssempebwacjoshua@gmail.com>";
    process.env.OUTREACH_REPLY_TO = "support@ssamenj.online";
    process.env.APP_PUBLIC_URL = "https://ssamenj.online/report-lab";

    await expect(sendOutreachEmail({
      to: "admin@example.com",
      subject: "Outreach",
      html: "<p>Outreach</p>",
      text: "Outreach",
    })).resolves.toEqual({
      ok: false,
      provider: "NONE",
      reason: "NOT_CONFIGURED",
      safeErrorCode: "invalid_outreach_email_from",
      safeErrorMessage: "OUTREACH_EMAIL_FROM is invalid. Use email@example.com or Name <email@example.com>.",
    });
  });

  it("normalizes quoted sender values before sending", async () => {
    process.env.AUTH_EMAIL_PROVIDER = "RESEND";
    process.env.RESEND_API_KEY = "resend-key";
    process.env.AUTH_EMAIL_FROM = '"SSAMENJ Report Lab <support@ssamenj.online>"';
    delete process.env.OUTREACH_EMAIL_FROM;
    process.env.APP_PUBLIC_URL = "https://ssamenj.online/report-lab";

    await expect(sendAuthEmail({
      to: "recipient@gmail.com",
      subject: "Test",
      html: "<p>Test</p>",
      text: "Test",
    })).resolves.toEqual({
      ok: true,
      provider: "RESEND",
      messageId: "msg-1",
    });

    const instance = resendInstances[0];
    expect(instance.emails.send).toHaveBeenCalledWith(expect.objectContaining({
      from: "SSAMENJ Report Lab <support@ssamenj.online>",
    }));
  });

  it("fails safely when AUTH_EMAIL_FROM is malformed", async () => {
    process.env.AUTH_EMAIL_PROVIDER = "RESEND";
    process.env.RESEND_API_KEY = "resend-key";
    process.env.AUTH_EMAIL_FROM = "SSAMENJ Report Lab support@ssamenj.online";
    delete process.env.OUTREACH_EMAIL_FROM;
    process.env.APP_PUBLIC_URL = "https://ssamenj.online/report-lab";

    await expect(sendAuthEmail({
      to: "recipient@gmail.com",
      subject: "Test",
      html: "<p>Test</p>",
      text: "Test",
    })).resolves.toEqual({
      ok: false,
      provider: "NONE",
      reason: "NOT_CONFIGURED",
      safeErrorCode: "invalid_auth_email_from",
      safeErrorMessage: "AUTH_EMAIL_FROM is invalid. Use email@example.com or Name <email@example.com>.",
    });
  });
});
