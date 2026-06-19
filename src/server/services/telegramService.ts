export interface TelegramResult {
  ok: boolean;
  error?: string;
}

/**
 * Send a plain-text message to the configured admin Telegram chat.
 * Returns { ok: true } on success, { ok: false, error } on any failure.
 * Never throws — callers treat Telegram as best-effort.
 */
export async function sendTelegramMessage(text: string): Promise<TelegramResult> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID?.trim();
  if (!botToken || !chatId) {
    return { ok: false, error: "Telegram not configured: missing TELEGRAM_BOT_TOKEN or TELEGRAM_ADMIN_CHAT_ID" };
  }
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // No parse_mode — plain text is safe with any school/user/transaction content
        body: JSON.stringify({ chat_id: chatId, text }),
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
 * Never throws — caller stores the result but does not block the response.
 */
export async function notifySmartPagesPayment(
  opts: SmartPagesPaymentNotificationOpts,
): Promise<TelegramResult> {
  return sendTelegramMessage(buildSmartPagesPaymentMessage(opts));
}
