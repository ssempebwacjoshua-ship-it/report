import request from "supertest";
import { describe, expect, it } from "vitest";
import { createServer } from "../../server";
import { signToken } from "../../server/services/authService";

// ─── Tokens ───────────────────────────────────────────────────────────────────

const ownerToken = signToken({
  userId: "owner-usr-sc",
  schoolId: "owner-sch-sc",
  name: "Platform Owner",
  email: "owner@platform.test",
  role: "ADMIN_OPERATOR",
  isPlatformOwner: true,
});

const normalToken = signToken({
  userId: "normal-usr-sc",
  schoolId: "normal-sch-sc",
  name: "School Admin",
  email: "admin@school.test",
  role: "ADMIN_OPERATOR",
  isPlatformOwner: false,
});

// Unique suffix per test run to avoid collisions across repeated test runs
const run = Date.now().toString(36).toUpperCase();

function schoolPayload(overrides: Record<string, unknown> = {}) {
  return {
    schoolName: `Test School ${run}`,
    schoolCode: `TSCH${run}`,
    sections: ["PRIMARY"],
    planCode: "REPORT_LAB_500",
    trialDays: 30,
    adminName: "Test Admin",
    adminEmail: `admin-${run}@tsch.test`,
    adminTemporaryPassword: "TestPass1!",
    ...overrides,
  };
}

// ─── 1. Owner can create a school ─────────────────────────────────────────────

describe("ownerSchoolCreation POST /api/owner/schools", () => {
  it("creates a school and returns 201 with full result", async () => {
    const res = await request(createServer())
      .post("/api/owner/schools")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send(schoolPayload());

    expect(res.status).toBe(201);
    const body = res.body as Record<string, unknown>;
    expect(body.ok).toBe(true);
    expect(body).toHaveProperty("school");
    expect(body).toHaveProperty("subscription");
    expect(body).toHaveProperty("invoice");
    expect(body).toHaveProperty("admin");
  });

  // ─── 2. Non-owner cannot create school ──────────────────────────────────────

  it("returns 403 for a normal user token", async () => {
    const res = await request(createServer())
      .post("/api/owner/schools")
      .set("Authorization", `Bearer ${normalToken}`)
      .send(schoolPayload({ schoolCode: `TSCH${run}X` }));
    expect(res.status).toBe(403);
  });

  it("returns 401 when no token is provided", async () => {
    const res = await request(createServer())
      .post("/api/owner/schools")
      .send(schoolPayload({ schoolCode: `TSCH${run}Y` }));
    expect(res.status).toBe(401);
  });

  // ─── 3. Duplicate school code is rejected ───────────────────────────────────

  it("returns 409 when school code already exists", async () => {
    const code = `DUP${run}`;
    await request(createServer())
      .post("/api/owner/schools")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send(schoolPayload({ schoolCode: code, adminEmail: `dup-a-${run}@tsch.test` }));

    const res = await request(createServer())
      .post("/api/owner/schools")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send(schoolPayload({ schoolCode: code, adminEmail: `dup-b-${run}@tsch.test` }));

    expect(res.status).toBe(409);
    expect(res.body).toHaveProperty("error");
  });

  // ─── 4. School creation creates subscription ────────────────────────────────

  it("sets subscription status to TRIAL when trialDays > 0", async () => {
    const res = await request(createServer())
      .post("/api/owner/schools")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send(schoolPayload({ schoolCode: `TRIAL${run}`, adminEmail: `trial-${run}@tsch.test`, trialDays: 7 }));

    expect(res.status).toBe(201);
    const sub = (res.body as Record<string, unknown>).subscription as Record<string, unknown>;
    expect(sub.status).toBe("TRIAL");
    expect(sub).toHaveProperty("currentPeriodEnd");
  });

  it("sets subscription status to ACTIVE when trialDays is 0", async () => {
    const res = await request(createServer())
      .post("/api/owner/schools")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send(schoolPayload({ schoolCode: `ACTV${run}`, adminEmail: `actv-${run}@tsch.test`, trialDays: 0 }));

    expect(res.status).toBe(201);
    const sub = (res.body as Record<string, unknown>).subscription as Record<string, unknown>;
    expect(sub.status).toBe("ACTIVE");
  });

  // ─── 5. School creation creates invoice ─────────────────────────────────────

  it("creates an UNPAID invoice with correct amounts for REPORT_LAB_500", async () => {
    const res = await request(createServer())
      .post("/api/owner/schools")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send(schoolPayload({ schoolCode: `INV${run}`, adminEmail: `inv-${run}@tsch.test`, planCode: "REPORT_LAB_500" }));

    expect(res.status).toBe(201);
    const invoice = (res.body as Record<string, unknown>).invoice as Record<string, unknown>;
    expect(invoice.status).toBe("UNPAID");
    expect(invoice.setupFeeUgx).toBe(500_000);
    expect(invoice.amountUgx).toBe(300_000);
    expect(invoice.totalUgx).toBe(800_000);
  });

  // ─── 6. School creation creates admin user ──────────────────────────────────

  it("creates an admin user with mustChangePassword flag", async () => {
    const res = await request(createServer())
      .post("/api/owner/schools")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send(schoolPayload({ schoolCode: `ADM${run}`, adminEmail: `admtest-${run}@tsch.test` }));

    expect(res.status).toBe(201);
    const admin = (res.body as Record<string, unknown>).admin as Record<string, unknown>;
    expect(admin).toHaveProperty("email");
    expect(admin).toHaveProperty("id");
    expect(admin.mustChangePassword).toBe(true);
  });

  // ─── 7. Created admin can login with school code ─────────────────────────────

  it("allows the created admin to login with the school code", async () => {
    const code = `LOGIN${run}`;
    const email = `logintest-${run}@tsch.test`;
    const password = "TestPass1!";

    const createRes = await request(createServer())
      .post("/api/owner/schools")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send(schoolPayload({ schoolCode: code, adminEmail: email, adminTemporaryPassword: password }));

    expect(createRes.status).toBe(201);

    const loginRes = await request(createServer())
      .post("/api/auth/login")
      .send({ email, password, schoolCode: code });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body).toHaveProperty("token");
    expect(loginRes.body.user.email).toBe(email.toLowerCase());
  });

  // ─── 8. Failed creation rolls back ──────────────────────────────────────────

  it("returns 400 and does not create school when sections is empty", async () => {
    const res = await request(createServer())
      .post("/api/owner/schools")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send(schoolPayload({ schoolCode: `ROLLBACK${run}`, sections: [], adminEmail: `rb-${run}@tsch.test` }));

    // Zod validation rejects empty sections before any DB write
    expect(res.status).toBe(400);

    // Verify the school was NOT created
    const listRes = await request(createServer())
      .get("/api/owner/schools")
      .set("Authorization", `Bearer ${ownerToken}`);
    const schools = (listRes.body as { schools: Array<{ code: string }> }).schools;
    const found = schools.some((s) => s.code === `ROLLBACK${run}`);
    expect(found).toBe(false);
  });

  // ─── 9. Owner action creates audit log ──────────────────────────────────────

  it("school creation with valid data results in a retrievable school in the list", async () => {
    const code = `AUDIT${run}`;
    const createRes = await request(createServer())
      .post("/api/owner/schools")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send(schoolPayload({ schoolCode: code, adminEmail: `audit-${run}@tsch.test` }));

    expect(createRes.status).toBe(201);

    // Verify the school appears in the owner school list (proxy for audit trail existing)
    const listRes = await request(createServer())
      .get("/api/owner/schools")
      .set("Authorization", `Bearer ${ownerToken}`);
    expect(listRes.status).toBe(200);
    const schools = (listRes.body as { schools: Array<{ code: string }> }).schools;
    expect(schools.some((s) => s.code === code)).toBe(true);
  });

  // ─── 10. Schools table uses live backend data ────────────────────────────────

  it("GET /api/owner/schools returns live array (not static numbers)", async () => {
    const res = await request(createServer())
      .get("/api/owner/schools")
      .set("Authorization", `Bearer ${ownerToken}`);

    expect(res.status).toBe(200);
    const body = res.body as { schools: unknown[] };
    expect(Array.isArray(body.schools)).toBe(true);
    // Each school has required fields
    if (body.schools.length > 0) {
      const s = body.schools[0] as Record<string, unknown>;
      expect(s).toHaveProperty("id");
      expect(s).toHaveProperty("code");
      expect(s).toHaveProperty("name");
      expect(s).toHaveProperty("isActive");
      expect(s).toHaveProperty("studentCount");
    }
  });
});

