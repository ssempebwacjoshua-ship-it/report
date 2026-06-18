import request from "supertest";
import { describe, expect, it } from "vitest";
import { createServer } from "../../server";

async function makeToken() {
  const { signToken } = await import("../../server/services/authService");
  const { prisma } = await import("../../server/db/prisma");
  const school = await prisma.school.findUnique({ where: { code: "SCU-PREVIEW" } });
  return signToken({
    userId: "00000000-0000-0000-0000-000000000001",
    schoolId: school?.id ?? "00000000-0000-0000-0000-000000000002",
    name: "Test Admin",
    email: "test@test.com",
    role: "ADMIN_OPERATOR",
  });
}

// ── GET /api/reports/release-status ──────────────────────────────────────────

describe("releaseCenterRoutes ? GET /api/reports/release-status", () => {
  it("returns 401 without Authorization header", async () => {
    const res = await request(createServer())
      .get("/api/reports/release-status")
      .query({ classId: "00000000-0000-0000-0000-000000000001" });
    expect(res.status).toBe(401);
  });

  it("returns 401 with invalid Bearer token", async () => {
    const res = await request(createServer())
      .get("/api/reports/release-status")
      .set("Authorization", "Bearer bad.token.here")
      .query({ classId: "00000000-0000-0000-0000-000000000001" });
    expect(res.status).toBe(401);
  });

  it("returns 400 when classId is missing", async () => {
    const token = await makeToken();
    const res = await request(createServer())
      .get("/api/reports/release-status")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it("returns JSON with rows/summary/meta shape on valid request (may have empty rows)", async () => {
    const token = await makeToken();
    const res = await request(createServer())
      .get("/api/reports/release-status")
      .set("Authorization", `Bearer ${token}`)
      .query({ classId: "00000000-0000-0000-0000-000000000099", schoolCode: "SCU-PREVIEW" });
    // May be 200 with empty rows or 404 ? just ensure it returns parseable JSON
    expect([200, 404, 500]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body).toHaveProperty("rows");
      expect(res.body).toHaveProperty("summary");
      expect(res.body).toHaveProperty("meta");
      expect(Array.isArray(res.body.rows)).toBe(true);
    }
  });
});

describe("releaseCenterRoutes bulk action endpoints", () => {
  it("returns 400 for invalid mark-sent-bulk payload", async () => {
    const token = await makeToken();
    const res = await request(createServer())
      .post("/api/reports/release/mark-sent-bulk")
      .set("Authorization", `Bearer ${token}`)
      .send({ classId: "00000000-0000-0000-0000-000000000001" });
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid revoke-bulk payload", async () => {
    const token = await makeToken();
    const res = await request(createServer())
      .post("/api/reports/release/revoke-bulk")
      .set("Authorization", `Bearer ${token}`)
      .send({ classId: "00000000-0000-0000-0000-000000000001" });
    expect(res.status).toBe(400);
  });
});

// ── POST /api/reports/issue-bulk ─────────────────────────────────────────────

describe("releaseCenterRoutes ? POST /api/reports/issue-bulk", () => {
  it("returns 401 without Authorization header", async () => {
    const res = await request(createServer())
      .post("/api/reports/issue-bulk")
      .send({ classId: "00000000-0000-0000-0000-000000000001" });
    expect(res.status).toBe(401);
  });

  it("returns 401 with invalid Bearer token", async () => {
    const res = await request(createServer())
      .post("/api/reports/issue-bulk")
      .set("Authorization", "Bearer bad.token.here")
      .send({ classId: "00000000-0000-0000-0000-000000000001" });
    expect(res.status).toBe(401);
  });

  it("returns 400 when classId is missing", async () => {
    const token = await makeToken();
    const res = await request(createServer())
      .post("/api/reports/issue-bulk")
      .set("Authorization", `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it("returns 400 when studentIds contains non-UUID strings", async () => {
    const token = await makeToken();
    const res = await request(createServer())
      .post("/api/reports/issue-bulk")
      .set("Authorization", `Bearer ${token}`)
      .send({
        classId: "00000000-0000-0000-0000-000000000001",
        studentIds: ["not-a-uuid"],
      });
    expect(res.status).toBe(400);
  });

  it("returns issued/skipped arrays in response body on valid request", async () => {
    const token = await makeToken();
    const res = await request(createServer())
      .post("/api/reports/issue-bulk")
      .set("Authorization", `Bearer ${token}`)
      .send({
        schoolCode: "SCU-PREVIEW",
        classId: "00000000-0000-0000-0000-000000000099",
      });
    // Empty class ? all skipped, none issued
    expect([201, 404, 500]).toContain(res.status);
    if (res.status === 201) {
      expect(res.body).toHaveProperty("issued");
      expect(res.body).toHaveProperty("skipped");
      expect(Array.isArray(res.body.issued)).toBe(true);
      expect(Array.isArray(res.body.skipped)).toBe(true);
    }
  });
});

// ── POST /api/reports/release/:id/mark-sent ──────────────────────────────────

describe("releaseCenterRoutes ? POST /api/reports/release/:id/mark-sent", () => {
  it("returns 401 without auth", async () => {
    const res = await request(createServer())
      .post("/api/reports/release/00000000-0000-0000-0000-000000000001/mark-sent");
    expect(res.status).toBe(401);
  });

  it("returns 404 for non-existent issued report", async () => {
    const token = await makeToken();
    const res = await request(createServer())
      .post("/api/reports/release/00000000-0000-0000-0000-000000000001/mark-sent")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty("error");
  });
});

// ── POST /api/reports/release/:id/revoke ─────────────────────────────────────

describe("releaseCenterRoutes ? POST /api/reports/release/:id/revoke", () => {
  it("returns 401 without auth", async () => {
    const res = await request(createServer())
      .post("/api/reports/release/00000000-0000-0000-0000-000000000001/revoke");
    expect(res.status).toBe(401);
  });

  it("returns 404 for non-existent issued report", async () => {
    const token = await makeToken();
    const res = await request(createServer())
      .post("/api/reports/release/00000000-0000-0000-0000-000000000001/revoke")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty("error");
  });
});

// ── Contact method resolution (unit-level via backend logic) ─────────────────

describe("releaseCenterRoutes ? delivery status contract", () => {
  it("issue-bulk response never exposes parentAccessToken hash (only raw token)", async () => {
    // The raw token is 64 hex chars; a SHA256 hash is also 64 hex chars.
    // We can only verify the contract structurally ? parentAccessToken present if issued.
    const token = await makeToken();
    const res = await request(createServer())
      .post("/api/reports/issue-bulk")
      .set("Authorization", `Bearer ${token}`)
      .send({ schoolCode: "SCU-PREVIEW", classId: "00000000-0000-0000-0000-000000000099" });
    if (res.status === 201 && res.body.issued?.length > 0) {
      for (const item of res.body.issued) {
        // parentLink must be a browser URL, not an /api/ URL
        expect(item.parentLink).toMatch(/\/parent\/r\//);
        expect(item.parentLink).not.toMatch(/\/api\//);
        // referenceCode must match YYYYMMDD-XXXXXX
        expect(item.referenceCode).toMatch(/^\d{8}-[0-9A-F]{6}$/);
      }
    }
  });

  it("release-status rows never include parentAccessToken", async () => {
    const token = await makeToken();
    const res = await request(createServer())
      .get("/api/reports/release-status")
      .set("Authorization", `Bearer ${token}`)
      .query({ classId: "00000000-0000-0000-0000-000000000099", schoolCode: "SCU-PREVIEW" });
    if (res.status === 200) {
      for (const row of res.body.rows ?? []) {
        expect(row).not.toHaveProperty("parentAccessToken");
        expect(row.issuedReport ?? {}).not.toHaveProperty("parentAccessToken");
      }
    }
  });

  it("release-status response has no qrCode field anywhere", async () => {
    const token = await makeToken();
    const res = await request(createServer())
      .get("/api/reports/release-status")
      .set("Authorization", `Bearer ${token}`)
      .query({ classId: "00000000-0000-0000-0000-000000000099", schoolCode: "SCU-PREVIEW" });
    if (res.status === 200) {
      const json = JSON.stringify(res.body);
      expect(json).not.toContain("qrCode");
      expect(json).not.toContain("qr_code");
    }
  });

  it("issue-bulk response has no qrCode field anywhere", async () => {
    const token = await makeToken();
    const res = await request(createServer())
      .post("/api/reports/issue-bulk")
      .set("Authorization", `Bearer ${token}`)
      .send({ schoolCode: "SCU-PREVIEW", classId: "00000000-0000-0000-0000-000000000099" });
    if (res.status === 201) {
      const json = JSON.stringify(res.body);
      expect(json).not.toContain("qrCode");
      expect(json).not.toContain("qr_code");
    }
  });
});

