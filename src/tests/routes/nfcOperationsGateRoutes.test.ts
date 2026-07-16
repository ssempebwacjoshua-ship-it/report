import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const svcMocks = vi.hoisted(() => ({
  getGateDashboard: vi.fn(),
  scanGate: vi.fn(),
  getAttendanceDashboard: vi.fn(),
  scanAttendance: vi.fn(),
}));

vi.mock("../../server/services/nfcOperationsService", () => ({
  getGateDashboard: svcMocks.getGateDashboard,
  scanGate: svcMocks.scanGate,
  getAttendanceDashboard: svcMocks.getAttendanceDashboard,
  scanAttendance: svcMocks.scanAttendance,
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
  app.get("/api/settings", (_req, res) => res.json({ ok: true }));
  app.use((error: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(error?.status ?? 500).json({ error: error?.message ?? "Unexpected error" });
  });
  return app;
}

function buildUnauthedApp() {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.user = null;
    req.school = null;
    next();
  });
  app.use(enforceSchoolRoleAccess);
  app.use(nfcOperationsRoutes());
  app.use((error: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(error?.status ?? 500).json({ error: error?.message ?? "Unexpected error" });
  });
  return app;
}

describe("NFC gate routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    svcMocks.getGateDashboard.mockResolvedValue({ recentScans: [] });
    svcMocks.scanGate.mockResolvedValue({
      result: "ALLOWED",
      reason: null,
      scannedAt: "2026-06-28T00:00:00.000Z",
      credentialStatus: "ACTIVE",
      todayAttendanceStatus: "NONE",
    });
    svcMocks.getAttendanceDashboard.mockResolvedValue({ summary: {}, rows: [] });
    svcMocks.scanAttendance.mockResolvedValue({ scan: {}, summary: {}, events: [] });
  });

  it("allows GATE_SECURITY to load the gate dashboard and scan gate tokens", async () => {
    const app = buildApp("GATE_SECURITY");

    const dashboardRes = await request(app).get("/api/nfc/gate");
    const scanRes = await request(app).post("/api/nfc/gate/scan").send({ tokenOrUid: "token-a" });

    expect(dashboardRes.status).toBe(200);
    expect(scanRes.status).toBe(200);
    expect(svcMocks.getGateDashboard).toHaveBeenCalledWith(expect.objectContaining({ role: "GATE_SECURITY", schoolId: "school-1" }));
    expect(svcMocks.scanGate).toHaveBeenCalledWith(expect.objectContaining({ role: "GATE_SECURITY", schoolId: "school-1" }), expect.objectContaining({ tokenOrUid: "token-a" }));
  });

  it("blocks GATE_SECURITY from attendance and settings routes", async () => {
    const app = buildApp("GATE_SECURITY");
    svcMocks.getAttendanceDashboard.mockRejectedValueOnce(Object.assign(new Error("You do not have permission for this action."), { status: 403 }));

    const attendanceRes = await request(app).get("/api/nfc/attendance");
    const settingsRes = await request(app).get("/api/settings");

    expect(attendanceRes.status).toBe(403);
    expect(settingsRes.status).toBe(403);
  });

  it("allows ADMIN_OPERATOR full NFC access", async () => {
    const app = buildApp("ADMIN_OPERATOR");

    const dashboardRes = await request(app).get("/api/nfc/gate");
    const attendanceRes = await request(app).get("/api/nfc/attendance");
    const settingsRes = await request(app).get("/api/settings");

    expect(dashboardRes.status).toBe(200);
    expect(attendanceRes.status).toBe(200);
    expect(settingsRes.status).toBe(200);
  });

  it("returns 401 for gate scan requests without an authenticated school session", async () => {
    const app = buildUnauthedApp();
    svcMocks.scanGate.mockImplementationOnce(async (context: { schoolId?: string; actorId?: string; role?: string }) => {
      if (!context.schoolId || !context.actorId || !context.role) {
        throw Object.assign(new Error("Authentication required."), { status: 401 });
      }
      return {
        result: "ALLOWED",
        reason: null,
        scannedAt: "2026-06-28T00:00:00.000Z",
        credentialStatus: "ACTIVE",
        todayAttendanceStatus: "NONE",
      };
    });

    const scanRes = await request(app).post("/api/nfc/gate/scan").send({ tokenOrUid: "token-a" });

    expect(scanRes.status).toBe(401);
  });
});
