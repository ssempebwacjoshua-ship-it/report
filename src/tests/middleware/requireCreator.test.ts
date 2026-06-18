import { describe, expect, it, vi, beforeEach } from "vitest";

const mockState = vi.hoisted(() => {
  const verifyTokenMock = vi.fn();
  const jwtVerifyMock = vi.fn();
  const findOrCreateSchoolOperatorCreatorMock = vi.fn();
  const findCreatorByIdMock = vi.fn();
  return {
    verifyTokenMock,
    jwtVerifyMock,
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

  it("preserves schoolId for school operators", async () => {
    mockState.verifyTokenMock.mockReturnValue({
      userId: "user-1",
      schoolId: "school-1",
      email: "admin@school.test",
      name: "School Admin",
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

  it("keeps external creators without a schoolId", async () => {
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
});
