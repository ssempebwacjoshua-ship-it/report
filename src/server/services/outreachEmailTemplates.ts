import type { EmailBranding } from "./emailBranding";
import { renderBrandedEmail, renderBrandedPlainText } from "./emailBranding";

export function outreachEmailTemplate(input: {
  recipientName: string;
  subject: string;
  message: string;
  ctaLabel: string;
  ctaUrl: string;
}, options: { branding?: Partial<EmailBranding>; env?: NodeJS.ProcessEnv } = {}) {
  const title = input.subject;
  const bodyHtml = `<p>Hello ${escapeHtml(input.recipientName)},</p><p>${escapeHtml(input.message)}</p>`;
  const bodyText = `Hello ${input.recipientName},\n\n${input.message}`;

  return {
    subject: input.subject,
    html: renderBrandedEmail({
      title,
      bodyHtml,
      bodyText,
      ctaLabel: input.ctaLabel,
      ctaUrl: input.ctaUrl,
      branding: options.branding,
      env: options.env,
    }),
    text: renderBrandedPlainText({
      title,
      bodyText,
      ctaLabel: input.ctaLabel,
      ctaUrl: input.ctaUrl,
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
