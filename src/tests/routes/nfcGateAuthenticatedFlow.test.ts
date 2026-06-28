import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  signToken: vi.fn(() => "gate-session-token"),
  verifyToken: vi.fn(),
  verifyPassword: vi.fn(),
  validateSchoolSession: vi.fn(),
}));

const prismaMocks = vi.hoisted(() => ({
  schoolFindUnique: vi.fn(),
  userFindFirst: vi.fn(),
  userUpdate: vi.fn(),
  auditLogCreate: vi.fn(),
}));

const nfcMocks = vi.hoisted(() => ({
  getGateDashboard: vi.fn(),
  scanGate: vi.fn(),
  getAttendanceDashboard: vi.fn(),
}));

vi.mock("../../server/db/prisma", () => ({
  prisma: {
    school: { findUnique: prismaMocks.schoolFindUnique },
    user: {
      findFirst: prismaMocks.userFindFirst,
      update: prismaMocks.userUpdate,
    },
    auditLog: {
      create: prismaMocks.auditLogCreate,
    },
  },
}));

vi.mock("../../server/services/authService", () => ({
  signToken: authMocks.signToken,
  verifyToken: authMocks.verifyToken,
  verifyPassword: authMocks.verifyPassword,
}));

vi.mock("../../server/services/sessionValidationService", () => ({
  validateSchoolSession: authMocks.validateSchoolSession,
}));

vi.mock("../../server/services/nfcOperationsService", () => ({
  getGateDashboard: nfcMocks.getGateDashboard,
  scanGate: nfcMocks.scanGate,
  getAttendanceDashboard: nfcMocks.getAttendanceDashboard,
}));

import { enforceSchoolRoleAccess } from "../../server/middleware/enforceSchoolRoleAccess";
import { resolveSchoolContext } from "../../server/middleware/resolveSchoolContext";
import { authRoutes } from "../../server/routes/authRoutes";
import { nfcOperationsRoutes } from "../../server/routes/nfcOperationsRoutes";
import { settingsRoutes } from "../../server/routes/settingsRoutes";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(authRoutes());
  app.use(resolveSchoolContext);
  app.use(enforceSchoolRoleAccess);
  app.use(settingsRoutes());
  app.use(nfcOperationsRoutes());
  app.use((error: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(error?.status ?? 500).json({ error: error?.message ?? "Unexpected error" });
  });
  return app;
}

describe("authenticated NFC gate flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    const school = {
      id: "school-1",
      code: "SCU-PREVIEW",
      name: "Preview School",
      isActive: true,
    };
    const gateUser = {
      id: "gate-user-1",
      schoolId: school.id,
      name: "Gate Keeper",
      email: "gate@schoolconnect.test",
      role: "GATE_SECURITY",
      passwordHash: "hashed-password",
      isActive: true,
      isPlatformOwner: false,
      tokenVersion: 4,
    };
    const authPayload = {
      userId: gateUser.id,
      schoolId: school.id,
      name: gateUser.name,
      email: gateUser.email,
      role: gateUser.role,
      tokenVersion: gateUser.tokenVersion,
    };

    prismaMocks.schoolFindUnique.mockResolvedValue(school);
    prismaMocks.userFindFirst.mockResolvedValue(gateUser);
    prismaMocks.userUpdate.mockResolvedValue({});
    prismaMocks.auditLogCreate.mockResolvedValue({});
    authMocks.verifyPassword.mockResolvedValue(true);
    authMocks.signToken.mockReturnValue("gate-session-token");
    authMocks.verifyToken.mockReturnValue(authPayload);
    authMocks.validateSchoolSession.mockResolvedValue({
      user: {
        id: gateUser.id,
        schoolId: gateUser.schoolId,
        name: gateUser.name,
        email: gateUser.email,
        role: gateUser.role,
        tokenVersion: gateUser.tokenVersion,
        isPlatformOwner: false,
      },
      school,
      auth: authPayload,
    });
    nfcMocks.getGateDashboard.mockResolvedValue({ recentScans: [] });
    nfcMocks.scanGate.mockResolvedValue({
      result: "ALLOWED",
      reason: null,
      scannedAt: "2026-06-28T12:00:00.000Z",
      credentialStatus: "ACTIVE",
      todayAttendanceStatus: "NONE",
    });
    nfcMocks.getAttendanceDashboard.mockRejectedValue(Object.assign(new Error("You do not have permission for this action."), { status: 403 }));
  });

  it("lets a GATE_SECURITY user sign in, load the gate dashboard, and scan via gate endpoints", async () => {
    const app = buildApp();

    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "gate@schoolconnect.test", password: "password123", schoolCode: "SCU-PREVIEW" });

    expect(login.status).toBe(200);
    expect(login.body.token).toBe("gate-session-token");
    expect(login.body.user.role).toBe("GATE_SECURITY");
    expect(authMocks.signToken).toHaveBeenCalledWith(expect.objectContaining({
      role: "GATE_SECURITY",
      schoolId: "school-1",
      tokenVersion: 4,
    }));

    const authHeader = `Bearer ${login.body.token}`;
    const dashboard = await request(app).get("/api/nfc/gate").set("Authorization", authHeader);
    const scan = await request(app).post("/api/nfc/gate/scan").set("Authorization", authHeader).send({ tokenOrUid: "token-a" });
    const attendance = await request(app).get("/api/nfc/attendance").set("Authorization", authHeader);
    const settings = await request(app).get("/api/settings").set("Authorization", authHeader);

    expect(dashboard.status).toBe(200);
    expect(scan.status).toBe(200);
    expect(attendance.status).toBe(403);
    expect(settings.status).toBe(403);
    expect(nfcMocks.getGateDashboard).toHaveBeenCalledWith(expect.objectContaining({
      role: "GATE_SECURITY",
      schoolId: "school-1",
      actorId: "gate-user-1",
    }));
    expect(nfcMocks.scanGate).toHaveBeenCalledWith(
      expect.objectContaining({ role: "GATE_SECURITY", schoolId: "school-1", actorId: "gate-user-1" }),
      expect.objectContaining({ tokenOrUid: "token-a" }),
    );
  });
});
