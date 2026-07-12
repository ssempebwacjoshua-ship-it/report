import { Resend } from "resend";

type EmailSendInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
};

export type EmailSendResult =
  | { ok: true; provider: "RESEND"; messageId: string | null }
  | { ok: false; provider: "RESEND" | "NONE"; reason: "NOT_CONFIGURED" | "SEND_FAILED"; safeErrorCode?: string };

function configuredFrom() {
  return process.env.AUTH_EMAIL_FROM?.trim() || "";
}

function configuredReplyTo() {
  return process.env.AUTH_EMAIL_REPLY_TO?.trim() || undefined;
}

export function isAuthEmailConfigured(env: NodeJS.ProcessEnv = process.env) {
  return Boolean(env.RESEND_API_KEY?.trim() && env.AUTH_EMAIL_FROM?.trim() && env.APP_PUBLIC_URL?.trim());
}

export async function sendAuthEmail(input: EmailSendInput): Promise<EmailSendResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = configuredFrom();
  if (!apiKey || !from || !process.env.APP_PUBLIC_URL?.trim()) {
    return { ok: false, provider: "NONE", reason: "NOT_CONFIGURED" };
  }

  try {
    const resend = new Resend(apiKey);
    const result = await resend.emails.send({
      from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
      replyTo: input.replyTo ?? configuredReplyTo(),
    });
    if (result.error) {
      console.warn("[auth-email-send-failed]", {
        provider: "RESEND",
        code: result.error.name,
        recipientDomain: input.to.split("@")[1] ?? "unknown",
      });
      return { ok: false, provider: "RESEND", reason: "SEND_FAILED", safeErrorCode: result.error.name };
    }
    return { ok: true, provider: "RESEND", messageId: result.data?.id ?? null };
  } catch (error) {
    console.warn("[auth-email-send-failed]", {
      provider: "RESEND",
      code: error instanceof Error ? error.name : "UNKNOWN",
      recipientDomain: input.to.split("@")[1] ?? "unknown",
    });
    return {
      ok: false,
      provider: "RESEND",
      reason: "SEND_FAILED",
      safeErrorCode: error instanceof Error ? error.name : "UNKNOWN",
    };
  }
}

