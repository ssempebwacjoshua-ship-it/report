import { describe, expect, it } from "vitest";
import { accountSetupTemplate, passwordChangedTemplate, passwordResetOtpTemplate } from "../../server/services/authEmailTemplates";

describe("authEmailTemplates", () => {
  it("renders account setup HTML and text without internal ids", () => {
    const rendered = accountSetupTemplate({
      recipientName: "Amina",
      schoolName: "Nalya School",
      inviterName: "your school administrator",
      setupUrl: "https://app.example.com/account/setup?token=raw-token",
      setupCode: "123456",
      expiresHours: 24,
    });

    expect(rendered.subject).toBe("Set up your SSAMENJ Report Lab account");
    expect(rendered.html).toContain("Set up account");
    expect(rendered.html).toContain("123456");
    expect(rendered.text).toContain("https://app.example.com/account/setup?token=raw-token");
    expect(rendered.text).toContain("123456");
    expect(rendered.html).not.toContain("user-");
  });

  it("renders password reset OTP security warning in HTML and text", () => {
    const rendered = passwordResetOtpTemplate({
      recipientName: "Amina",
      otp: "123456",
      resetUrl: "https://app.example.com/reset-password?schoolCode=SCU-PREVIEW&email=amina%40example.com",
      expiresMinutes: 15,
    });

    expect(rendered.subject).toBe("Your SSAMENJ Report Lab password reset code");
    expect(rendered.html).toContain("123456");
    expect(rendered.html).toContain("reset-password");
    expect(rendered.html).toContain("If you did not request this, you can ignore this email.");
    expect(rendered.text).toContain("If you did not request this, you can ignore this email.");
  });

  it("renders password changed confirmation with timestamp", () => {
    const rendered = passwordChangedTemplate({
      recipientName: "Amina",
      changedAt: new Date("2026-07-13T09:30:00.000Z"),
    });

    expect(rendered.subject).toBe("Your SSAMENJ password was changed");
    expect(rendered.text).toContain("2026-07-13T09:30:00.000Z");
  });
});
