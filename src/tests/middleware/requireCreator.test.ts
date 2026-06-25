import { describe, expect, it, vi, beforeEach } from "vitest";

const mockState = vi.hoisted(() => {
  const verifyTokenMock = vi.fn();
  const jwtVerifyMock = vi.fn();
  const validateSchoolSessionMock = vi.fn();
  const findOrCreateSchoolOperatorCreatorMock = vi.fn();
  const findCreatorByIdMock = vi.fn();
  return {
    verifyTokenMock,
    jwtVerifyMock,
    validateSchoolSessionMock,
    findOrCreateSchoolOperatorCreatorMock,
    findCreatorByIdMock,
  };
});

vi.mock("../../server/services/authService", () => ({
  verifyToken: mockState.verifyTokenMock,
}));

vi.mock("jsonwebtoken", () => ({
  default: { verify: mockState.jwtVerifyMock },
  verify: mockState.jwtVerifyMock,
}));

vi.mock("../../server/services/sessionValidationService", () => ({
  validateSchoolSession: mockState.validateSchoolSessionMock,
}));

vi.mock("../../server/services/documentIntelligenceService", () => ({
  findOrCreateSchoolOperatorCreator: mockState.findOrCreateSchoolOperatorCreatorMock,
  findCreatorById: mockState.findCreatorByIdMock,
}));

import { requireCreator } from "../../server/middleware/requireCreator";

function createReq(auth?: string) {
  return {
    headers: auth ? { authorization: auth } : {},
  } as any;
}

function createRes() {
  const res: any = {
    statusCode: 200,
    body: null,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(payload: unknown) {
      res.body = payload;
      return res;
    },
  };
  return res;
}

describe("requireCreator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows active school administrators and preserves schoolId", async () => {
    mockState.verifyTokenMock.mockReturnValue({
      userId: "user-1",
      schoolId: "school-1",
      email: "admin@school.test",
      name: "School Admin",
      role: "ADMIN_OPERATOR",
    });
    mockState.validateSchoolSessionMock.mockResolvedValue({
      user: {
        id: "user-1",
        schoolId: "school-1",
        email: "admin@school.test",
        name: "School Admin",
        role: "ADMIN_OPERATOR",
        tokenVersion: 3,
        isPlatformOwner: false,
      },
      school: { id: "school-1", code: "SCU-PREVIEW", name: "Preview", isActive: true },
      auth: {
        userId: "user-1",
        schoolId: "school-1",
        email: "admin@school.test",
        name: "School Admin",
        role: "ADMIN_OPERATOR",
        tokenVersion: 3,
      },
    });
    mockState.findOrCreateSchoolOperatorCreatorMock.mockResolvedValue("creator-1");

    const req = createReq("Bearer school-token");
    const res = createRes();
    const next = vi.fn();

    await requireCreator(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.creator).toEqual({
      id: "creator-1",
      type: "SCHOOL_OPERATOR",
      email: "admin@school.test",
      name: "School Admin",
      schoolId: "school-1",
    });
  });

  it("rejects stale school JWTs", async () => {
    mockState.verifyTokenMock.mockReturnValue({
      userId: "user-1",
      schoolId: "school-1",
      email: "admin@school.test",
      name: "School Admin",
      role: "ADMIN_OPERATOR",
    });
    mockState.validateSchoolSessionMock.mockResolvedValue(null);

    const req = createReq("Bearer school-token");
    const res = createRes();
    const next = vi.fn();

    await requireCreator(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
  });

  it("rejects disabled school users", async () => {
    mockState.verifyTokenMock.mockReturnValue({
      userId: "user-1",
      schoolId: "school-1",
      email: "disabled@school.test",
      name: "Disabled User",
      role: "ADMIN_OPERATOR",
    });
    mockState.validateSchoolSessionMock.mockResolvedValue(null);

    const req = createReq("Bearer disabled-token");
    const res = createRes();
    const next = vi.fn();

    await requireCreator(req, res, next);

    expect(res.statusCode).toBe(401);
  });

  it("rejects inactive schools", async () => {
    mockState.verifyTokenMock.mockReturnValue({
      userId: "user-1",
      schoolId: "school-1",
      email: "admin@school.test",
      name: "School Admin",
      role: "ADMIN_OPERATOR",
    });
    mockState.validateSchoolSessionMock.mockResolvedValue(null);

    const req = createReq("Bearer inactive-school-token");
    const res = createRes();
    const next = vi.fn();

    await requireCreator(req, res, next);

    expect(res.statusCode).toBe(401);
  });

  it("rejects non-admin school users for Smart Pages management", async () => {
    mockState.verifyTokenMock.mockReturnValue({
      userId: "teacher-1",
      schoolId: "school-1",
      email: "teacher@school.test",
      name: "Teacher",
      role: "TEACHER",
    });
    mockState.validateSchoolSessionMock.mockResolvedValue({
      user: {
        id: "teacher-1",
        schoolId: "school-1",
        email: "teacher@school.test",
        name: "Teacher",
        role: "TEACHER",
        tokenVersion: 2,
        isPlatformOwner: false,
      },
      school: { id: "school-1", code: "SCU-PREVIEW", name: "Preview", isActive: true },
      auth: {
        userId: "teacher-1",
        schoolId: "school-1",
        email: "teacher@school.test",
        name: "Teacher",
        role: "TEACHER",
        tokenVersion: 2,
      },
    });

    const req = createReq("Bearer teacher-token");
    const res = createRes();
    const next = vi.fn();

    await requireCreator(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });

  it("keeps active external creators without a schoolId", async () => {
    mockState.verifyTokenMock.mockReturnValue(null);
    mockState.jwtVerifyMock.mockReturnValue({ creatorId: "external-1" });
    mockState.findCreatorByIdMock.mockResolvedValue({
      id: "external-1",
      type: "EXTERNAL",
      email: "creator@external.test",
      name: "External Creator",
      isActive: true,
    });

    const req = createReq("Bearer external-token");
    const res = createRes();
    const next = vi.fn();

    await requireCreator(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.creator).toEqual({
      id: "external-1",
      type: "EXTERNAL",
      email: "creator@external.test",
      name: "External Creator",
      schoolId: null,
    });
  });

  it("rejects inactive external creators", async () => {
    mockState.verifyTokenMock.mockReturnValue(null);
    mockState.jwtVerifyMock.mockReturnValue({ creatorId: "external-1" });
    mockState.findCreatorByIdMock.mockResolvedValue({
      id: "external-1",
      type: "EXTERNAL",
      email: "creator@external.test",
      name: "External Creator",
      isActive: false,
    });

    const req = createReq("Bearer external-token");
    const res = createRes();
    const next = vi.fn();

    await requireCreator(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
  });

  it("hides internal creator resolution details from the client", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockState.verifyTokenMock.mockReturnValue({
      userId: "user-1",
      schoolId: "school-1",
      email: "admin@school.test",
      name: "School Admin",
      role: "ADMIN_OPERATOR",
    });
    mockState.validateSchoolSessionMock.mockResolvedValue({
      user: {
        id: "user-1",
        schoolId: "school-1",
        email: "admin@school.test",
        name: "School Admin",
        role: "ADMIN_OPERATOR",
        tokenVersion: 3,
        isPlatformOwner: false,
      },
      school: { id: "school-1", code: "SCU-PREVIEW", name: "Preview", isActive: true },
      auth: {
        userId: "user-1",
        schoolId: "school-1",
        email: "admin@school.test",
        name: "School Admin",
        role: "ADMIN_OPERATOR",
        tokenVersion: 3,
      },
    });
    mockState.findOrCreateSchoolOperatorCreatorMock.mockRejectedValue(new Error("database exploded"));

    const req = createReq("Bearer school-token");
    const res = createRes();
    const next = vi.fn();

    await requireCreator(req, res, next);

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ error: "Failed to resolve creator context." });
    expect(res.body).not.toHaveProperty("detail");
    errorSpy.mockRestore();
  });
});
