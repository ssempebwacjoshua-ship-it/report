const BRAND = "SSAMENJ";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function layout(title: string, body: string, ctaLabel?: string, ctaUrl?: string) {
  const button = ctaLabel && ctaUrl
    ? `<p style="margin:24px 0"><a href="${escapeHtml(ctaUrl)}" style="background:#2563eb;color:#ffffff;display:inline-block;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:700">${escapeHtml(ctaLabel)}</a></p>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#f8fafc;color:#0f172a;font-family:Arial,sans-serif"><div style="max-width:560px;margin:0 auto;padding:24px"><div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:24px"><p style="margin:0 0 12px;color:#2563eb;font-weight:800">${BRAND} Technologies</p><h1 style="font-size:22px;line-height:1.3;margin:0 0 16px">${escapeHtml(title)}</h1>${body}${button}</div></div></body></html>`;
}

export function accountSetupTemplate(input: { recipientName: string; schoolName: string; inviterName: string; setupUrl: string; setupCode: string; expiresHours: number }) {
  const subject = "Set up your SSAMENJ Report Lab account";
  const body = `<p>Hello ${escapeHtml(input.recipientName)},</p><p>${escapeHtml(input.inviterName)} invited you to ${escapeHtml(input.schoolName)} on SSAMENJ.</p><p>Your setup code is:</p><p style="font-size:28px;letter-spacing:6px;font-weight:800;color:#0f172a">${escapeHtml(input.setupCode)}</p><p>This setup link expires in ${input.expiresHours} hours.</p><p>Use the button or paste this URL into your browser:</p><p style="word-break:break-all;color:#334155">${escapeHtml(input.setupUrl)}</p><p>If you did not expect this invitation, do not share the code.</p>`;
  return {
    subject,
    html: layout(subject, body, "Set up account", input.setupUrl),
    text: `Hello ${input.recipientName},\n\n${input.inviterName} invited you to ${input.schoolName} on SSAMENJ.\n\nYour setup code is: ${input.setupCode}\n\nSet up account: ${input.setupUrl}\n\nThis setup link expires in ${input.expiresHours} hours.\n\nIf you did not expect this invitation, do not share the code.`,
  };
}

export function passwordResetOtpTemplate(input: { recipientName: string; otp: string; resetUrl: string; expiresMinutes: number }) {
  const subject = "Your SSAMENJ Report Lab password reset code";
  const body = `<p>Hello ${escapeHtml(input.recipientName)},</p><p>We received a request to reset your SSAMENJ Report Lab password.</p><p>Your reset code is:</p><p style="font-size:28px;letter-spacing:6px;font-weight:800;color:#0f172a">${escapeHtml(input.otp)}</p><p>This code expires in ${input.expiresMinutes} minutes.</p><p>Use this link if you would rather open the reset page directly:</p><p style="word-break:break-all;color:#334155">${escapeHtml(input.resetUrl)}</p><p>If you did not request this, you can ignore this email.</p>`;
  return {
    subject,
    html: layout(subject, body, "Open reset page", input.resetUrl),
    text: `Hello ${input.recipientName},\n\nYour SSAMENJ Report Lab password reset code is: ${input.otp}\n\nOpen the reset page: ${input.resetUrl}\n\nThis code expires in ${input.expiresMinutes} minutes.\n\nIf you did not request this, you can ignore this email.`,
  };
}

export function passwordChangedTemplate(input: { recipientName: string; changedAt: Date }) {
  const subject = "Your SSAMENJ password was changed";
  const changedAt = input.changedAt.toISOString();
  const body = `<p>Hello ${escapeHtml(input.recipientName)},</p><p>Your SSAMENJ password was changed at ${escapeHtml(changedAt)}.</p><p>If this was not you, contact your school administrator or SSAMENJ support immediately.</p>`;
  return {
    subject,
    html: layout(subject, body),
    text: `Hello ${input.recipientName},\n\nYour SSAMENJ password was changed at ${changedAt}.\n\nIf this was not you, contact your school administrator or SSAMENJ support immediately.`,
  };
}
