import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";

const mockState = vi.hoisted(() => ({
  schoolFindUnique: vi.fn(),
  userFindFirst: vi.fn(),
  userUpdate: vi.fn(),
  signToken: vi.fn(() => "signed-token"),
  verifyPassword: vi.fn(),
  verifyToken: vi.fn(),
  validateSchoolSession: vi.fn(),
}));

vi.mock("../../server/db/prisma", () => ({
  prisma: {
    school: { findUnique: mockState.schoolFindUnique },
    user: {
      findFirst: mockState.userFindFirst,
      update: mockState.userUpdate,
    },
  },
}));

vi.mock("../../server/services/authService", () => ({
  signToken: mockState.signToken,
  verifyPassword: mockState.verifyPassword,
  verifyToken: mockState.verifyToken,
}));

vi.mock("../../server/services/sessionValidationService", () => ({
  validateSchoolSession: mockState.validateSchoolSession,
}));

import { authRoutes } from "../../server/routes/authRoutes";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(authRoutes());
  app.use((error: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (error instanceof ZodError) {
      res.status(400).json({
        error: "Invalid request",
        fieldErrors: error.flatten().fieldErrors,
      });
      return;
    }
    res.status(error?.status ?? 500).json({
      error: error instanceof Error ? error.message : "Unexpected error.",
    });
  });
  return app;
}

describe("authRoutes /api/auth/login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState.schoolFindUnique.mockResolvedValue({ id: "school-1", code: "SCU-PREVIEW", isActive: true });
    mockState.userFindFirst.mockResolvedValue({
      id: "user-1",
      schoolId: "school-1",
      name: "Test Admin",
      email: "admin@schoolconnect.test",
      role: "ADMIN_OPERATOR",
      passwordHash: "hash",
      isActive: true,
      isPlatformOwner: false,
      tokenVersion: 2,
    });
    mockState.userUpdate.mockResolvedValue({});
    mockState.verifyPassword.mockResolvedValue(true);
  });

  it("returns JSON success for active school credentials", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const res = await request(buildApp())
      .post("/api/auth/login")
      .send({ email: "admin@schoolconnect.test", password: "password123", schoolCode: "SCU-PREVIEW" });

    expect(res.status).toBe(200);
    expect(res.body.token).toBe("signed-token");
    expect(res.body.user).toMatchObject({
      email: "admin@schoolconnect.test",
      role: "ADMIN_OPERATOR",
    });
    expect(mockState.signToken).toHaveBeenCalledWith(expect.objectContaining({
      userId: "user-1",
      tokenVersion: 2,
    }));
    expect(logSpy).not.toHaveBeenCalled();
    logSpy.mockRestore();
  });

  it("returns 401 for unknown email", async () => {
    mockState.userFindFirst.mockResolvedValue(null);
    mockState.verifyPassword.mockResolvedValue(false);

    const res = await request(buildApp())
      .post("/api/auth/login")
      .send({ email: "nobody@unknown.test", password: "password123", schoolCode: "SCU-PREVIEW" });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Invalid credentials.");
  });

  it("returns 400 for invalid email format", async () => {
    const res = await request(buildApp())
      .post("/api/auth/login")
      .send({ email: "not-an-email", password: "password123" });
    expect(res.status).toBe(400);
  });

  it("returns 403 for suspended school", async () => {
    mockState.schoolFindUnique.mockResolvedValue({ id: "school-1", code: "SCU-PREVIEW", isActive: false });

    const res = await request(buildApp())
      .post("/api/auth/login")
      .send({ email: "admin@schoolconnect.test", password: "password123", schoolCode: "SCU-PREVIEW" });

    expect(res.status).toBe(403);
  });
});

describe("authRoutes /api/auth/me", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockState.verifyToken.mockReturnValue({
      userId: "user-1",
      schoolId: "school-1",
      name: "Test Admin",
      email: "admin@schoolconnect.test",
      role: "ADMIN_OPERATOR",
      tokenVersion: 2,
    });
  });

  it("returns 401 without Authorization header", async () => {
    const res = await request(buildApp()).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("returns 401 with malformed token", async () => {
    mockState.verifyToken.mockReturnValue(null);
    const res = await request(buildApp())
      .get("/api/auth/me")
      .set("Authorization", "Bearer not.a.valid.jwt");
    expect(res.status).toBe(401);
  });

  it("rejects disabled user", async () => {
    mockState.validateSchoolSession.mockResolvedValue(null);

    const res = await request(buildApp())
      .get("/api/auth/me")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Invalid or expired session.");
  });

  it("rejects stale tokenVersion", async () => {
    mockState.validateSchoolSession.mockResolvedValue(null);

    const res = await request(buildApp())
      .get("/api/auth/me")
      .set("Authorization", "Bearer stale-token");

    expect(res.status).toBe(401);
  });

  it("rejects missing tokenVersion", async () => {
    mockState.verifyToken.mockReturnValue({
      userId: "user-1",
      schoolId: "school-1",
      name: "Test Admin",
      email: "admin@schoolconnect.test",
      role: "ADMIN_OPERATOR",
    });
    mockState.validateSchoolSession.mockResolvedValue(null);

    const res = await request(buildApp())
      .get("/api/auth/me")
      .set("Authorization", "Bearer missing-token-version");

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Invalid or expired session.");
  });

  it("rejects inactive school", async () => {
    mockState.validateSchoolSession.mockResolvedValue(null);

    const res = await request(buildApp())
      .get("/api/auth/me")
      .set("Authorization", "Bearer inactive-school-token");

    expect(res.status).toBe(401);
  });

  it("succeeds for active user and active school", async () => {
    mockState.validateSchoolSession.mockResolvedValue({
      user: {
        id: "user-1",
        schoolId: "school-1",
        name: "Test Admin",
        email: "admin@schoolconnect.test",
        role: "ADMIN_OPERATOR",
        tokenVersion: 2,
        isPlatformOwner: false,
      },
      school: { id: "school-1", code: "SCU-PREVIEW", name: "Preview", isActive: true },
      auth: {
        userId: "user-1",
        schoolId: "school-1",
        name: "Test Admin",
        email: "admin@schoolconnect.test",
        role: "ADMIN_OPERATOR",
        tokenVersion: 2,
      },
    });

    const res = await request(buildApp())
      .get("/api/auth/me")
      .set("Authorization", "Bearer active-token");

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({
      id: "user-1",
      schoolId: "school-1",
      email: "admin@schoolconnect.test",
      role: "ADMIN_OPERATOR",
    });
    expect(mockState.validateSchoolSession).toHaveBeenCalledWith(expect.objectContaining({
      tokenVersion: 2,
    }));
  });
});

describe("authRoutes /api/auth/logout", () => {
  it("always returns 200", async () => {
    const res = await request(buildApp()).post("/api/auth/logout");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});
