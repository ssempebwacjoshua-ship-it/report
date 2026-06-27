export interface TelegramResult {
  ok: boolean;
  error?: string;
}

type TelegramTarget = "admin" | "support";
const DEFAULT_SUPPORT_CHAT_ID = "8899226749";

function getTelegramConfig(target: TelegramTarget) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatIdEnv = target === "support" ? "TELEGRAM_SUPPORT_CHAT_ID" : "TELEGRAM_ADMIN_CHAT_ID";
  const chatId = target === "support"
    ? process.env.TELEGRAM_SUPPORT_CHAT_ID?.trim() || DEFAULT_SUPPORT_CHAT_ID
    : process.env.TELEGRAM_ADMIN_CHAT_ID?.trim();

  if (!botToken || !chatId) {
    return {
      ok: false as const,
      error: `Telegram not configured: missing TELEGRAM_BOT_TOKEN or ${chatIdEnv}`,
    };
  }

  return {
    ok: true as const,
    botToken,
    chatId,
  };
}

async function sendTelegramMessageToTarget(text: string, target: TelegramTarget): Promise<TelegramResult> {
  const config = getTelegramConfig(target);
  if (!config.ok) {
    return { ok: false, error: config.error };
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${config.botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Plain text avoids parse-mode edge cases with school and user data.
      body: JSON.stringify({ chat_id: config.chatId, text }),
    });
    const data = (await response.json()) as { ok: boolean; description?: string };
    if (!data.ok) {
      return { ok: false, error: data.description ?? "Telegram API returned ok=false" };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Unknown Telegram error" };
  }
}

/**
 * Send a plain-text message to the configured admin Telegram chat.
 * Returns { ok: true } on success, { ok: false, error } on any failure.
 * Never throws; callers treat Telegram as best-effort.
 */
export async function sendTelegramMessage(text: string): Promise<TelegramResult> {
  return sendTelegramMessageToTarget(text, "admin");
}

export async function sendSupportTelegramMessage(text: string): Promise<TelegramResult> {
  return sendTelegramMessageToTarget(text, "support");
}

export interface SmartPagesPaymentNotificationOpts {
  schoolName: string;
  userName: string;
  packageName: string;
  pages: number;
  amountUgx: number;
  network: string;
  transactionId: string;
  paymentId: string;
  paymentReference: string;
  submittedAt: string;
}

export function buildSmartPagesPaymentMessage(opts: SmartPagesPaymentNotificationOpts): string {
  const amount = `UGX ${opts.amountUgx.toLocaleString()}`;
  let time: string;
  try {
    time = new Date(opts.submittedAt).toLocaleString("en-UG", { timeZone: "Africa/Kampala" });
  } catch {
    time = opts.submittedAt;
  }
  return [
    "=== New Smart Pages Payment Request ===",
    "",
    `School: ${opts.schoolName}`,
    `User: ${opts.userName}`,
    `Package: ${opts.packageName}`,
    `Pages: ${opts.pages.toLocaleString()}`,
    `Amount: ${amount}`,
    `Network: ${opts.network}`,
    `Transaction ID: ${opts.transactionId}`,
    `Request ID: ${opts.paymentId}`,
    `Ref: ${opts.paymentReference}`,
    `Status: PENDING`,
    `Submitted: ${time}`,
    "",
    "Open the Smart Pages Billing Admin page to approve or reject.",
  ].join("\n");
}

/**
 * Notify the admin via Telegram when a school submits a Smart Pages payment receipt.
 * Never throws; caller stores the result but does not block the response.
 */
export async function notifySmartPagesPayment(
  opts: SmartPagesPaymentNotificationOpts,
): Promise<TelegramResult> {
  return sendTelegramMessage(buildSmartPagesPaymentMessage(opts));
}
