import { Resend } from "resend";

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

export type EmailSendResult =
  | { ok: true; provider: "RESEND"; messageId: string | null }
  | {
      ok: false;
      provider: "RESEND" | "NONE";
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
  return readEnv(env, "OUTREACH_EMAIL_FROM")
    || configuredFrom(env);
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

export function configuredCompanySender(env: NodeJS.ProcessEnv = process.env) {
  return configuredOutreachFrom(env);
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

function resolveAuthEmailConfig(env: NodeJS.ProcessEnv = process.env) {
  const provider = configuredAuthEmailProvider(env);
  const apiKey = readEnv(env, "RESEND_API_KEY");
  const rawFrom = configuredOutreachFrom(env);
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
