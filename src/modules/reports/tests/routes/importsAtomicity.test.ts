import express from "express";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";

function scanContext() {
  return {
    marksheetId: "MS-1",
    className: "Senior 1",
    streamName: "A",
    subjectName: "Math",
    termName: "Term 1",
    examType: "BOT",
    academicYear: "2026",
  };
}

function reviewedRows() {
  return [
    {
      rowNumber: 1,
      admissionNumber: "A-1",
      studentName: "Alice",
      writtenMark: "",
      splitMark: "",
      extractedMark: "81",
      suggestedMark: "81",
      confidence: 0.95,
      remarks: "",
      status: "VALID",
      validationErrors: [],
      operatorCorrection: "",
    },
    {
      rowNumber: 2,
      admissionNumber: "A-2",
      studentName: "Bob",
      writtenMark: "",
      splitMark: "",
      extractedMark: "67",
      suggestedMark: "67",
      confidence: 0.95,
      remarks: "",
      status: "VALID",
      validationErrors: [],
      operatorCorrection: "",
    },
  ];
}

function mountApp(routerFactory: () => express.Router) {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.school = { id: "school-a", code: "SCHOOL-A" };
    req.user = { id: "user-a", schoolId: "school-a", role: "ADMIN_OPERATOR" };
    next();
  });
  app.use(routerFactory());
  return app;
}

afterEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.restoreAllMocks();
  vi.doUnmock("../../../../server/db/prisma");
  vi.doUnmock("../../server/repositories/settingsRepository");
  vi.doUnmock("../../../../server/services/scanImportValidator");
});

describe("scan commit atomicity", () => {
  it("rolls back batch-row changes and marks when a subjectMark upsert fails", async () => {
    const originalRows = [
      { batchId: "batch-1", rowNumber: 1, raw: { admissionNumber: "A-1", mark: "55" } },
    ];
    const persisted = {
      batch: {
        id: "batch-1",
        schoolId: "school-a",
        status: "DRY_RUN",
        source: "scan",
        summary: JSON.stringify({ lifecycleState: "DRY_RUN", committedRows: 0, rows: originalRows }),
      },
      rows: [...originalRows],
      marks: [{ studentId: "student-existing", marks: 55, importBatchId: "batch-legacy" }],
    };

    const auditLogCreate = vi.fn(async () => ({}));
    let txUpsertCalls = 0;
    const prisma = {
      academicYear: { findMany: vi.fn(async () => [{ id: "year-1", terms: [{ id: "term-1" }] }]) },
      schoolClass: { findMany: vi.fn(async () => [{ id: "class-1", name: "Senior 1", streams: [{ id: "stream-1", name: "A" }] }]) },
      subject: { findMany: vi.fn(async () => [{ id: "subject-1", name: "Math", code: "MATH" }]) },
      classEnrollment: {
        findMany: vi.fn(async () => [
          { student: { id: "student-1", admissionNumber: "A-1" }, class: { id: "class-1" }, stream: { id: "stream-1" } },
          { student: { id: "student-2", admissionNumber: "A-2" }, class: { id: "class-1" }, stream: { id: "stream-1" } },
        ]),
      },
      auditLog: { findFirst: vi.fn(async () => ({ id: "audit-1" })), create: auditLogCreate },
      markImportBatch: {
        findFirst: vi.fn(async () => persisted.batch),
        update: vi.fn(async ({ data }: any) => {
          persisted.batch = { ...persisted.batch, ...data };
          return persisted.batch;
        }),
      },
      reportLabSubscription: {
        findUnique: vi.fn(async () => ({ status: "ACTIVE", currentPeriodEnd: new Date("2030-01-01T00:00:00.000Z") })),
      },
      $transaction: vi.fn(async (callback: (tx: any) => Promise<unknown>) => {
        const temp = {
          batch: { ...persisted.batch },
          rows: persisted.rows.map((row) => ({ ...row })),
          marks: persisted.marks.map((mark) => ({ ...mark })),
        };

        const tx = {
          markImportBatch: {
            update: vi.fn(async ({ data }: any) => {
              temp.batch = { ...temp.batch, ...data };
              return temp.batch;
            }),
            create: vi.fn(),
          },
          markImportRow: {
            deleteMany: vi.fn(async () => {
              temp.rows = [];
              return { count: 1 };
            }),
            createMany: vi.fn(async ({ data }: any) => {
              temp.rows = data.map((row: any) => ({ ...row }));
              return { count: data.length };
            }),
          },
          subjectMark: {
            upsert: vi.fn(async ({ create }: any) => {
              txUpsertCalls++;
              if (txUpsertCalls === 2) throw new Error("Injected scan failure");
              temp.marks.push({ studentId: create.studentId, marks: Number(create.marks), importBatchId: create.importBatchId });
              return {};
            }),
          },
        };

        await callback(tx);
        persisted.batch = temp.batch;
        persisted.rows = temp.rows;
        persisted.marks = temp.marks;
      }),
    };

    vi.doMock("../../../../server/db/prisma", () => ({ prisma }));
    vi.doMock("../../server/repositories/settingsRepository", () => ({
      getSettingsSections: vi.fn(async () => ({
        ocr: { minimumConfidenceForSuggestion: 0.6 },
        approval: { keepAuditTrail: false, requireDryRunBeforeCommit: false },
      })),
    }));
    vi.doMock("../../../../server/services/scanImportValidator", () => ({
      validateScanRows: vi.fn((_rows: unknown) => reviewedRows()),
      parseScanMark: vi.fn((value: string) => value),
    }));

    const { importsRoutes } = await import("../../server/routes/importsRoutes");
    const res = await request(mountApp(importsRoutes))
      .post("/api/imports/scans/commit")
      .send({ batchId: "batch-1", context: scanContext(), rows: reviewedRows() });

    expect(res.status).toBe(500);
    expect(res.body.message).toMatch(/no scanned marks were written/i);
    expect(persisted.rows).toEqual(originalRows);
    expect(persisted.marks).toEqual([{ studentId: "student-existing", marks: 55, importBatchId: "batch-legacy" }]);
    expect(persisted.batch.status).toBe("FAILED");
    expect(auditLogCreate).toHaveBeenCalledTimes(1);
    expect(auditLogCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        schoolId: "school-a",
        action: "scan.import_failed",
        correlationId: "batch-1",
        details: expect.objectContaining({
          batchId: "batch-1",
        }),
      }),
    }));
  }, 15000);

  it("commits all scan rows and marks on success", async () => {
    const persisted = {
      batch: {
        id: "batch-1",
        schoolId: "school-a",
        status: "DRY_RUN",
        source: "scan",
        summary: JSON.stringify({ lifecycleState: "DRY_RUN", committedRows: 0 }),
      },
      rows: [] as Array<Record<string, unknown>>,
      marks: [] as Array<Record<string, unknown>>,
    };

    const auditLogCreate = vi.fn(async () => ({}));
    const prisma = {
      academicYear: { findMany: vi.fn(async () => [{ id: "year-1", terms: [{ id: "term-1" }] }]) },
      schoolClass: { findMany: vi.fn(async () => [{ id: "class-1", name: "Senior 1", streams: [{ id: "stream-1", name: "A" }] }]) },
      subject: { findMany: vi.fn(async () => [{ id: "subject-1", name: "Math", code: "MATH" }]) },
      classEnrollment: {
        findMany: vi.fn(async () => [
          { student: { id: "student-1", admissionNumber: "A-1" }, class: { id: "class-1" }, stream: { id: "stream-1" } },
          { student: { id: "student-2", admissionNumber: "A-2" }, class: { id: "class-1" }, stream: { id: "stream-1" } },
        ]),
      },
      reportLabSubscription: {
        findUnique: vi.fn(async () => ({ status: "ACTIVE", currentPeriodEnd: new Date("2030-01-01T00:00:00.000Z") })),
      },
      auditLog: { findFirst: vi.fn(async () => ({ id: "audit-1" })), create: auditLogCreate },
      markImportBatch: {
        findFirst: vi.fn(async () => persisted.batch),
        update: vi.fn(async ({ data }: any) => {
          persisted.batch = { ...persisted.batch, ...data };
          return persisted.batch;
        }),
      },
      $transaction: vi.fn(async (callback: (tx: any) => Promise<unknown>) => {
        const tx = {
          markImportBatch: {
            update: vi.fn(async ({ data }: any) => {
              persisted.batch = { ...persisted.batch, ...data };
              return persisted.batch;
            }),
            create: vi.fn(),
          },
          markImportRow: {
            deleteMany: vi.fn(async () => {
              persisted.rows = [];
              return { count: 0 };
            }),
            createMany: vi.fn(async ({ data }: any) => {
              persisted.rows = data.map((row: any) => ({ ...row }));
              return { count: data.length };
            }),
          },
          subjectMark: {
            upsert: vi.fn(async ({ create }: any) => {
              persisted.marks.push({ studentId: create.studentId, marks: Number(create.marks), importBatchId: create.importBatchId });
              return {};
            }),
          },
        };

        return callback(tx);
      }),
    };

    vi.doMock("../../../../server/db/prisma", () => ({ prisma }));
    vi.doMock("../../server/repositories/settingsRepository", () => ({
      getSettingsSections: vi.fn(async () => ({
        ocr: { minimumConfidenceForSuggestion: 0.6 },
        approval: { keepAuditTrail: false, requireDryRunBeforeCommit: false },
      })),
    }));
    vi.doMock("../../../../server/services/scanImportValidator", () => ({
      validateScanRows: vi.fn((_rows: unknown) => reviewedRows()),
      parseScanMark: vi.fn((value: string) => value),
    }));

    const { importsRoutes } = await import("../../server/routes/importsRoutes");
    const res = await request(mountApp(importsRoutes))
      .post("/api/imports/scans/commit")
      .send({ batchId: "batch-1", context: scanContext(), rows: reviewedRows() });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("COMMITTED");
    expect(res.body.committedRows).toBe(2);
    expect(persisted.rows).toHaveLength(2);
    expect(persisted.marks).toHaveLength(2);
    expect(persisted.batch.status).toBe("COMMITTED");
    expect(auditLogCreate).toHaveBeenCalledTimes(1);
    expect(auditLogCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        schoolId: "school-a",
        action: "scan.imported",
        correlationId: "batch-1",
        details: expect.objectContaining({
          batchId: "batch-1",
        }),
      }),
    }));
  });

  it("does not write a rolled-back batch id when a brand-new scan commit fails", async () => {
    const auditLogCreate = vi.fn(async () => ({}));
    let txUpsertCalls = 0;
    const prisma = {
      academicYear: { findMany: vi.fn(async () => [{ id: "year-1", terms: [{ id: "term-1" }] }]) },
      schoolClass: { findMany: vi.fn(async () => [{ id: "class-1", name: "Senior 1", streams: [{ id: "stream-1", name: "A" }] }]) },
      subject: { findMany: vi.fn(async () => [{ id: "subject-1", name: "Math", code: "MATH" }]) },
      classEnrollment: {
        findMany: vi.fn(async () => [
          { student: { id: "student-1", admissionNumber: "A-1" }, class: { id: "class-1" }, stream: { id: "stream-1" } },
          { student: { id: "student-2", admissionNumber: "A-2" }, class: { id: "class-1" }, stream: { id: "stream-1" } },
        ]),
      },
      reportLabSubscription: {
        findUnique: vi.fn(async () => ({ status: "ACTIVE", currentPeriodEnd: new Date("2030-01-01T00:00:00.000Z") })),
      },
      auditLog: { findFirst: vi.fn(async () => ({ id: "audit-1" })), create: auditLogCreate },
      markImportBatch: {
        findFirst: vi.fn(async () => null),
        update: vi.fn(async () => {
          throw new Error("Should not persist FAILED on a non-existent batch.");
        }),
      },
      $transaction: vi.fn(async (callback: (tx: any) => Promise<unknown>) => {
        const tx = {
          markImportBatch: {
            update: vi.fn(),
            create: vi.fn(async () => ({ id: "rolled-back-batch" })),
          },
          markImportRow: {
            deleteMany: vi.fn(async () => ({ count: 0 })),
            createMany: vi.fn(async ({ data }: any) => ({ count: data.length })),
          },
          subjectMark: {
            upsert: vi.fn(async () => {
              txUpsertCalls++;
              if (txUpsertCalls === 1) throw new Error("Injected scan failure");
              return {};
            }),
          },
        };

        await callback(tx);
      }),
    };

    vi.doMock("../../../../server/db/prisma", () => ({ prisma }));
    vi.doMock("../../server/repositories/settingsRepository", () => ({
      getSettingsSections: vi.fn(async () => ({
        ocr: { minimumConfidenceForSuggestion: 0.6 },
        approval: { keepAuditTrail: false, requireDryRunBeforeCommit: false },
      })),
    }));
    vi.doMock("../../../../server/services/scanImportValidator", () => ({
      validateScanRows: vi.fn((_rows: unknown) => reviewedRows()),
      parseScanMark: vi.fn((value: string) => value),
    }));

    const { importsRoutes } = await import("../../server/routes/importsRoutes");
    const res = await request(mountApp(importsRoutes))
      .post("/api/imports/scans/commit")
      .send({ context: scanContext(), rows: reviewedRows() });

    expect(res.status).toBe(500);
    expect(auditLogCreate).toHaveBeenCalledTimes(1);
    const createCall = auditLogCreate.mock.calls[0]?.[0] as { data: { details: Record<string, unknown> } & Record<string, unknown> };
    expect(createCall.data.action).toBe("scan.import_failed");
    expect(createCall.data).not.toHaveProperty("correlationId");
    expect(createCall.data.details).not.toHaveProperty("batchId");
    expect(createCall.data.details.message).toBe("Commit failed before a scan batch could be persisted. No scanned marks were written.");
  });
});
