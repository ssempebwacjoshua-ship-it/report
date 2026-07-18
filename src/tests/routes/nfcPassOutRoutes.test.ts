import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const svcMocks = vi.hoisted(() => ({
  listStudentPassOuts: vi.fn(),
  searchPassOutStudents: vi.fn(),
  createStudentPassOut: vi.fn(),
  cancelStudentPassOut: vi.fn(),
}));

vi.mock("../../server/services/nfcPassOutService", () => ({
  listStudentPassOuts: svcMocks.listStudentPassOuts,
  searchPassOutStudents: svcMocks.searchPassOutStudents,
  createStudentPassOut: svcMocks.createStudentPassOut,
  cancelStudentPassOut: svcMocks.cancelStudentPassOut,
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
  app.use((error: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(error?.status ?? 500).json({ error: error?.message ?? "Unexpected error" });
  });
  return app;
}

describe("NFC pass-out routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    svcMocks.listStudentPassOuts.mockResolvedValue({ passOuts: [] });
    svcMocks.searchPassOutStudents.mockResolvedValue({ students: [] });
    svcMocks.createStudentPassOut.mockResolvedValue({
      passOut: { id: "passout-1", status: "APPROVED", studentId: "student-1" },
    });
    svcMocks.cancelStudentPassOut.mockResolvedValue({
      passOut: { id: "passout-1", status: "CANCELLED", studentId: "student-1" },
    });
  });

  it("allows ADMIN_OPERATOR to list and create pass-outs", async () => {
    const app = buildApp("ADMIN_OPERATOR");

    const listRes = await request(app).get("/api/nfc/pass-outs");
    const createRes = await request(app)
      .post("/api/nfc/pass-outs")
      .send({
        studentId: "123e4567-e89b-42d3-a456-426614174000",
        reason: "Medical appointment",
        activeFrom: "2026-07-19T10:00:00.000Z",
        activeUntil: "2026-07-19T12:00:00.000Z",
      });

    expect(listRes.status).toBe(200);
    expect(createRes.status).toBe(201);
    expect(svcMocks.listStudentPassOuts).toHaveBeenCalled();
    expect(svcMocks.createStudentPassOut).toHaveBeenCalledWith(
      expect.objectContaining({ role: "ADMIN_OPERATOR", schoolId: "school-1" }),
      expect.objectContaining({ reason: "Medical appointment" }),
    );
  });

  it("rejects invalid create payloads safely", async () => {
    const app = buildApp("ADMIN_OPERATOR");

    const res = await request(app)
      .post("/api/nfc/pass-outs")
      .send({
        studentId: "not-a-uuid",
        reason: "",
        activeFrom: "",
        activeUntil: "",
      });

    expect(res.status).toBe(400);
    expect(svcMocks.createStudentPassOut).not.toHaveBeenCalled();
  });

  it("lets ADMIN_OPERATOR cancel a pass-out", async () => {
    const app = buildApp("ADMIN_OPERATOR");

    const res = await request(app)
      .patch("/api/nfc/pass-outs/passout-1/cancel")
      .send({ reason: "Parent changed plan" });

    expect(res.status).toBe(200);
    expect(svcMocks.cancelStudentPassOut).toHaveBeenCalledWith(
      expect.objectContaining({ role: "ADMIN_OPERATOR", schoolId: "school-1" }),
      "passout-1",
      "Parent changed plan",
    );
  });

  it("keeps GATE_SECURITY out of pass-out management", async () => {
    const app = buildApp("GATE_SECURITY");
    svcMocks.listStudentPassOuts.mockRejectedValueOnce(Object.assign(new Error("You do not have permission for this action."), { status: 403 }));

    const res = await request(app).get("/api/nfc/pass-outs");

    expect(res.status).toBe(403);
  });
});
