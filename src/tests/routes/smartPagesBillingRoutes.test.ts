import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// ── Mock Prisma ───────────────────────────────────────────────────────────────

const mockPaymentFindFirst = vi.fn();
const mockPaymentUpdate = vi.fn();
const mockPaymentCreate = vi.fn();
const mockPaymentFindMany = vi.fn();
const schoolFindUnique = vi.fn();

vi.mock("../../server/db/prisma", () => ({
  prisma: {
    school: { findUnique: schoolFindUnique },
    smartPagePaymentRequest: {
      findFirst: mockPaymentFindFirst,
      findUnique: vi.fn(),
      update: mockPaymentUpdate,
      create: mockPaymentCreate,
      findMany: mockPaymentFindMany,
    },
  },
}));

// ── Mock smartPagesService ────────────────────────────────────────────────────

vi.mock("../../server/services/smartPagesService", () => ({
  getSummary: vi.fn().mockResolvedValue({ remainingPages: 10, trialClaimed: true }),
  getLedger: vi.fn().mockResolvedValue([]),
  claimTrial: vi.fn(),
  getSmartPagesPaymentConfig: vi.fn().mockReturnValue({ networks: [], packages: [] }),
  getSmartPagesPackage: vi.fn().mockReturnValue({
    code: "STARTER",
    name: "Starter",
    credits: 100,
    priceUgx: 50_000,
  }),
  getPaymentNetworkConfig: vi.fn().mockReturnValue({
    network: "MTN",
    merchantCode: "123456",
    merchantName: "MTN Mobile Money",
  }),
}));

// ── Mock Telegram ─────────────────────────────────────────────────────────────

const mockNotify = vi.fn();

vi.mock("../../server/services/telegramService", () => ({
  notifySmartPagesPayment: mockNotify,
  sendTelegramMessage: vi.fn(),
}));

// ── Constants ─────────────────────────────────────────────────────────────────

const SCHOOL_ID = "00000000-0000-0000-0000-000000000099";
const SCHOOL_CODE = "SCU-PREVIEW";
const PAYMENT_ID = "pay-aabbccdd-0001";

function makeSchool() {
  return { id: SCHOOL_ID, code: SCHOOL_CODE, name: "Buluba High School" };
}

function makePendingPayment(overrides: Record<string, unknown> = {}) {
  return {
    id: PAYMENT_ID,
    schoolId: SCHOOL_ID,
    packageCode: "STARTER",
    packageName: "Starter",
    credits: 100,
    amountUgx: 50_000,
    network: "MTN",
    merchantCode: "123456",
    merchantName: "MTN Mobile Money",
    paymentReference: `SMARTPAGES-${PAYMENT_ID}`,
    transactionId: null,
    payerPhone: null,
    proofScreenshotUrl: null,
    status: "PENDING",
    adminNotes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    telegramSentAt: null,
    telegramError: null,
    ...overrides,
  };
}

function makeUpdatedPayment(transactionId: string) {
  return {
    ...makePendingPayment({ transactionId }),
    updatedAt: new Date(),
  };
}

async function makeToken() {
  const { signToken } = await import("../../server/services/authService");
  return signToken({
    userId: "00000000-0000-0000-0000-000000000001",
    schoolId: SCHOOL_ID,
    name: "Test Admin",
    email: "admin@buluba.ac.ug",
    role: "ADMIN_OPERATOR",
  });
}

const RECEIPT_BODY = {
  packageCode: "STARTER",
  network: "MTN",
  amountUgx: 50_000,
  transactionId: "MP987654321",
};

// ── Test suite ────────────────────────────────────────────────────────────────

describe("PATCH /api/smart-pages/billing/payments/:paymentId/receipt", () => {
  let app: ReturnType<typeof import("../../server").createServer>;

  beforeAll(async () => {
    const { createServer } = await import("../../server");
    app = createServer();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    schoolFindUnique.mockResolvedValue(makeSchool());
    // First call finds the payment; second call (duplicate check) returns null
    mockPaymentFindFirst
      .mockResolvedValueOnce(makePendingPayment())
      .mockResolvedValue(null);
    mockPaymentUpdate.mockResolvedValue(makeUpdatedPayment(RECEIPT_BODY.transactionId));
    mockNotify.mockResolvedValue({ ok: true });
  });

  // 1. Receipt saves transaction ID
  it("saves the transaction ID on the payment request", async () => {
    const token = await makeToken();
    const res = await request(app)
      .patch(`/api/smart-pages/billing/payments/${PAYMENT_ID}/receipt`)
      .set("Authorization", `Bearer ${token}`)
      .send(RECEIPT_BODY);

    expect(res.status).toBe(200);
    expect(mockPaymentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ transactionId: "MP987654321" }),
      }),
    );
  });

  // 2. Receipt submission calls Telegram notification
  it("calls notifySmartPagesPayment after saving the receipt", async () => {
    const token = await makeToken();
    await request(app)
      .patch(`/api/smart-pages/billing/payments/${PAYMENT_ID}/receipt`)
      .set("Authorization", `Bearer ${token}`)
      .send(RECEIPT_BODY);

    expect(mockNotify).toHaveBeenCalledOnce();
    expect(mockNotify).toHaveBeenCalledWith(
      expect.objectContaining({
        transactionId: "MP987654321",
        schoolName: "Buluba High School",
      }),
    );
  });

  // 3. Successful Telegram send updates telegramSentAt
  it("updates telegramSentAt when Telegram succeeds", async () => {
    mockNotify.mockResolvedValue({ ok: true });
    const token = await makeToken();
    await request(app)
      .patch(`/api/smart-pages/billing/payments/${PAYMENT_ID}/receipt`)
      .set("Authorization", `Bearer ${token}`)
      .send(RECEIPT_BODY);

    // The second update call is the Telegram metadata update
    const calls = mockPaymentUpdate.mock.calls;
    const telegramUpdateCall = calls.find(
      (c) => c[0]?.data?.telegramSentAt !== undefined || c[0]?.data?.telegramError !== undefined,
    );
    expect(telegramUpdateCall).toBeDefined();
    expect(telegramUpdateCall![0].data.telegramSentAt).toBeInstanceOf(Date);
    expect(telegramUpdateCall![0].data.telegramError).toBeNull();
  });

  // 4. Failed Telegram send updates telegramError
  it("updates telegramError when Telegram fails", async () => {
    mockNotify.mockResolvedValue({ ok: false, error: "Bad Request: chat not found" });
    const token = await makeToken();
    await request(app)
      .patch(`/api/smart-pages/billing/payments/${PAYMENT_ID}/receipt`)
      .set("Authorization", `Bearer ${token}`)
      .send(RECEIPT_BODY);

    const calls = mockPaymentUpdate.mock.calls;
    const telegramUpdateCall = calls.find(
      (c) => c[0]?.data?.telegramError !== undefined,
    );
    expect(telegramUpdateCall).toBeDefined();
    expect(telegramUpdateCall![0].data.telegramSentAt).toBeNull();
    expect(telegramUpdateCall![0].data.telegramError).toContain("chat not found");
  });

  // 5. Missing Telegram env stores descriptive telegramError
  it("stores descriptive telegramError when env vars are missing", async () => {
    mockNotify.mockResolvedValue({
      ok: false,
      error: "Telegram not configured: missing TELEGRAM_BOT_TOKEN or TELEGRAM_ADMIN_CHAT_ID",
    });
    const token = await makeToken();
    await request(app)
      .patch(`/api/smart-pages/billing/payments/${PAYMENT_ID}/receipt`)
      .set("Authorization", `Bearer ${token}`)
      .send(RECEIPT_BODY);

    const calls = mockPaymentUpdate.mock.calls;
    const telegramUpdateCall = calls.find((c) => c[0]?.data?.telegramError !== undefined);
    expect(telegramUpdateCall).toBeDefined();
    expect(telegramUpdateCall![0].data.telegramError).toContain("Telegram not configured");
  });

  // 6. Customer receipt submission succeeds even if Telegram fails
  it("returns 200 to the customer even when Telegram fails", async () => {
    mockNotify.mockResolvedValue({ ok: false, error: "Telegram unreachable" });
    const token = await makeToken();
    const res = await request(app)
      .patch(`/api/smart-pages/billing/payments/${PAYMENT_ID}/receipt`)
      .set("Authorization", `Bearer ${token}`)
      .send(RECEIPT_BODY);

    expect(res.status).toBe(200);
    expect(res.body.payment).toBeDefined();
    expect(res.body.payment.transactionId).toBe("MP987654321");
  });

  // 7. Payment request remains PENDING until admin approval
  it("does not change payment status to CONFIRMED on receipt submission", async () => {
    const token = await makeToken();
    await request(app)
      .patch(`/api/smart-pages/billing/payments/${PAYMENT_ID}/receipt`)
      .set("Authorization", `Bearer ${token}`)
      .send(RECEIPT_BODY);

    // The receipt update call saves transactionId — must NOT touch status field
    const receiptUpdateCall = mockPaymentUpdate.mock.calls.find(
      (c) => c[0]?.data?.transactionId !== undefined,
    );
    expect(receiptUpdateCall).toBeDefined();
    expect(receiptUpdateCall![0].data).not.toHaveProperty("status");
  });

  // 8. telegramSentAt and telegramError are never both null after receipt submission
  it("always sets either telegramSentAt or telegramError after Telegram attempt", async () => {
    mockNotify.mockResolvedValue({ ok: false, error: "timeout" });
    const token = await makeToken();
    await request(app)
      .patch(`/api/smart-pages/billing/payments/${PAYMENT_ID}/receipt`)
      .set("Authorization", `Bearer ${token}`)
      .send(RECEIPT_BODY);

    const calls = mockPaymentUpdate.mock.calls;
    const telegramUpdateCall = calls.find(
      (c) => c[0]?.data?.telegramSentAt !== undefined || c[0]?.data?.telegramError !== undefined,
    );
    expect(telegramUpdateCall).toBeDefined();
    const { telegramSentAt, telegramError } = telegramUpdateCall![0].data;
    const bothNull = telegramSentAt === null && telegramError === null;
    expect(bothNull).toBe(false);
  });

  // 9. Returns 404 when payment not found
  it("returns 404 when the payment request does not exist", async () => {
    // Clear the once-queue from beforeEach and make all calls return null
    mockPaymentFindFirst.mockReset().mockResolvedValue(null);
    const token = await makeToken();
    const res = await request(app)
      .patch(`/api/smart-pages/billing/payments/nonexistent-id/receipt`)
      .set("Authorization", `Bearer ${token}`)
      .send(RECEIPT_BODY);

    expect(res.status).toBe(404);
    expect(mockNotify).not.toHaveBeenCalled();
  });
});

// ── POST /api/owner/test-telegram ─────────────────────────────────────────────

describe("POST /api/owner/test-telegram", () => {
  let app: ReturnType<typeof import("../../server").createServer>;

  beforeAll(async () => {
    const { createServer } = await import("../../server");
    app = createServer();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function makePlatformOwnerToken() {
    const { signToken } = await import("../../server/services/authService");
    return signToken({
      userId: "owner-00000000-0000-0000-0000-000000000001",
      schoolId: SCHOOL_ID,
      name: "Platform Owner",
      email: "owner@schoolconnect.ug",
      role: "ADMIN_OPERATOR",
      isPlatformOwner: true,
    } as Parameters<typeof signToken>[0]);
  }

  it("returns 401 when no token is provided", async () => {
    const res = await request(app).post("/api/owner/test-telegram");
    expect(res.status).toBe(401);
  });

  it("returns 403 when caller is not a platform owner", async () => {
    const token = await makeToken();
    const res = await request(app)
      .post("/api/owner/test-telegram")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it("returns { ok: true } when Telegram succeeds", async () => {
    const { sendTelegramMessage } = await import("../../server/services/telegramService");
    vi.mocked(sendTelegramMessage).mockResolvedValueOnce({ ok: true });

    const token = await makePlatformOwnerToken();
    const res = await request(app)
      .post("/api/owner/test-telegram")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it("returns { ok: false, error } when Telegram fails", async () => {
    const { sendTelegramMessage } = await import("../../server/services/telegramService");
    vi.mocked(sendTelegramMessage).mockResolvedValueOnce({ ok: false, error: "bot token invalid" });

    const token = await makePlatformOwnerToken();
    const res = await request(app)
      .post("/api/owner/test-telegram")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(false);
    expect(res.body.error).toContain("bot token invalid");
  });

  it("does not expose bot token in the response", async () => {
    const { sendTelegramMessage } = await import("../../server/services/telegramService");
    vi.mocked(sendTelegramMessage).mockResolvedValueOnce({ ok: false, error: "bot token invalid" });

    const token = await makePlatformOwnerToken();
    const res = await request(app)
      .post("/api/owner/test-telegram")
      .set("Authorization", `Bearer ${token}`);

    const body = JSON.stringify(res.body);
    expect(body).not.toContain("TELEGRAM_BOT_TOKEN");
  });
});
