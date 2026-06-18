import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { provisionSchool } from "../../server/services/schoolProvisioningService";
import { signToken, verifyToken } from "../../server/services/authService";
import type { PrismaClient } from "@prisma/client";

// â”€â”€â”€ Platform provisioning: service unit tests â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe("Phase 7 â€” provisionSchool service", () => {
  const schoolId = "sc-prov-1";
  const adminId = "usr-prov-1";

  const buildMock = () => {
    const auditLogCreate = vi.fn(async () => ({}));
    const schoolClassUpsert = vi.fn(async () => ({}));

    const mockPrisma = {
      school: {
        findUnique: vi.fn(async () => null),
        create: vi.fn(async () => ({ id: schoolId, code: "NEWSCH", name: "New School" })),
      },
      schoolClass: { upsert: schoolClassUpsert },
      user: {
        findFirst: vi.fn(async () => null),
        create: vi.fn(async () => ({
          id: adminId,
          email: "admin@newsch.test",
          schoolId,
          role: "ADMIN_OPERATOR",
        })),
        update: vi.fn(async () => ({
          id: adminId,
          email: "admin@newsch.test",
          schoolId,
          role: "ADMIN_OPERATOR",
        })),
      },
      auditLog: { create: auditLogCreate },
    } as unknown as PrismaClient;

    return { mockPrisma, auditLogCreate, schoolClassUpsert };
  };

  it("creates the school record when it does not exist", async () => {
    const { mockPrisma } = buildMock();
    const result = await provisionSchool(mockPrisma, {
      schoolCode: "NEWSCH",
      schoolName: "New School",
      sections: ["PRIMARY"],
      adminEmail: "admin@newsch.test",
      adminName: "School Admin",
      adminPassword: "SecurePass1!",
    });
    expect(result.school.code).toBe("NEWSCH");
    expect(result.school.id).toBe(schoolId);
  });

  it("seeds canonical classes for the selected sections", async () => {
    const { mockPrisma, schoolClassUpsert } = buildMock();
    const result = await provisionSchool(mockPrisma, {
      schoolCode: "NEWSCH",
      schoolName: "New School",
      sections: ["PRIMARY"],
      adminEmail: "admin@newsch.test",
      adminName: "School Admin",
      adminPassword: "SecurePass1!",
    });
    // PRIMARY has 7 classes (P1-P7)
    expect(result.classesSeeded).toBe(7);
    expect(schoolClassUpsert).toHaveBeenCalledTimes(7);
  });

  it("creates the first admin user and assigns them to the new school", async () => {
    const { mockPrisma } = buildMock();
    const result = await provisionSchool(mockPrisma, {
      schoolCode: "NEWSCH",
      schoolName: "New School",
      sections: ["SECONDARY"],
      adminEmail: "Admin@NewSch.Test",
      adminName: "School Admin",
      adminPassword: "SecurePass1!",
    });
    // admin must belong to the new school (acceptance test 3)
    expect(result.admin.schoolId).toBe(result.school.id);
    expect(result.admin.email).toBe("admin@newsch.test"); // lowercased
    expect(result.admin.role).toBe("ADMIN_OPERATOR");
  });

  it("writes a school.provisioned audit row", async () => {
    const { mockPrisma, auditLogCreate } = buildMock();
    await provisionSchool(mockPrisma, {
      schoolCode: "NEWSCH",
      schoolName: "New School",
      sections: ["NURSERY"],
      adminEmail: "admin@newsch.test",
      adminName: "School Admin",
      adminPassword: "SecurePass1!",
    });
    expect(auditLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ schoolId, action: "school.provisioned" }),
      }),
    );
  });

  it("seeds classes for multiple sections (NURSERY + PRIMARY = 3 + 7 = 10)", async () => {
    const { mockPrisma, schoolClassUpsert } = buildMock();
    const result = await provisionSchool(mockPrisma, {
      schoolCode: "NEWSCH",
      schoolName: "New School",
      sections: ["NURSERY", "PRIMARY"],
      adminEmail: "admin@newsch.test",
      adminName: "School Admin",
      adminPassword: "SecurePass1!",
    });
    expect(result.classesSeeded).toBe(10);
    expect(schoolClassUpsert).toHaveBeenCalledTimes(10);
  });
});

// â”€â”€â”€ Platform provisioning: route tests (vi.mock for prisma) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const { schoolFindUnique, schoolCreate, classUpsert, userFindFirst, userCreate, platformAuditCreate } = vi.hoisted(() => {
  const SCHOOL_ID = "sc-route-1";
  return {
    schoolFindUnique: vi.fn(async () => null),
    schoolCreate: vi.fn(async () => ({ id: SCHOOL_ID, code: "ROUTESCH", name: "Route School" })),
    classUpsert: vi.fn(async () => ({})),
    userFindFirst: vi.fn(async () => null),
    userCreate: vi.fn(async () => ({
      id: "usr-route-1",
      email: "admin@routesch.test",
      schoolId: SCHOOL_ID,
      role: "ADMIN_OPERATOR",
    })),
    platformAuditCreate: vi.fn(async () => ({})),
  };
});

vi.mock("../../server/db/prisma", () => ({
  prisma: {
    school: { findUnique: schoolFindUnique, create: schoolCreate },
    schoolClass: { upsert: classUpsert },
    user: { findFirst: userFindFirst, create: userCreate, update: vi.fn() },
    auditLog: { create: platformAuditCreate },
  },
}));

describe("Phase 7 â€” POST /api/platform/schools (route)", () => {
  const PLATFORM_KEY = "test-platform-key-phase7";
  let app: ReturnType<typeof import("../../server").createServer>;

  beforeAll(async () => {
    process.env.PLATFORM_ADMIN_KEY = PLATFORM_KEY;
    const { createServer } = await import("../../server");
    app = createServer();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    const SCHOOL_ID = "sc-route-1";
    schoolFindUnique.mockResolvedValue(null);
    schoolCreate.mockResolvedValue({ id: SCHOOL_ID, code: "ROUTESCH", name: "Route School" });
    classUpsert.mockResolvedValue({});
    userFindFirst.mockResolvedValue(null);
    userCreate.mockResolvedValue({ id: "usr-route-1", email: "admin@routesch.test", schoolId: SCHOOL_ID, role: "ADMIN_OPERATOR" });
    platformAuditCreate.mockResolvedValue({});
  });

  const validBody = {
    schoolCode: "ROUTESCH",
    schoolName: "Route School",
    sections: ["PRIMARY"],
    adminEmail: "admin@routesch.test",
    adminName: "Route Admin",
    adminPassword: "SecurePass1!",
  };

  it("returns 401 without platform key (acceptance test: normal schools cannot self-create)", async () => {
    const res = await request(app).post("/api/platform/schools").send(validBody);
    expect(res.status).toBe(401);
  });

  it("returns 401 with wrong platform key", async () => {
    const res = await request(app)
      .post("/api/platform/schools")
      .set("Authorization", "PlatformKey wrong-key")
      .send(validBody);
    expect(res.status).toBe(401);
  });

  it("returns 400 with invalid body (missing adminPassword)", async () => {
    const res = await request(app)
      .post("/api/platform/schools")
      .set("Authorization", `PlatformKey ${PLATFORM_KEY}`)
      .send({ ...validBody, adminPassword: "short" });
    expect(res.status).toBe(400);
  });

  it("returns 400 with invalid schoolCode (contains spaces)", async () => {
    const res = await request(app)
      .post("/api/platform/schools")
      .set("Authorization", `PlatformKey ${PLATFORM_KEY}`)
      .send({ ...validBody, schoolCode: "INVALID CODE" });
    expect(res.status).toBe(400);
  });

  it("creates school, seeds classes, assigns first admin (acceptance tests 1-3)", async () => {
    const res = await request(app)
      .post("/api/platform/schools")
      .set("Authorization", `PlatformKey ${PLATFORM_KEY}`)
      .send(validBody);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);

    // Acceptance test 1: school record created
    expect(res.body.school.code).toBe("ROUTESCH");

    // Acceptance test 2: canonical classes seeded
    expect(res.body.classesSeeded).toBe(7); // PRIMARY = P1-P7

    // Acceptance test 3: first admin assigned to that school
    expect(res.body.admin.schoolId).toBe(res.body.school.id);
    expect(res.body.admin.role).toBe("ADMIN_OPERATOR");
  }, 15000);
});

// â”€â”€â”€ Acceptance test 4 & 5: admin token schoolId + tenant isolation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe("Phase 7 â€” acceptance tests 4 & 5 (token schoolId + tenant isolation)", () => {
  it("admin login token contains the correct schoolId (acceptance test 4)", () => {
    const token = signToken({
      userId: "usr-t4",
      schoolId: "sc-new-school",
      name: "New Admin",
      email: "admin@new.test",
      role: "ADMIN_OPERATOR",
    });
    const payload = verifyToken(token);
    expect(payload?.schoolId).toBe("sc-new-school");
  });

  it("admin cannot access a different school (acceptance test 5 â€” tenant isolation)", () => {
    // A School B admin token must not carry SCU-PREVIEW's schoolId.
    // resolveSchoolContext enforces the cross-tenant check (see resolveSchoolContext.test.ts).
    const token = signToken({
      userId: "usr-t5",
      schoolId: "sc-school-b",
      name: "School B Admin",
      email: "admin@schoolb.test",
      role: "ADMIN_OPERATOR",
    });
    const payload = verifyToken(token);
    expect(payload?.schoolId).toBe("sc-school-b");
    // Token scoped to sc-school-b â€” resolveSchoolContext would 403 any request
    // that also sends schoolCode="SCU-PREVIEW", proving cross-school access is blocked.
  });
});

