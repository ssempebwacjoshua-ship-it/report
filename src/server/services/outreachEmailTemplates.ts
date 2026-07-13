import type { EmailBranding } from "./emailBranding";
import { renderBrandedEmail, renderBrandedPlainText, resolveEmailBranding } from "./emailBranding";

export function outreachEmailTemplate(input: {
  recipientName: string;
  schoolName?: string;
  subject: string;
  message: string;
  ctaLabel: string;
  ctaUrl: string;
  heroImageUrl?: string;
}, options: { branding?: Partial<EmailBranding>; env?: NodeJS.ProcessEnv } = {}) {
  const title = input.subject;
  const branding = resolveEmailBranding(options.env, options.branding);
  const schoolName = input.schoolName?.trim() || "your school";
  const heroImageUrl = input.heroImageUrl?.trim() || "";

  const heroImageHtml = heroImageUrl
    ? `<img src="${escapeHtml(heroImageUrl)}" alt="School Connect Student NFC Wristband" style="display:block;width:100%;max-width:100%;height:auto;border:0;border-radius:18px" />`
    : `<div style="width:100%;aspect-ratio:1.15/1;border-radius:18px;background:linear-gradient(135deg,#173a72 0%,#2f5eb6 58%,#f4c542 100%);padding:18px;box-sizing:border-box">
        <div style="height:100%;border:3px solid rgba(255,255,255,0.28);border-radius:16px;padding:18px;box-sizing:border-box;display:flex;flex-direction:column;justify-content:flex-end">
          <div style="max-width:270px;color:#fff">
            <div style="font-size:28px;line-height:1.06;font-weight:900;letter-spacing:0.02em">STUDENT NFC WRISTBAND</div>
            <div style="margin-top:10px;font-size:14px;line-height:1.5;font-weight:700;opacity:0.96">Tap • Identify • Authorize</div>
          </div>
        </div>
      </div>`;

  const bodyHtml = `
    <p style="margin:0 0 12px;color:#475569;line-height:1.75">Hello ${escapeHtml(input.recipientName)},</p>
    <p style="margin:0 0 12px;color:#475569;line-height:1.75">I hope you are doing well.</p>
    <p style="margin:0 0 12px;color:#475569;line-height:1.75">My name is Joshua from SSAMENJ Technologies Ltd. We build practical software and automation systems for schools that want to reduce paperwork, improve student safety, and make daily operations easier.</p>

    <table role="presentation" cellspacing="0" cellpadding="0" class="outreach-hero-table" style="width:100%;border-collapse:separate;border-spacing:0;margin:24px 0 26px;background:linear-gradient(135deg,#173a72 0%,#214f98 58%,#f4c542 180%);border-radius:22px;overflow:hidden">
      <tr>
        <td class="outreach-hero-cell" style="padding:18px">
          <table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse">
            <tr>
              <td class="outreach-hero-cell outreach-hero-image-cell" style="vertical-align:middle;padding:0 18px 0 0;width:50%">
                ${heroImageHtml}
              </td>
              <td class="outreach-hero-cell outreach-hero-copy-cell" style="vertical-align:middle;width:50%">
                <div style="font-size:12px;letter-spacing:0.12em;font-weight:800;color:#dbe7ff;text-transform:uppercase">School Connect</div>
                <div class="outreach-hero-copy" style="margin-top:8px;font-size:28px;line-height:1.08;font-weight:900;color:#ffffff">One Wristband. Many School Uses.</div>
                <div class="outreach-hero-subcopy" style="margin-top:10px;font-size:15px;line-height:1.7;color:#eef3ff">Attendance, gate access, student ID, library, and canteen payments in one practical school system.</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <p style="margin:0 0 16px;color:#475569;line-height:1.75">I wanted to introduce our School Connect Student NFC Wristband.</p>

    <table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;margin:0 0 18px">
      <tr>
        <td style="padding:0 6px 12px 0;width:50%">
          <div style="border:1px solid #dbe4f0;border-radius:16px;padding:16px;background:#ffffff">
            <div style="font-size:14px;font-weight:900;color:${branding.primaryColor};margin-bottom:4px">Attendance</div>
            <div style="font-size:13px;line-height:1.6;color:#475569">Faster attendance tracking without manual books or paper slips.</div>
          </div>
        </td>
        <td style="padding:0 0 12px 6px;width:50%">
          <div style="border:1px solid #dbe4f0;border-radius:16px;padding:16px;background:#ffffff">
            <div style="font-size:14px;font-weight:900;color:${branding.primaryColor};margin-bottom:4px">Gate Access</div>
            <div style="font-size:13px;line-height:1.6;color:#475569">Safer student identification and easier entry verification.</div>
          </div>
        </td>
      </tr>
      <tr>
        <td style="padding:0 6px 12px 0;width:50%">
          <div style="border:1px solid #dbe4f0;border-radius:16px;padding:16px;background:#ffffff">
            <div style="font-size:14px;font-weight:900;color:${branding.primaryColor};margin-bottom:4px">Canteen Payments</div>
            <div style="font-size:13px;line-height:1.6;color:#475569">Cashless canteen payments with cleaner records.</div>
          </div>
        </td>
        <td style="padding:0 0 12px 6px;width:50%">
          <div style="border:1px solid #dbe4f0;border-radius:16px;padding:16px;background:#ffffff">
            <div style="font-size:14px;font-weight:900;color:${branding.primaryColor};margin-bottom:4px">Student ID &amp; Library</div>
            <div style="font-size:13px;line-height:1.6;color:#475569">Tap for student services, borrowing, and authorization checks.</div>
          </div>
        </td>
      </tr>
    </table>

    <p style="margin:0 0 14px;color:#475569;line-height:1.75">The wristband is durable, waterproof, unique to each student, and built for daily school use. It helps reduce paperwork, improves visibility, and makes routine checks faster for staff.</p>
    <p style="margin:0 0 14px;color:#475569;line-height:1.75">For example, a student can tap at the gate for attendance, tap at the canteen for payment, or tap at the library when borrowing a book. The school gets a cleaner record, and parents can receive better visibility where needed.</p>
    <p style="margin:0 0 14px;color:#475569;line-height:1.75">Would ${escapeHtml(schoolName)} be open to a short demo so we can show how this can work in your school?</p>
  `;

  const bodyText = `Hello ${input.recipientName},\n\nI hope you are doing well.\n\nMy name is Joshua from SSAMENJ Technologies Ltd. We build practical software and automation systems for schools that want to reduce paperwork, improve student safety, and make daily operations easier.\n\nI wanted to introduce our School Connect Student NFC Wristband.\n\nWith one wristband, a school can support:\n\n- Attendance tracking\n- Gate access verification\n- Student identification\n- Library authorization\n- Cashless canteen payments\n\nThe wristband is designed for daily school use. It is durable, waterproof, unique to each student, and helps staff confirm student activity faster without relying on manual books or paper slips.\n\nFor example, a student can tap at the gate for attendance, tap at the canteen for payment, or tap at the library when borrowing a book. The school gets a cleaner record, and parents can receive better visibility where needed.\n\nWould ${schoolName} be open to a short demo so we can show how this can work in your school?`;

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
