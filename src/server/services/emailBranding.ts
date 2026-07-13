export type EmailBranding = {
  companyName: string;
  displayName: string;
  tagline: string;
  supportEmail: string;
  websiteUrl: string;
  postalAddress: string;
  products: string;
  logoUrl: string | null;
  primaryColor: string;
  accentColor: string;
  footerRuleColor: string;
};

const DEFAULT_SITE_URL = "https://ssamenj.online";
const DEFAULT_LOGO_URL = `${DEFAULT_SITE_URL}/ssamenj-logo.png`;

function readEnv(env: NodeJS.ProcessEnv, key: string) {
  return env[key]?.trim() || "";
}

function isLocalHostname(hostname: string) {
  return hostname === "localhost"
    || hostname === "127.0.0.1"
    || hostname === "0.0.0.0"
    || hostname.endsWith(".localhost");
}

function isSafeAbsoluteHttpsUrl(value: string) {
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" && !isLocalHostname(url.hostname);
  } catch {
    return false;
  }
}

function resolvePublicLogoUrl(env: NodeJS.ProcessEnv, overrideLogoUrl?: string | null) {
  const candidate = overrideLogoUrl?.trim()
    || readEnv(env, "PUBLIC_COMPANY_LOGO_URL")
    || "";
  if (candidate && isSafeAbsoluteHttpsUrl(candidate)) {
    return candidate;
  }

  const publicSiteUrl = readEnv(env, "PUBLIC_SITE_URL");
  if (publicSiteUrl && isSafeAbsoluteHttpsUrl(publicSiteUrl)) {
    return new URL("/ssamenj-logo.png", publicSiteUrl.endsWith("/") ? publicSiteUrl : `${publicSiteUrl}/`).toString();
  }

  return DEFAULT_LOGO_URL;
}

export function resolveEmailBranding(
  env: NodeJS.ProcessEnv = process.env,
  overrides: Partial<Pick<EmailBranding, "logoUrl" | "websiteUrl" | "supportEmail" | "companyName" | "displayName" | "tagline" | "postalAddress" | "products" | "primaryColor" | "accentColor" | "footerRuleColor">> = {},
): EmailBranding {
  return {
    companyName: overrides.companyName || "SSAMENJ Technologies Ltd",
    displayName: overrides.displayName || "SSAMENJ Technologies",
    tagline: overrides.tagline || "Paperless school systems for modern schools",
    supportEmail: overrides.supportEmail || "support@ssamenj.online",
    websiteUrl: overrides.websiteUrl || DEFAULT_SITE_URL,
    postalAddress: overrides.postalAddress || "P.O. Box 211144, Kampala GPO",
    products: overrides.products || "School Connect | Report Lab | Kids Wallet | Smart Pages",
    logoUrl: resolvePublicLogoUrl(env, overrides.logoUrl ?? null),
    primaryColor: overrides.primaryColor || "#173a72",
    accentColor: overrides.accentColor || "#f4c542",
    footerRuleColor: overrides.footerRuleColor || "#e2e8f0",
  };
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderFooterHtml(branding: EmailBranding) {
  return `
    <div style="margin-top:28px;padding-top:20px;border-top:1px solid ${branding.footerRuleColor};font-size:13px;line-height:1.7;color:#475569">
      <p style="margin:0;font-weight:800;color:${branding.primaryColor}">${escapeHtml(branding.companyName)}</p>
      <p style="margin:4px 0 0">Email: <a href="mailto:${escapeHtml(branding.supportEmail)}" style="color:${branding.primaryColor};text-decoration:none">${escapeHtml(branding.supportEmail)}</a></p>
      <p style="margin:0">Website: <a href="${escapeHtml(branding.websiteUrl)}" style="color:${branding.primaryColor};text-decoration:none">${escapeHtml(branding.websiteUrl)}</a></p>
      <p style="margin:0">${escapeHtml(branding.postalAddress)}</p>
      <p style="margin:0">Products: ${escapeHtml(branding.products)}</p>
    </div>
  `.trim();
}

export function renderBrandedEmail(input: {
  title: string;
  bodyHtml: string;
  bodyText: string;
  ctaLabel?: string;
  ctaUrl?: string;
  branding?: Partial<EmailBranding>;
  env?: NodeJS.ProcessEnv;
}) {
  const branding = resolveEmailBranding(input.env, input.branding);
  const ctaHtml = input.ctaLabel && input.ctaUrl
    ? `<p style="margin:28px 0 0"><a href="${escapeHtml(input.ctaUrl)}" style="display:inline-block;background:${branding.accentColor};color:#0f172a;text-decoration:none;font-weight:800;padding:12px 20px;border-radius:10px">${escapeHtml(input.ctaLabel)}</a></p>`
    : "";
  const logoHtml = branding.logoUrl
    ? `<img src="${escapeHtml(branding.logoUrl)}" alt="${escapeHtml(branding.displayName)} logo" width="60" height="60" style="display:block;width:60px;height:60px;border-radius:14px;object-fit:contain;background:#ffffff;border:1px solid #dbe4f0;padding:8px" />`
    : `<div style="display:flex;width:60px;height:60px;border-radius:14px;background:${branding.primaryColor};align-items:center;justify-content:center;color:#fff;font-weight:900;font-size:22px">S</div>`;

  return `<!doctype html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>
      @media only screen and (max-width: 600px) {
        .email-shell { padding: 0 !important; width:100% !important; max-width:none !important; }
        .email-card { border-radius: 0 !important; border-left: 0 !important; border-right: 0 !important; }
        .email-body { padding: 18px 0 20px !important; }
        .email-title { font-size: 22px !important; }
        .email-brand-row { width: 100% !important; padding:0 18px !important; box-sizing:border-box !important; }
        .email-brand-cell-logo { padding-right: 12px !important; }
        .email-footer { font-size: 12px !important; }
        .outreach-hero-table, .outreach-hero-row, .outreach-hero-cell { display:block !important; width:100% !important; }
        .outreach-hero-cell { padding:0 !important; }
        .outreach-hero-image-cell { padding:0 0 16px 0 !important; }
        .outreach-hero-copy-cell { padding:0 !important; }
        .outreach-hero-copy { font-size: 22px !important; }
        .outreach-hero-subcopy { font-size: 13px !important; }
        .email-copy-wrap { padding:0 18px !important; box-sizing:border-box !important; }
        .email-footer-wrap { padding:18px 18px 0 !important; box-sizing:border-box !important; }
        .email-hero-card { margin:18px 0 18px !important; border-radius:0 !important; }
        .outreach-feature-table, .outreach-feature-row, .outreach-feature-cell { display:block !important; width:100% !important; }
        .outreach-feature-cell { padding:0 0 12px 0 !important; }
        .outreach-feature-card { min-height:0 !important; }
      }
    </style>
  </head>
  <body style="margin:0;background:#f6f8fc;color:#0f172a;font-family:Arial,Helvetica,sans-serif">
    <div class="email-shell" style="max-width:600px;margin:0 auto;padding:24px 16px">
      <div class="email-card" style="background:#ffffff;border:1px solid #dbe4f0;border-radius:20px;overflow:hidden;box-shadow:0 12px 32px rgba(15,23,42,0.06)">
        <div style="height:6px;background:${branding.accentColor}"></div>
        <div class="email-body" style="padding:28px 28px 24px">
          <table class="email-brand-row" role="presentation" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:0 0 22px;width:100%">
            <tr>
              <td class="email-brand-cell-logo" style="vertical-align:middle;padding:0 14px 0 0">${logoHtml}</td>
              <td style="vertical-align:middle">
                <div style="font-size:20px;line-height:1.2;font-weight:900;color:${branding.primaryColor}">${escapeHtml(branding.displayName)}</div>
                <div style="margin-top:4px;font-size:12px;line-height:1.4;color:#64748b">${escapeHtml(branding.tagline)}</div>
              </td>
            </tr>
          </table>
          <h1 class="email-title" style="margin:0 0 16px;font-size:24px;line-height:1.25;color:${branding.primaryColor}">${escapeHtml(input.title)}</h1>
          <div style="font-size:15px;line-height:1.8;color:#1e293b">${input.bodyHtml}</div>
          ${ctaHtml}
          <div class="email-footer">
            ${renderFooterHtml(branding)}
          </div>
        </div>
      </div>
    </div>
  </body>
</html>`;
}

export function renderBrandedPlainText(input: {
  title: string;
  bodyText: string;
  ctaLabel?: string;
  ctaUrl?: string;
  branding?: Partial<EmailBranding>;
  env?: NodeJS.ProcessEnv;
}) {
  const branding = resolveEmailBranding(input.env, input.branding);
  const parts = [
    input.title,
    "",
    input.bodyText.trim(),
  ];

  if (input.ctaLabel && input.ctaUrl) {
    parts.push("", `${input.ctaLabel}: ${input.ctaUrl}`);
  }

  parts.push(
    "",
    branding.companyName,
    `Email: ${branding.supportEmail}`,
    `Website: ${branding.websiteUrl}`,
    branding.postalAddress,
    `Products: ${branding.products}`,
  );

  return parts.join("\n");
}
