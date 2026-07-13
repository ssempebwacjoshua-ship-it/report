import { describe, expect, it } from "vitest";
import { isAuthEmailConfigured, sendAuthEmail } from "../../server/services/emailService";

describe("emailService", () => {
  it("fails safely when Resend auth email configuration is missing", async () => {
    const previous = {
      RESEND_API_KEY: process.env.RESEND_API_KEY,
      AUTH_EMAIL_FROM: process.env.AUTH_EMAIL_FROM,
      EMAIL_FROM: process.env.EMAIL_FROM,
      RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL,
      APP_PUBLIC_URL: process.env.APP_PUBLIC_URL,
      PUBLIC_APP_URL: process.env.PUBLIC_APP_URL,
      APP_URL: process.env.APP_URL,
    };
    delete process.env.RESEND_API_KEY;
    delete process.env.AUTH_EMAIL_FROM;
    delete process.env.EMAIL_FROM;
    delete process.env.RESEND_FROM_EMAIL;
    delete process.env.APP_PUBLIC_URL;
    delete process.env.PUBLIC_APP_URL;
    delete process.env.APP_URL;

    expect(isAuthEmailConfigured()).toBe(false);
    await expect(sendAuthEmail({
      to: "admin@example.com",
      subject: "Test",
      html: "<p>Test</p>",
      text: "Test",
    })).resolves.toEqual({ ok: false, provider: "NONE", reason: "NOT_CONFIGURED" });

    process.env.RESEND_API_KEY = previous.RESEND_API_KEY;
    process.env.AUTH_EMAIL_FROM = previous.AUTH_EMAIL_FROM;
    process.env.EMAIL_FROM = previous.EMAIL_FROM;
    process.env.RESEND_FROM_EMAIL = previous.RESEND_FROM_EMAIL;
    process.env.APP_PUBLIC_URL = previous.APP_PUBLIC_URL;
    process.env.PUBLIC_APP_URL = previous.PUBLIC_APP_URL;
    process.env.APP_URL = previous.APP_URL;
  });

  it("accepts the documented auth email aliases", () => {
    expect(isAuthEmailConfigured({
      RESEND_API_KEY: "resend-key",
      EMAIL_FROM: "SSAMENJ <no-reply@example.com>",
      PUBLIC_APP_URL: "https://ssamenj.online/report-lab",
    })).toBe(true);
    expect(isAuthEmailConfigured({
      RESEND_API_KEY: "resend-key",
      RESEND_FROM_EMAIL: "SSAMENJ <no-reply@example.com>",
      APP_URL: "https://ssamenj.online/report-lab",
    })).toBe(true);
  });
});
