import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { enforceSchoolRoleAccess } from "../../server/middleware/enforceSchoolRoleAccess";
import { requireSchoolPermission } from "../../server/middleware/requireSchoolPermission";

type Role = "ADMIN_OPERATOR" | "TEACHER" | "CASHIER" | "CANTEEN" | "SECURITY" | "GATE_SECURITY";

function buildApp(role: Role) {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.user = {
      userId: "user-1",
      schoolId: "school-1",
      name: "Test User",
      email: "user@test.com",
      role,
      tokenVersion: 1,
    };
    req.school = { id: "school-1", code: "SCU-PREVIEW", name: "Preview" };
    next();
  });
  app.use(enforceSchoolRoleAccess);
  app.get("/api/students", (_req, res) => res.json({ ok: true }));
  app.get("/api/settings", (_req, res) => res.json({ ok: true }));
  app.post("/api/imports/scans/dry-run", (_req, res) => res.json({ ok: true }));
  app.post("/api/reports/issue", (_req, res) => res.status(201).json({ ok: true }));
  app.get("/api/settings/school-structure", (_req, res) => res.json({ ok: true }));
  app.get("/api/staff-users", (_req, res) => res.json({ ok: true }));
  app.post("/api/nfc/canteen/charge", (_req, res) => res.json({ ok: true }));
  app.post("/api/nfc/gate/scan", (_req, res) => res.json({ ok: true }));
  return app;
}

describe("school route permissions", () => {
  it("returns 401 when requireSchoolPermission runs without a user", async () => {
    const app = express();
    app.use(express.json());
    app.use(requireSchoolPermission("app.admin"));
    app.get("/api/settings", (_req, res) => res.json({ ok: true }));

    const res = await request(app).get("/api/settings");
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Authentication required.");
  });

  it("blocks TEACHER from student management APIs", async () => {
    const res = await request(buildApp("TEACHER")).get("/api/students");
    expect(res.status).toBe(403);
  });

  it("blocks TEACHER from settings and school-structure APIs", async () => {
    const settingsRes = await request(buildApp("TEACHER")).get("/api/settings");
    const structureRes = await request(buildApp("TEACHER")).get("/api/settings/school-structure");
    expect(settingsRes.status).toBe(403);
    expect(structureRes.status).toBe(403);
  });

  it("blocks TEACHER from imports and reports admin APIs", async () => {
    const importRes = await request(buildApp("TEACHER")).post("/api/imports/scans/dry-run").send({});
    const reportRes = await request(buildApp("TEACHER")).post("/api/reports/issue").send({});
    expect(importRes.status).toBe(403);
    expect(reportRes.status).toBe(403);
  });

  it("blocks CASHIER from student and settings admin APIs", async () => {
    const studentsRes = await request(buildApp("CASHIER")).get("/api/students");
    const settingsRes = await request(buildApp("CASHIER")).get("/api/settings");
    expect(studentsRes.status).toBe(403);
    expect(settingsRes.status).toBe(403);
  });

  it("blocks SECURITY from reports admin APIs", async () => {
    const res = await request(buildApp("SECURITY")).post("/api/reports/issue").send({});
    expect(res.status).toBe(403);
  });

  it("allows ADMIN_OPERATOR through admin APIs", async () => {
    const res = await request(buildApp("ADMIN_OPERATOR")).get("/api/settings");
    expect(res.status).toBe(200);
  });

  it("allows CASHIER on allowed NFC operations only", async () => {
    const res = await request(buildApp("CASHIER")).post("/api/nfc/canteen/charge").send({});
    expect(res.status).toBe(200);
  });

  it("allows SECURITY on allowed NFC operations only", async () => {
    const res = await request(buildApp("SECURITY")).post("/api/nfc/gate/scan").send({});
    expect(res.status).toBe(200);
  });

  it("blocks non-admin staff management access", async () => {
    const res = await request(buildApp("CANTEEN")).get("/api/staff-users");
    expect(res.status).toBe(403);
  });
});
