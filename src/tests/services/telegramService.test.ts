import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildSmartPagesPaymentMessage,
  notifySmartPagesPayment,
  sendTelegramMessage,
  sendSupportTelegramMessage,
} from "../../server/services/telegramService";

const OPTS = {
  schoolName: "BULUBA HIGH SCHOOL",
  userName: "ssempaka",
  packageName: "Starter",
  pages: 100,
  amountUgx: 50_000,
  network: "MTN",
  transactionId: "MP123456789",
  paymentId: "payreq_abc",
  paymentReference: "SMARTPAGES-abc",
  submittedAt: "2026-06-19T10:00:00Z",
};

describe("buildSmartPagesPaymentMessage", () => {
  it("includes all required payment fields", () => {
    const msg = buildSmartPagesPaymentMessage(OPTS);
    expect(msg).toContain("BULUBA HIGH SCHOOL");
    expect(msg).toContain("ssempaka");
    expect(msg).toContain("Starter");
    expect(msg).toContain("100");
    expect(msg).toContain("50,000");
    expect(msg).toContain("MP123456789");
    expect(msg).toContain("payreq_abc");
    expect(msg).toContain("PENDING");
  });

  it("includes admin action instruction", () => {
    const msg = buildSmartPagesPaymentMessage(OPTS);
    expect(msg).toContain("approve or reject");
  });

  it("includes school name verbatim (plain text — no HTML escaping)", () => {
    const msg = buildSmartPagesPaymentMessage({
      ...OPTS,
      schoolName: "School <A&B> 'Test'",
    });
    // Plain text mode: raw characters are safe, no HTML entity conversion
    expect(msg).toContain("School <A&B> 'Test'");
    expect(msg).not.toContain("&lt;");
    expect(msg).not.toContain("&amp;");
  });

  it("does not contain HTML tags", () => {
    const msg = buildSmartPagesPaymentMessage(OPTS);
    expect(msg).not.toMatch(/<b>|<\/b>|<code>|<\/code>/);
  });
});

describe("sendTelegramMessage", () => {
  beforeEach(() => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "test-bot-token");
    vi.stubEnv("TELEGRAM_ADMIN_CHAT_ID", "123456");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("returns ok=false if TELEGRAM_BOT_TOKEN is not set", async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "");
    const result = await sendTelegramMessage("test");
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/Telegram not configured/i);
    expect(result.error).toContain("TELEGRAM_BOT_TOKEN");
  });

  it("returns ok=false if TELEGRAM_ADMIN_CHAT_ID is not set", async () => {
    vi.stubEnv("TELEGRAM_ADMIN_CHAT_ID", "");
    const result = await sendTelegramMessage("test");
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/Telegram not configured/i);
    expect(result.error).toContain("TELEGRAM_ADMIN_CHAT_ID");
  });

  it("sends without parse_mode (plain text)", async () => {
    let capturedBody: Record<string, unknown> = {};
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
      capturedBody = JSON.parse(init.body as string) as Record<string, unknown>;
      return { json: async () => ({ ok: true }) };
    }));
    await sendTelegramMessage("hello world");
    expect(capturedBody).not.toHaveProperty("parse_mode");
    expect(capturedBody.text).toBe("hello world");
  });

  it("returns ok=true when Telegram API returns ok=true", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      json: async () => ({ ok: true }),
    }));
    const result = await sendTelegramMessage("Hello");
    expect(result.ok).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("returns ok=false with error description when Telegram API returns ok=false", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      json: async () => ({ ok: false, description: "Bad Request: chat not found" }),
    }));
    const result = await sendTelegramMessage("Hello");
    expect(result.ok).toBe(false);
    expect(result.error).toContain("chat not found");
  });

  it("returns ok=false and captures error message when fetch throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network error")));
    const result = await sendTelegramMessage("Hello");
    expect(result.ok).toBe(false);
    expect(result.error).toContain("Network error");
  });

  it("never throws — always returns a result object", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));
    await expect(sendTelegramMessage("Hello")).resolves.toMatchObject({ ok: false });
  });
});

describe("notifySmartPagesPayment", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("sends a message containing the school name and transaction ID", async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "tok");
    vi.stubEnv("TELEGRAM_ADMIN_CHAT_ID", "789");
    let capturedBody = "";
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
      capturedBody = init.body as string;
      return { json: async () => ({ ok: true }) };
    }));

    await notifySmartPagesPayment(OPTS);
    expect(capturedBody).toContain("BULUBA HIGH SCHOOL");
    expect(capturedBody).toContain("MP123456789");
  });

  it("does not expose bot token in the message body", async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "super-secret-token");
    vi.stubEnv("TELEGRAM_ADMIN_CHAT_ID", "789");
    let capturedBody = "";
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
      capturedBody = init.body as string;
      return { json: async () => ({ ok: true }) };
    }));

    await notifySmartPagesPayment(OPTS);
    expect(capturedBody).not.toContain("super-secret-token");
  });

  it("returns error result without throwing when Telegram is unreachable", async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "tok");
    vi.stubEnv("TELEGRAM_ADMIN_CHAT_ID", "789");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Timeout")));

    const result = await notifySmartPagesPayment(OPTS);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("Timeout");
  });
});

describe("sendSupportTelegramMessage", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("uses the default support chat id when TELEGRAM_SUPPORT_CHAT_ID is missing", async () => {
    let capturedBody: Record<string, unknown> = {};
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "test-bot-token");
    vi.stubEnv("TELEGRAM_SUPPORT_CHAT_ID", "");
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async (_url: string, init: RequestInit) => {
      capturedBody = JSON.parse(String(init.body)) as Record<string, unknown>;
      return { json: async () => ({ ok: true }) };
    }));

    const result = await sendSupportTelegramMessage("Support request");

    expect(result.ok).toBe(true);
    expect(capturedBody.chat_id).toBe("8899226749");
  });
});
