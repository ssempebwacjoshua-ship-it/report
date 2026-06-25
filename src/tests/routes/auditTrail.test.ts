import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { commitMarksImport } from "../../server/services/marksImportService";
import type { PrismaClient } from "@prisma/client";

// ─── marks.imported: service unit test ───────────────────────────────────────

describe("Phase 6 audit trail ? marks.imported (CSV commit)", () => {
  it("writes a marks.imported audit row after a successful commit", async () => {
    const auditLogCreate = vi.fn(async () => ({}));
    const txBatchCreate = vi.fn(async () => ({ id: "batch-unit-1" }));
    const txBatchUpdate = vi.fn(async () => ({}));
    const txSubjectMarkUpsert = vi.fn(async () => ({}));

    const school = {
      id: "sch-unit-1",
      code: "UNIT",
      name: "Unit School",
      classes: [{ id: "cls-1", name: "P1", code: "P1", streams: [{ id: "str-1", name: "A", code: "A" }] }],
      students: [{ id: "std-1", admissionNumber: "001", firstName: "Ann", lastName: "Bee", isActive: true }],
      subjects: [{ id: "sub-1", name: "Mathematics", code: "MATH", isActive: true }],
      academicYears: [{
        id: "yr-1",
        name: "2025/2026",
        isActive: true,
        startsOn: new Date("2025-01-01T00:00:00.000Z"),
        endsOn: new Date("2026-12-31T00:00:00.000Z"),
        terms: [{
          id: "trm-1",
          name: "Term 1",
          isActive: true,
          startsOn: new Date("2026-02-01T00:00:00.000Z"),
          endsOn: new Date("2026-05-31T00:00:00.000Z"),
        }],
      }],
    };

    const mockPrisma = {
      appSetting: { findUnique: vi.fn(async () => null) },
      school: {
        findUnique: vi.fn(async () => school),
        findUniqueOrThrow: vi.fn(async () => school),
      },
      subjectMark: {
        findMany: vi.fn(async () => []),
      },
      markImportBatch: {
        create: vi.fn(async () => ({ id: "failed-batch" })),
      },
      // findFirst returns a truthy log to pass the requireDryRunBeforeCommit gate
      auditLog: { findFirst: vi.fn(async () => ({ id: "prior-dry-run-log" })) },
      $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => callback({
        markImportBatch: { create: txBatchCreate, update: txBatchUpdate },
        subjectMark: { upsert: txSubjectMarkUpsert },
        auditLog: { create: auditLogCreate },
      })),
    } as unknown as PrismaClient;

    const csv = ["admissionNumber,class,stream,subject,term,examType,marks", "001,P1,A,Mathematics,Term 1,BOT,85"].join(
      "\n",
    );

    const result = await commitMarksImport(mockPrisma, "UNIT", csv);

    expect(result.status).toBe("COMMITTED");
    expect(auditLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          schoolId: "sch-unit-1",
          action: "marks.imported",
          correlationId: "batch-unit-1",
        }),
      }),
    );
  });

  it("does NOT write a marks.imported audit row when commit fails validation", async () => {
    const auditLogCreate = vi.fn(async () => ({}));
    const failedBatchCreate = vi.fn(async () => ({ id: "batch-2" }));

    const school = {
      id: "sch-unit-2",
      code: "UNIT2",
      name: "Unit School 2",
      classes: [{ id: "cls-1", name: "P1", code: "P1", streams: [{ id: "str-1", name: "A", code: "A" }] }],
      students: [],
      subjects: [],
      academicYears: [{
        id: "yr-1",
        name: "2025/2026",
        isActive: true,
        startsOn: new Date("2025-01-01T00:00:00.000Z"),
        endsOn: new Date("2026-12-31T00:00:00.000Z"),
        terms: [{
          id: "trm-1",
          name: "Term 1",
          isActive: true,
          startsOn: new Date("2026-02-01T00:00:00.000Z"),
          endsOn: new Date("2026-05-31T00:00:00.000Z"),
        }],
      }],
    };

    const mockPrisma = {
      appSetting: { findUnique: vi.fn(async () => null) },
      school: {
        findUnique: vi.fn(async () => school),
        findUniqueOrThrow: vi.fn(async () => school),
      },
      subjectMark: { findMany: vi.fn(async () => []) },
      markImportBatch: { create: failedBatchCreate },
      auditLog: { create: auditLogCreate, findFirst: vi.fn(async () => null) },
    } as unknown as PrismaClient;

    const csv = ["admissionNumber,class,stream,subject,term,examType,marks", "999,P1,A,Mathematics,Term 1,BOT,85"].join(
      "\n",
    );

    const result = await commitMarksImport(mockPrisma, "UNIT2", csv);

    expect(result.status).toBe("FAILED");
    expect(auditLogCreate).not.toHaveBeenCalled();
    expect(failedBatchCreate).toHaveBeenCalled();
  });
});

// ─── report.revoke audit: route test ─────────────────────────────────────────

const { auditLogCreateMock, issuedReportFindFirst, issuedReportUpdateMany, schoolFindUniqueMock } = vi.hoisted(() => ({
  auditLogCreateMock: vi.fn(async () => ({})),
  issuedReportFindFirst: vi.fn(async () => ({ id: "rpt-1", schoolId: "sch-route-1", status: "ISSUED" })),
  issuedReportUpdateMany: vi.fn(async () => ({ count: 1 })),
  schoolFindUniqueMock: vi.fn(async () => ({ id: "sch-route-1", code: "SCU-PREVIEW", name: "Route School" })),
}));

vi.mock("../../server/db/prisma", () => ({
  prisma: {
    school: { findUnique: schoolFindUniqueMock },
    appSetting: { findUnique: vi.fn(async () => null) },
    issuedReport: {
      findFirst: issuedReportFindFirst,
      updateMany: issuedReportUpdateMany,
      findMany: vi.fn(async () => []),
    },
    auditLog: { create: auditLogCreateMock },
  },
}));

describe("Phase 6 audit trail ? report.revoke", () => {
  let app: ReturnType<typeof import("../../server").createServer>;
  let authToken: string;

  beforeAll(async () => {
    const { signToken } = await import("../../server/services/authService");
    const { createServer } = await import("../../server");
    app = createServer();
    authToken = signToken({
      userId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      schoolId: "sch-route-1",
      name: "Test Admin",
      email: "admin@test.com",
      role: "ADMIN_OPERATOR",
      tokenVersion: 0,
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
    schoolFindUniqueMock.mockResolvedValue({ id: "sch-route-1", code: "SCU-PREVIEW", name: "Route School" });
    issuedReportFindFirst.mockResolvedValue({ id: "rpt-1", schoolId: "sch-route-1", status: "ISSUED" });
    issuedReportUpdateMany.mockResolvedValue({ count: 1 });
    auditLogCreateMock.mockResolvedValue({});
  });

  it("creates a report.revoke audit row when a report is revoked", async () => {
    const res = await request(app)
      .patch("/api/reports/issued/rpt-1/revoke")
      .set("Authorization", `Bearer ${authToken}`)
      .send({ reason: "Issued in error" });

    expect(res.status).toBe(200);
    expect(auditLogCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          schoolId: "sch-route-1",
          action: "report.revoke",
          correlationId: "rpt-1",
        }),
      }),
    );
  }, 15000);

  it("returns 404 (no audit row) when the report does not exist", async () => {
    issuedReportFindFirst.mockResolvedValue(null);

    const res = await request(app)
      .patch("/api/reports/issued/not-found/revoke")
      .set("Authorization", `Bearer ${authToken}`)
      .send({});

    expect(res.status).toBe(404);
    expect(auditLogCreateMock).not.toHaveBeenCalled();
  }, 15000);

  it("returns 409 (no audit row) when the report is already revoked", async () => {
    issuedReportFindFirst.mockResolvedValue({ id: "rpt-1", schoolId: "sch-route-1", status: "REVOKED" });

    const res = await request(app)
      .patch("/api/reports/issued/rpt-1/revoke")
      .set("Authorization", `Bearer ${authToken}`)
      .send({});

    expect(res.status).toBe(409);
    expect(auditLogCreateMock).not.toHaveBeenCalled();
  }, 15000);
});

