import request from "supertest";
import { describe, expect, it, beforeEach, beforeAll, vi } from "vitest";

// ── Mock Prisma ───────────────────────────────────────────────────────────────

const schoolFindUnique = vi.fn();
const subFindUnique = vi.fn();
const subUpsert = vi.fn();
const invoiceCreate = vi.fn();

vi.mock("../../server/db/prisma", () => ({
  prisma: {
    school: { findUnique: schoolFindUnique },
    reportLabSubscription: {
      findUnique: subFindUnique,
      upsert: subUpsert,
    },
    reportLabInvoice: { create: invoiceCreate },
  },
}));

// ── Helpers ────────────────────────────────────────────────────────────────────

const SCHOOL_ID = "00000000-0000-0000-0000-000000000099";
const SCHOOL_CODE = "SCU-PREVIEW";

function makePreviewSchool() {
  return { id: SCHOOL_ID, code: SCHOOL_CODE, name: "School Connect Preview" };
}

async function makeToken() {
  const { signToken } = await import("../../server/services/authService");
  return signToken({
    userId: "00000000-0000-0000-0000-000000000001",
    schoolId: SCHOOL_ID,
    name: "Test Admin",
    email: "test@test.com",
    role: "ADMIN_OPERATOR",
    tokenVersion: 0,
  });
}

// ── GET /api/subscription ─────────────────────────────────────────────────────

describe("GET /api/subscription", () => {
  let app: ReturnType<typeof import("../../server").createServer>;

  beforeAll(async () => {
    const { createServer } = await import("../../server");
    app = createServer();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    schoolFindUnique.mockResolvedValue(makePreviewSchool());
    subFindUnique.mockResolvedValue(null);
  });

  it("returns { subscription: null } when school has no subscription", async () => {
    subFindUnique.mockResolvedValue(null);
    const token = await makeToken();
    const res = await request(app)
      .get("/api/subscription")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ subscription: null });
  });

  it("returns subscription shape when subscription exists", async () => {
    const now = new Date("2026-06-16T00:00:00.000Z");
    const end = new Date("2027-06-16T00:00:00.000Z");

    subFindUnique.mockResolvedValue({
      id: "sub-id-1",
      planCode: "REPORT_LAB_1000",
      billingCycle: "YEAR",
      studentLimit: 1000,
      currentPeriodStart: now,
      currentPeriodEnd: end,
      status: "ACTIVE",
      invoices: [],
    });

    const token = await makeToken();
    const res = await request(app)
      .get("/api/subscription")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    const sub = res.body.subscription;
    expect(sub.planCode).toBe("REPORT_LAB_1000");
    expect(sub.status).toBe("ACTIVE");
    expect(sub.billingCycle).toBe("YEAR");
    expect(sub.studentLimit).toBe(1000);
    expect(sub.latestInvoice).toBeNull();
    expect(typeof sub.currentPeriodEnd).toBe("string");
  });

  it("includes latestInvoice fields when invoice exists", async () => {
    const now = new Date("2026-06-16T00:00:00.000Z");
    const end = new Date("2027-06-16T00:00:00.000Z");
    const paidAt = new Date("2026-06-16T00:00:00.000Z");

    subFindUnique.mockResolvedValue({
      id: "sub-id-2",
      planCode: "REPORT_LAB_1000",
      billingCycle: "YEAR",
      studentLimit: 1000,
      currentPeriodStart: now,
      currentPeriodEnd: end,
      status: "ACTIVE",
      invoices: [
        {
          id: "inv-id-1",
          setupFeeUgx: 500_000,
          amountUgx: 600_000,
          totalUgx: 1_100_000,
          status: "PAID",
          paidAt,
          notes: null,
          createdAt: now,
        },
      ],
    });

    const token = await makeToken();
    const res = await request(app)
      .get("/api/subscription")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    const inv = res.body.subscription?.latestInvoice;
    expect(inv).not.toBeNull();
    expect(inv.setupFeeUgx).toBe(500_000);
    expect(inv.amountUgx).toBe(600_000);
    expect(inv.totalUgx).toBe(1_100_000);
    expect(inv.status).toBe("PAID");
  });
});

// ── POST /api/platform/schools/:schoolCode/subscription ────────────────────────

describe("POST /api/platform/schools/:schoolCode/subscription", () => {
  const PLATFORM_KEY = "test-platform-key-sub";
  let app: ReturnType<typeof import("../../server").createServer>;

  beforeAll(async () => {
    process.env.PLATFORM_ADMIN_KEY = PLATFORM_KEY;
    const { createServer } = await import("../../server");
    app = createServer();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    schoolFindUnique.mockResolvedValue(makePreviewSchool());
    subUpsert.mockResolvedValue({
      id: "sub-id-3",
      planCode: "REPORT_LAB_1000",
      status: "ACTIVE",
    });
    invoiceCreate.mockResolvedValue({
      id: "inv-id-2",
      totalUgx: 1_100_000,
      status: "PAID",
    });
  });

  const validPayload = {
    planCode: "REPORT_LAB_1000",
    currentPeriodStart: "2026-06-16T00:00:00.000Z",
    currentPeriodEnd: "2027-06-16T00:00:00.000Z",
    invoice: { setupFeeUgx: 500_000, amountUgx: 600_000, totalUgx: 1_100_000, status: "PAID" },
  };

  it("returns 401 without platform key", async () => {
    const res = await request(app)
      .post("/api/platform/schools/SCU-PREVIEW/subscription")
      .send(validPayload);
    expect(res.status).toBe(401);
  });

  it("returns 401 with wrong platform key", async () => {
    const res = await request(app)
      .post("/api/platform/schools/SCU-PREVIEW/subscription")
      .set("Authorization", "PlatformKey wrong-key")
      .send(validPayload);
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid planCode", async () => {
    const res = await request(app)
      .post("/api/platform/schools/SCU-PREVIEW/subscription")
      .set("Authorization", `PlatformKey ${PLATFORM_KEY}`)
      .send({ ...validPayload, planCode: "INVALID_PLAN" });
    expect(res.status).toBe(400);
  });

  it("returns 404 when school does not exist", async () => {
    schoolFindUnique.mockResolvedValue(null);
    const res = await request(app)
      .post("/api/platform/schools/NO-SUCH-SCHOOL/subscription")
      .set("Authorization", `PlatformKey ${PLATFORM_KEY}`)
      .send(validPayload);
    expect(res.status).toBe(404);
  });

  it("creates subscription and returns success shape for valid request", async () => {
    const res = await request(app)
      .post("/api/platform/schools/SCU-PREVIEW/subscription")
      .set("Authorization", `PlatformKey ${PLATFORM_KEY}`)
      .send(validPayload);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.subscription.planCode).toBe("REPORT_LAB_1000");
    expect(res.body.invoice.totalUgx).toBe(1_100_000);
  });
});

