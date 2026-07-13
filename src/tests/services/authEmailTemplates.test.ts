import { describe, expect, it } from "vitest";
import { accountSetupTemplate, passwordChangedTemplate, passwordResetOtpTemplate } from "../../server/services/authEmailTemplates";
import { outreachEmailTemplate } from "../../server/services/outreachEmailTemplates";

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
    expect(rendered.html).toContain("SSAMENJ Technologies");
    expect(rendered.html).toContain("Paperless school systems for modern schools");
    expect(rendered.html).toContain("Continue");
    expect(rendered.html).toContain("123456");
    expect(rendered.text).toContain("https://app.example.com/account/setup?token=raw-token");
    expect(rendered.text).toContain("123456");
    expect(rendered.text).toContain("support@ssamenj.online");
    expect(rendered.text).toContain("P.O. Box 211144, Kampala GPO");
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
    expect(rendered.html).toContain("Open Report Lab");
    expect(rendered.html).toContain("https://ssamenj.online/ssamenj-logo.png");
    expect(rendered.html).toContain("If you did not request this, you can ignore this email.");
    expect(rendered.text).toContain("If you did not request this, you can ignore this email.");
    expect(rendered.text).toContain("Products: School Connect | Report Lab | Kids Wallet | Smart Pages");
  });

  it("renders password changed confirmation with timestamp", () => {
    const rendered = passwordChangedTemplate({
      recipientName: "Amina",
      changedAt: new Date("2026-07-13T09:30:00.000Z"),
    });

    expect(rendered.subject).toBe("Your SSAMENJ password was changed");
    expect(rendered.text).toContain("2026-07-13T09:30:00.000Z");
    expect(rendered.html).toContain("support@ssamenj.online");
  });

  it("uses a public logo URL when configured and never falls back to localhost", () => {
    const rendered = accountSetupTemplate(
      {
        recipientName: "Amina",
        schoolName: "Nalya School",
        inviterName: "your school administrator",
        setupUrl: "https://app.example.com/account/setup?token=raw-token",
        setupCode: "123456",
        expiresHours: 24,
      },
      {
        logoUrl: "http://localhost:3000/logo.png",
      },
    );

    expect(rendered.html).not.toContain("localhost:3000/logo.png");
    expect(rendered.html).toContain("https://ssamenj.online/ssamenj-logo.png");
  });

  it("renders outreach branding with a demo CTA and footer contacts", () => {
    const rendered = outreachEmailTemplate({
      recipientName: "School Admin",
      subject: "Request a demo",
      message: "We would love to show you how SSAMENJ works for your school.",
      ctaLabel: "Request Demo",
      ctaUrl: "https://ssamenj.online/contact",
    });

    expect(rendered.html).toContain("Request Demo");
    expect(rendered.html).toContain("SSAMENJ Technologies Ltd");
    expect(rendered.html).toContain("School Connect wristband");
    expect(rendered.html).toContain("Tracks attendance fast, does not need a battery");
    expect(rendered.text).toContain("Request Demo: https://ssamenj.online/contact");
    expect(rendered.text).toContain("School Connect | Report Lab | Kids Wallet | Smart Pages");
    expect(rendered.text).toContain("Tracks attendance fast, does not need a battery");
  });
});
