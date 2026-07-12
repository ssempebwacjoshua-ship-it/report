import { describe, expect, it } from "vitest";
import { isAuthEmailConfigured, sendAuthEmail } from "../../server/services/emailService";

describe("emailService", () => {
  it("fails safely when Resend auth email configuration is missing", async () => {
    const previous = {
      RESEND_API_KEY: process.env.RESEND_API_KEY,
      AUTH_EMAIL_FROM: process.env.AUTH_EMAIL_FROM,
      APP_PUBLIC_URL: process.env.APP_PUBLIC_URL,
    };
    delete process.env.RESEND_API_KEY;
    delete process.env.AUTH_EMAIL_FROM;
    delete process.env.APP_PUBLIC_URL;

    expect(isAuthEmailConfigured()).toBe(false);
    await expect(sendAuthEmail({
      to: "admin@example.com",
      subject: "Test",
      html: "<p>Test</p>",
      text: "Test",
    })).resolves.toEqual({ ok: false, provider: "NONE", reason: "NOT_CONFIGURED" });

    process.env.RESEND_API_KEY = previous.RESEND_API_KEY;
    process.env.AUTH_EMAIL_FROM = previous.AUTH_EMAIL_FROM;
    process.env.APP_PUBLIC_URL = previous.APP_PUBLIC_URL;
  });
});

