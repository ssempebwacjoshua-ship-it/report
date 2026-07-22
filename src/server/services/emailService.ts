import { Resend } from "resend";
import nodemailer from "nodemailer";

export const OFFICIAL_SUPPORT_EMAIL = "support@ssamenj.online";
export const OFFICIAL_COMPANY_DISPLAY_NAME = "SSAMENJ Technologies";
export const OFFICIAL_COMPANY_OUTREACH_SENDER = `${OFFICIAL_COMPANY_DISPLAY_NAME} <${OFFICIAL_SUPPORT_EMAIL}>`;

type EmailSendInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
};

type ResendErrorLike = {
  name?: string;
  message?: string;
  statusCode?: number | null;
};

type SmtpSendMailResult = {
  messageId?: string;
};

type OutreachEmailProvider = "RESEND" | "GMAIL_SMTP";

export type EmailSendResult =
  | { ok: true; provider: "RESEND"; messageId: string | null }
  | { ok: true; provider: "GMAIL_SMTP"; messageId: string | null }
  | {
      ok: false;
      provider: "RESEND" | "GMAIL_SMTP" | "NONE";
      reason: "NOT_CONFIGURED" | "SEND_FAILED";
      safeErrorCode?: string;
      safeErrorMessage?: string;
      safeStatusCode?: number | null;
    };

function readEnv(env: NodeJS.ProcessEnv, key: string) {
  return env[key]?.trim() || "";
}

function configuredFrom(env: NodeJS.ProcessEnv = process.env) {
  return readEnv(env, "AUTH_EMAIL_FROM")
    || readEnv(env, "EMAIL_FROM")
    || readEnv(env, "RESEND_FROM_EMAIL");
}

function configuredOutreachFrom(env: NodeJS.ProcessEnv = process.env) {
  return readEnv(env, "OUTREACH_EMAIL_FROM");
}

function configuredOutreachReplyTo(env: NodeJS.ProcessEnv = process.env) {
  return readEnv(env, "OUTREACH_REPLY_TO")
    || readEnv(env, "AUTH_EMAIL_REPLY_TO")
    || OFFICIAL_SUPPORT_EMAIL;
}

function configuredAppUrl(env: NodeJS.ProcessEnv = process.env) {
  return readEnv(env, "APP_PUBLIC_URL")
    || readEnv(env, "PUBLIC_APP_URL")
    || readEnv(env, "APP_URL")
    || readEnv(env, "APP_BASE_URL");
}

function configuredReplyTo(env: NodeJS.ProcessEnv = process.env) {
  return readEnv(env, "AUTH_EMAIL_REPLY_TO") || undefined;
}

function isValidEmailAddress(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function stripOuterQuotes(value: string) {
  const trimmed = value.trim();
  if (trimmed.length >= 2) {
    const first = trimmed[0];
    const last = trimmed[trimmed.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return trimmed.slice(1, -1).trim();
    }
  }
  return trimmed;
}

function normalizeAuthEmailFromValue(value: string) {
  const cleaned = stripOuterQuotes(value);
  if (!cleaned) return "";
  if (isValidEmailAddress(cleaned)) return cleaned;

  const match = cleaned.match(/^(.*)<([^<>]+)>$/);
  if (!match) return "";

  const name = match[1].trim().replace(/^["']|["']$/g, "");
  const email = match[2].trim();
  if (!isValidEmailAddress(email)) return "";

  return name ? `${name} <${email}>` : email;
}

export function configuredAuthEmailProvider(env: NodeJS.ProcessEnv = process.env) {
  return readEnv(env, "AUTH_EMAIL_PROVIDER") || "RESEND";
}

export function configuredOutreachEmailProvider(env: NodeJS.ProcessEnv = process.env): OutreachEmailProvider | "UNKNOWN" {
  const raw = readEnv(env, "OUTREACH_EMAIL_PROVIDER") || "RESEND";
  if (/^gmail$/i.test(raw)) return "GMAIL_SMTP";
  if (/^gmail_smtp$/i.test(raw)) return "GMAIL_SMTP";
  if (/^resend$/i.test(raw)) return "RESEND";
  return "UNKNOWN";
}

export function configuredCompanySender(env: NodeJS.ProcessEnv = process.env) {
  return normalizeVerifiedSender(configuredOutreachFrom(env) || OFFICIAL_COMPANY_OUTREACH_SENDER);
}

export function configuredCompanyReplyTo(env: NodeJS.ProcessEnv = process.env) {
  return configuredOutreachReplyTo(env);
}

function isVerifiedSenderError(error: ResendErrorLike) {
  if (error.name === "invalid_from_address") return true;
  const message = error.message?.toLowerCase() || "";
  return /sender|from address|from domain|verified sender|verified domain|domain.*verified|verified.*domain/.test(message);
}

function safeResendErrorMessage(error: ResendErrorLike) {
  if (isVerifiedSenderError(error)) {
    return "Email provider sender/domain is not verified.";
  }
  return error.message?.trim() || "Resend rejected the email send request.";
}

function safeResendErrorCode(error: ResendErrorLike) {
  if (isVerifiedSenderError(error)) return "sender_domain_not_verified";
  return error.name?.trim() || "UNKNOWN";
}

function logResendFailure(error: ResendErrorLike, recipientDomain: string) {
  console.warn("[auth-email-send-failed]", {
    provider: "RESEND",
    code: error.name || "UNKNOWN",
    message: error.message || "Resend rejected the email send request.",
    statusCode: error.statusCode ?? null,
    recipientDomain,
  });
}

function missingConfigMessage(missing: string[]) {
  if (missing.length === 1) {
    if (missing[0] === "AUTH_EMAIL_FROM_INVALID_FORMAT") {
      return "AUTH_EMAIL_FROM is invalid. Use email@example.com or Name <email@example.com>.";
    }
    return `${missing[0]} is missing.`;
  }
  return `Auth email is not configured. Missing: ${missing.join(", ")}.`;
}

function outreachMissingConfigMessage(missing: string[]) {
  if (missing.length === 1) {
    if (missing[0] === "OUTREACH_EMAIL_FROM_INVALID_FORMAT") {
      return "OUTREACH_EMAIL_FROM is invalid. Use email@example.com or Name <email@example.com>.";
    }
    return `${missing[0]} is missing.`;
  }
  return `Outreach email is not configured. Missing: ${missing.join(", ")}.`;
}

function missingConfigCode(missing: string[]) {
  const first = missing[0] || "";
  if (first === "RESEND_API_KEY") return "missing_api_key";
  if (first === "AUTH_EMAIL_FROM") return "missing_auth_email_from";
  if (first === "AUTH_EMAIL_FROM_INVALID_FORMAT") return "invalid_auth_email_from";
  if (first === "AUTH_EMAIL_FROM (valid email or Name <email> format)") return "invalid_auth_email_from";
  if (first.startsWith("APP_PUBLIC_URL")) return "missing_public_app_url";
  if (first === "AUTH_EMAIL_PROVIDER=RESEND") return "missing_auth_email_provider";
  return "missing_auth_email_config";
}

function outreachMissingConfigCode(missing: string[]) {
  const first = missing[0] || "";
  if (first === "RESEND_API_KEY") return "missing_api_key";
  if (first === "SMTP_HOST") return "missing_smtp_host";
  if (first === "SMTP_PORT") return "missing_smtp_port";
  if (first === "SMTP_USER") return "missing_smtp_user";
  if (first === "SMTP_PASSWORD") return "missing_smtp_password";
  if (first === "SMTP_USER_UNSAFE") return "invalid_smtp_user";
  if (first === "OUTREACH_EMAIL_FROM") return "missing_outreach_email_from";
  if (first === "OUTREACH_EMAIL_FROM_INVALID_FORMAT") return "invalid_outreach_email_from";
  if (first === "OUTREACH_EMAIL_FROM_UNSAFE") return "invalid_outreach_email_from";
  if (first === "OUTREACH_EMAIL_FROM (valid email or Name <email> format)") return "invalid_outreach_email_from";
  if (first === "OUTREACH_REPLY_TO") return "missing_outreach_reply_to";
  if (first === "OUTREACH_EMAIL_PROVIDER") return "invalid_outreach_email_provider";
  if (first.startsWith("APP_PUBLIC_URL")) return "missing_public_app_url";
  if (first === "AUTH_EMAIL_PROVIDER=RESEND") return "missing_auth_email_provider";
  return "missing_outreach_email_config";
}

function resolveAuthEmailConfig(env: NodeJS.ProcessEnv = process.env) {
  const provider = configuredAuthEmailProvider(env);
  const apiKey = readEnv(env, "RESEND_API_KEY");
  const rawFrom = configuredFrom(env);
  const from = rawFrom ? normalizeAuthEmailFromValue(rawFrom) : "";
  const publicUrl = configuredAppUrl(env);
  const replyTo = configuredReplyTo(env);
  const missing: string[] = [];

  if (provider !== "RESEND") {
    missing.push("AUTH_EMAIL_PROVIDER=RESEND");
  }
  if (!apiKey) {
    missing.push("RESEND_API_KEY");
  }
  if (!rawFrom) {
    missing.push("AUTH_EMAIL_FROM");
  } else if (!from) {
    missing.push("AUTH_EMAIL_FROM_INVALID_FORMAT");
  }
  if (!publicUrl) {
    missing.push("APP_PUBLIC_URL / PUBLIC_APP_URL / APP_URL / APP_BASE_URL");
  }

  return { provider, apiKey, from, publicUrl, replyTo, missing };
}

function isUnsafeSenderIdentity(value: string) {
  const lower = value.toLowerCase();
  return lower.includes("@gmail.com")
    || lower.includes("localhost")
    || lower.includes("test")
    || lower.includes("pearlmart");
}

function normalizeVerifiedSender(value: string) {
  const normalized = normalizeAuthEmailFromValue(value);
  if (!normalized) return "";
  if (isUnsafeSenderIdentity(normalized)) return "";
  return normalized;
}

function resolveOutreachEmailConfig(env: NodeJS.ProcessEnv = process.env) {
  const provider = configuredOutreachEmailProvider(env);
  const apiKey = readEnv(env, "RESEND_API_KEY");
  const rawFrom = configuredOutreachFrom(env);
  const from = rawFrom ? normalizeVerifiedSender(rawFrom) : "";
  const replyTo = configuredOutreachReplyTo(env);
  const publicUrl = configuredAppUrl(env);
  const smtpHost = readEnv(env, "SMTP_HOST");
  const smtpPortRaw = readEnv(env, "SMTP_PORT");
  const smtpSecureRaw = readEnv(env, "SMTP_SECURE");
  const smtpUser = readEnv(env, "SMTP_USER");
  const smtpPassword = readEnv(env, "SMTP_PASSWORD");
  const smtpPort = smtpPortRaw ? Number.parseInt(smtpPortRaw, 10) : Number.NaN;
  const smtpSecure = smtpSecureRaw ? /^true$/i.test(smtpSecureRaw) : true;
  const missing: string[] = [];

  if (provider === "UNKNOWN") {
    missing.push("OUTREACH_EMAIL_PROVIDER");
  }
  if (provider === "RESEND" && !apiKey) {
    missing.push("RESEND_API_KEY");
  }
  if (provider === "GMAIL_SMTP") {
    if (!smtpHost) missing.push("SMTP_HOST");
    if (!smtpPortRaw || !Number.isFinite(smtpPort) || smtpPort <= 0) missing.push("SMTP_PORT");
    if (!smtpUser) missing.push("SMTP_USER");
    if (!smtpPassword) missing.push("SMTP_PASSWORD");
    if (smtpUser && smtpUser.toLowerCase() !== OFFICIAL_SUPPORT_EMAIL) missing.push("SMTP_USER_UNSAFE");
  }
  if (!rawFrom) {
    missing.push("OUTREACH_EMAIL_FROM");
  } else if (!from) {
    missing.push("OUTREACH_EMAIL_FROM_INVALID_FORMAT");
  }
  if (from && /@gmail\.com/i.test(from)) {
    missing.push("OUTREACH_EMAIL_FROM_UNSAFE");
  }
  if (!replyTo) {
    missing.push("OUTREACH_REPLY_TO");
  }
  if (!publicUrl) {
    missing.push("APP_PUBLIC_URL / PUBLIC_APP_URL / APP_URL / APP_BASE_URL");
  }

  return { provider, apiKey, from, publicUrl, replyTo, missing, smtpHost, smtpPort, smtpSecure, smtpUser, smtpPassword };
}

export function isAuthEmailConfigured(env: NodeJS.ProcessEnv = process.env) {
  const config = resolveAuthEmailConfig(env);
  return config.provider === "RESEND" && config.missing.length === 0;
}

export async function sendAuthEmail(input: EmailSendInput): Promise<EmailSendResult> {
  const config = resolveAuthEmailConfig();
  if (config.provider !== "RESEND") {
    return {
      ok: false,
      provider: "NONE",
      reason: "NOT_CONFIGURED",
      safeErrorCode: "unsupported_provider",
      safeErrorMessage: `AUTH_EMAIL_PROVIDER=${config.provider} is not supported. Set AUTH_EMAIL_PROVIDER=RESEND.`,
    };
  }
  if (config.missing.length > 0) {
    return {
      ok: false,
      provider: "NONE",
      reason: "NOT_CONFIGURED",
      safeErrorCode: missingConfigCode(config.missing),
      safeErrorMessage: missingConfigMessage(config.missing),
    };
  }

  try {
    const resend = new Resend(config.apiKey);
    const result = await resend.emails.send({
      from: config.from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
      replyTo: input.replyTo ?? config.replyTo,
    });
    if (result.error) {
      const error = result.error as ResendErrorLike;
      logResendFailure(error, input.to.split("@")[1] ?? "unknown");
      return {
        ok: false,
        provider: "RESEND",
        reason: "SEND_FAILED",
        safeErrorCode: safeResendErrorCode(error),
        safeErrorMessage: safeResendErrorMessage(error),
        safeStatusCode: error.statusCode ?? null,
      };
    }
    return { ok: true, provider: "RESEND", messageId: result.data?.id ?? null };
  } catch (error) {
    const resendError = {
      name: error instanceof Error ? error.name : "UNKNOWN",
      message: error instanceof Error ? error.message : "Resend request failed.",
      statusCode: typeof error === "object" && error !== null && "statusCode" in error && typeof (error as { statusCode?: unknown }).statusCode === "number"
        ? (error as { statusCode: number }).statusCode
        : null,
    } satisfies ResendErrorLike;
    logResendFailure(resendError, input.to.split("@")[1] ?? "unknown");
    return {
      ok: false,
      provider: "RESEND",
      reason: "SEND_FAILED",
      safeErrorCode: safeResendErrorCode(resendError),
      safeErrorMessage: safeResendErrorMessage(resendError),
      safeStatusCode: resendError.statusCode ?? null,
    };
  }
}

export async function sendOutreachEmail(input: EmailSendInput): Promise<EmailSendResult> {
  const config = resolveOutreachEmailConfig();
  if (config.provider === "UNKNOWN") {
    return {
      ok: false,
      provider: "NONE",
      reason: "NOT_CONFIGURED",
      safeErrorCode: "unsupported_provider",
      safeErrorMessage: "OUTREACH_EMAIL_PROVIDER is not supported. Set OUTREACH_EMAIL_PROVIDER=resend or OUTREACH_EMAIL_PROVIDER=gmail.",
    };
  }
  if (config.missing.length > 0) {
    return {
      ok: false,
      provider: "NONE",
      reason: "NOT_CONFIGURED",
      safeErrorCode: outreachMissingConfigCode(config.missing),
      safeErrorMessage: outreachMissingConfigMessage(config.missing),
    };
  }

  if (config.provider === "GMAIL_SMTP") {
    try {
      const transporter = nodemailer.createTransport({
        host: config.smtpHost,
        port: config.smtpPort,
        secure: config.smtpSecure,
        auth: {
          user: config.smtpUser,
          pass: config.smtpPassword,
        },
      });
      const result = await transporter.sendMail({
        from: config.from,
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text,
        replyTo: input.replyTo ?? config.replyTo,
      }) as SmtpSendMailResult;
      return { ok: true, provider: "GMAIL_SMTP", messageId: result.messageId ?? null };
    } catch (error) {
      return {
        ok: false,
        provider: "GMAIL_SMTP",
        reason: "SEND_FAILED",
        safeErrorCode: error instanceof Error ? error.name || "SMTP_SEND_FAILED" : "SMTP_SEND_FAILED",
        safeErrorMessage: error instanceof Error ? error.message : "SMTP send failed.",
      };
    }
  }

  try {
    const resend = new Resend(config.apiKey);
    const result = await resend.emails.send({
      from: config.from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
      replyTo: input.replyTo ?? config.replyTo,
    });
    if (result.error) {
      const error = result.error as ResendErrorLike;
      logResendFailure(error, input.to.split("@")[1] ?? "unknown");
      return {
        ok: false,
        provider: "RESEND",
        reason: "SEND_FAILED",
        safeErrorCode: safeResendErrorCode(error),
        safeErrorMessage: safeResendErrorMessage(error),
        safeStatusCode: error.statusCode ?? null,
      };
    }
    return { ok: true, provider: "RESEND", messageId: result.data?.id ?? null };
  } catch (error) {
    const resendError = {
      name: error instanceof Error ? error.name : "UNKNOWN",
      message: error instanceof Error ? error.message : "Resend request failed.",
      statusCode: typeof error === "object" && error !== null && "statusCode" in error && typeof (error as { statusCode?: unknown }).statusCode === "number"
        ? (error as { statusCode: number }).statusCode
        : null,
    } satisfies ResendErrorLike;
    logResendFailure(resendError, input.to.split("@")[1] ?? "unknown");
    return {
      ok: false,
      provider: "RESEND",
      reason: "SEND_FAILED",
      safeErrorCode: safeResendErrorCode(resendError),
      safeErrorMessage: safeResendErrorMessage(resendError),
      safeStatusCode: resendError.statusCode ?? null,
    };
  }
}
