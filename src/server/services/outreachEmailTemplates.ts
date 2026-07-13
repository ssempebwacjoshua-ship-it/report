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
  const bodyHtml = `
    <p>Hello ${escapeHtml(input.recipientName)},</p>
    <p>${escapeHtml(input.message)}</p>
    <div style="margin:24px 0;padding:18px;border:1px solid #dbe4f0;border-radius:16px;background:#f8fbff">
      <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap">
        <div style="width:132px;min-width:132px;height:84px;border-radius:18px;background:linear-gradient(135deg,#173a72 0%,#2f5eb6 100%);padding:10px;box-sizing:border-box">
          <div style="height:100%;border:3px solid rgba(255,255,255,0.86);border-radius:14px;padding:10px;box-sizing:border-box">
            <div style="height:18px;width:72px;border-radius:999px;background:#ffffff;margin:4px auto 0"></div>
            <div style="height:14px;width:58px;border-radius:999px;background:#f4c542;margin:9px auto 0"></div>
            <div style="height:14px;width:42px;border-radius:999px;background:#ffffff;margin:9px auto 0"></div>
          </div>
        </div>
        <div style="flex:1;min-width:220px">
          <p style="margin:0 0 6px;font-weight:900;color:#173a72;font-size:16px">School Connect wristband</p>
          <p style="margin:0;color:#334155;line-height:1.7">
            Tracks attendance fast, does not need a battery, and stays affordable for schools that want a practical student identity flow.
          </p>
        </div>
      </div>
    </div>
  `;
  const bodyText = `Hello ${input.recipientName},\n\n${input.message}\n\nSchool Connect wristband\nTracks attendance fast, does not need a battery, and stays affordable for schools that want a practical student identity flow.`;

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
