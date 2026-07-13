import type { EmailBranding } from "./emailBranding";
import { renderBrandedEmail, renderBrandedPlainText } from "./emailBranding";

type TemplateOptions = {
  branding?: Partial<EmailBranding>;
  env?: NodeJS.ProcessEnv;
};

export function accountSetupTemplate(
  input: { recipientName: string; schoolName: string; inviterName: string; setupUrl: string; setupCode: string; expiresHours: number },
  options: TemplateOptions = {},
) {
  const subject = "Set up your SSAMENJ Report Lab account";
  const bodyText = `Hello ${input.recipientName},\n\n${input.inviterName} invited you to ${input.schoolName} on SSAMENJ.\n\nYour setup code is: ${input.setupCode}\n\nContinue here: ${input.setupUrl}\n\nThis setup link expires in ${input.expiresHours} hours.\n\nIf you did not expect this invitation, do not share the code.`;
  const bodyHtml = `<p>Hello ${escapeHtml(input.recipientName)},</p><p>${escapeHtml(input.inviterName)} invited you to ${escapeHtml(input.schoolName)} on SSAMENJ.</p><p>Your setup code is:</p><p style="font-size:28px;letter-spacing:6px;font-weight:800;color:#173a72">${escapeHtml(input.setupCode)}</p><p>This setup link expires in ${input.expiresHours} hours.</p><p>Use the button below or paste this URL into your browser:</p><p style="word-break:break-all;color:#334155">${escapeHtml(input.setupUrl)}</p><p>If you did not expect this invitation, do not share the code.</p>`;
  return {
    subject,
    html: renderBrandedEmail({
      title: subject,
      bodyHtml,
      bodyText,
      ctaLabel: "Continue",
      ctaUrl: input.setupUrl,
      branding: options.branding,
      env: options.env,
    }),
    text: renderBrandedPlainText({
      title: subject,
      bodyText,
      ctaLabel: "Continue",
      ctaUrl: input.setupUrl,
      branding: options.branding,
      env: options.env,
    }),
  };
}

export function passwordResetOtpTemplate(
  input: { recipientName: string; otp: string; resetUrl: string; expiresMinutes: number },
  options: TemplateOptions = {},
) {
  const subject = "Your SSAMENJ Report Lab password reset code";
  const bodyText = `Hello ${input.recipientName},\n\nWe received a request to reset your SSAMENJ Report Lab password.\n\nYour reset code is: ${input.otp}\n\nOpen Report Lab: ${input.resetUrl}\n\nThis code expires in ${input.expiresMinutes} minutes.\n\nIf you did not request this, you can ignore this email.`;
  const bodyHtml = `<p>Hello ${escapeHtml(input.recipientName)},</p><p>We received a request to reset your SSAMENJ Report Lab password.</p><p>Your reset code is:</p><p style="font-size:28px;letter-spacing:6px;font-weight:800;color:#173a72">${escapeHtml(input.otp)}</p><p>This code expires in ${input.expiresMinutes} minutes.</p><p>Use this link if you would rather open the reset page directly:</p><p style="word-break:break-all;color:#334155">${escapeHtml(input.resetUrl)}</p><p>If you did not request this, you can ignore this email.</p>`;
  return {
    subject,
    html: renderBrandedEmail({
      title: subject,
      bodyHtml,
      bodyText,
      ctaLabel: "Open Report Lab",
      ctaUrl: input.resetUrl,
      branding: options.branding,
      env: options.env,
    }),
    text: renderBrandedPlainText({
      title: subject,
      bodyText,
      ctaLabel: "Open Report Lab",
      ctaUrl: input.resetUrl,
      branding: options.branding,
      env: options.env,
    }),
  };
}

export function passwordChangedTemplate(input: { recipientName: string; changedAt: Date }, options: TemplateOptions = {}) {
  const subject = "Your SSAMENJ password was changed";
  const changedAt = input.changedAt.toISOString();
  const bodyText = `Hello ${input.recipientName},\n\nYour SSAMENJ password was changed at ${changedAt}.\n\nIf this was not you, contact your school administrator or SSAMENJ support immediately.`;
  const bodyHtml = `<p>Hello ${escapeHtml(input.recipientName)},</p><p>Your SSAMENJ password was changed at ${escapeHtml(changedAt)}.</p><p>If this was not you, contact your school administrator or SSAMENJ support immediately.</p>`;
  return {
    subject,
    html: renderBrandedEmail({
      title: subject,
      bodyHtml,
      bodyText,
      branding: options.branding,
      env: options.env,
    }),
    text: renderBrandedPlainText({
      title: subject,
      bodyText,
      branding: options.branding,
      env: options.env,
    }),
  };
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
