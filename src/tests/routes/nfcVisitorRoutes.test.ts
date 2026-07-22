import express from "express";
import multer from "multer";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const svcMocks = vi.hoisted(() => ({
  listVisitorVisits: vi.fn(),
  getVisitorVisitDetail: vi.fn(),
  registerVisitor: vi.fn(),
  checkOutVisitor: vi.fn(),
}));

vi.mock("../../server/services/nfcVisitorService", () => ({
  listVisitorVisits: svcMocks.listVisitorVisits,
  getVisitorVisitDetail: svcMocks.getVisitorVisitDetail,
  registerVisitor: svcMocks.registerVisitor,
  checkOutVisitor: svcMocks.checkOutVisitor,
}));

import { enforceSchoolRoleAccess } from "../../server/middleware/enforceSchoolRoleAccess";
import { nfcOperationsRoutes } from "../../server/routes/nfcOperationsRoutes";

type Role = "ADMIN_OPERATOR" | "GATE_SECURITY";

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
  app.use(nfcOperationsRoutes());
  app.use((error: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (error instanceof multer.MulterError) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.status(typeof (error as { status?: unknown })?.status === "number" ? (error as { status: number }).status : 500)
      .json({ error: error instanceof Error ? error.message : "Unexpected error" });
  });
  return app;
}

describe("NFC visitor routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    svcMocks.listVisitorVisits.mockResolvedValue({ visits: [] });
    svcMocks.getVisitorVisitDetail.mockResolvedValue({ visit: { id: "visit-1", status: "CHECKED_IN" } });
    svcMocks.registerVisitor.mockResolvedValue({ visit: { id: "visit-1", status: "CHECKED_IN" } });
    svcMocks.checkOutVisitor.mockResolvedValue({ visit: { id: "visit-1", status: "CHECKED_OUT" }, duplicate: false });
  });

  it("allows gate staff to register and check out visitors", async () => {
    const app = buildApp("GATE_SECURITY");

    const registerRes = await request(app)
      .post("/api/nfc/visitors/register")
      .field("fullName", "Grace Hopper")
      .field("phone", "0774000001")
      .field("idDocumentType", "PASSPORT")
      .field("idDocumentNumber", "P1234567")
      .field("purpose", "Meeting bursar")
      .field("hostName", "Accounts office")
      .attach("idDocumentImage", Buffer.from("id"), { filename: "id.jpg", contentType: "image/jpeg" })
      .attach("selfieImage", Buffer.from("selfie"), { filename: "selfie.jpg", contentType: "image/jpeg" });

    const checkoutRes = await request(app).patch("/api/nfc/visitors/visit-1/check-out");

    expect(registerRes.status).toBe(201);
    expect(checkoutRes.status).toBe(200);
    expect(svcMocks.registerVisitor).toHaveBeenCalledWith(
      expect.objectContaining({ role: "GATE_SECURITY", schoolId: "school-1" }),
      expect.objectContaining({ fullName: "Grace Hopper", hostName: "Accounts office" }),
      expect.objectContaining({
        idDocumentImage: expect.objectContaining({ originalname: "id.jpg" }),
        selfieImage: expect.objectContaining({ originalname: "selfie.jpg" }),
      }),
    );
    expect(svcMocks.checkOutVisitor).toHaveBeenCalledWith(
      expect.objectContaining({ role: "GATE_SECURITY", schoolId: "school-1" }),
      "visit-1",
    );
  });

  it("returns safe 400 errors for missing visitor uploads", async () => {
    const app = buildApp("GATE_SECURITY");

    const res = await request(app)
      .post("/api/nfc/visitors/register")
      .field("fullName", "Grace Hopper")
      .field("idDocumentType", "PASSPORT")
      .field("idDocumentNumber", "P1234567")
      .field("purpose", "Meeting bursar")
      .field("hostName", "Accounts office");

    expect(res.status).toBe(400);
    expect(svcMocks.registerVisitor).not.toHaveBeenCalled();
  });

  it("allows admin to list and view visitor details", async () => {
    const app = buildApp("ADMIN_OPERATOR");

    const listRes = await request(app).get("/api/nfc/visitors").query({ status: "CURRENT" });
    const detailRes = await request(app).get("/api/nfc/visitors/visit-1");

    expect(listRes.status).toBe(200);
    expect(detailRes.status).toBe(200);
    expect(svcMocks.listVisitorVisits).toHaveBeenCalledWith(
      expect.objectContaining({ role: "ADMIN_OPERATOR", schoolId: "school-1" }),
      expect.objectContaining({ status: "CURRENT" }),
    );
    expect(svcMocks.getVisitorVisitDetail).toHaveBeenCalledWith(
      expect.objectContaining({ role: "ADMIN_OPERATOR", schoolId: "school-1" }),
      "visit-1",
    );
  });
});
