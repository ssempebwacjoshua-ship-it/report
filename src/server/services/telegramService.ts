export interface TelegramResult {
  ok: boolean;
  error?: string;
}

/**
 * Send a plain-text or HTML message to the configured admin Telegram chat.
 * Returns { ok: true } on success, { ok: false, error } on any failure.
 * Never throws — callers treat Telegram as best-effort.
 */
export async function sendTelegramMessage(text: string): Promise<TelegramResult> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID?.trim();
  if (!botToken || !chatId) {
    return { ok: false, error: "TELEGRAM_BOT_TOKEN or TELEGRAM_ADMIN_CHAT_ID not configured" };
  }
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
      },
    );
    const data = (await response.json()) as { ok: boolean; description?: string };
    if (!data.ok) {
      return { ok: false, error: data.description ?? "Telegram API returned ok=false" };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown Telegram error" };
  }
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
    "<b>🧾 New Smart Pages Payment Request</b>",
    "",
    `<b>School:</b> ${escape(opts.schoolName)}`,
    `<b>User:</b> ${escape(opts.userName)}`,
    `<b>Package:</b> ${escape(opts.packageName)}`,
    `<b>Pages:</b> ${opts.pages.toLocaleString()}`,
    `<b>Amount:</b> ${amount}`,
    `<b>Network:</b> ${escape(opts.network)}`,
    `<b>Transaction ID:</b> <code>${escape(opts.transactionId)}</code>`,
    `<b>Request ID:</b> <code>${escape(opts.paymentId)}</code>`,
    `<b>Ref:</b> <code>${escape(opts.paymentReference)}</code>`,
    `<b>Status:</b> PENDING`,
    `<b>Submitted:</b> ${time}`,
    "",
    "Open the Smart Pages Billing Admin page to approve or reject.",
  ].join("\n");
}

/** Escape special HTML characters for Telegram HTML parse mode. */
function escape(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Notify the admin via Telegram when a school submits a Smart Pages payment receipt.
 * Never throws — caller stores the result but does not block the response.
 */
export async function notifySmartPagesPayment(
  opts: SmartPagesPaymentNotificationOpts,
): Promise<TelegramResult> {
  return sendTelegramMessage(buildSmartPagesPaymentMessage(opts));
}
