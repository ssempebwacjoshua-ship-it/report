import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { commitMarksImport } from "../../server/services/marksImportService";
import type { PrismaClient } from "@prisma/client";

function makeSchool() {
  return {
    id: "sch-h2",
    code: "H2SCHOOL",
    name: "High Two School",
    classes: [{ id: "cls-1", name: "P1", code: "P1", streams: [{ id: "str-1", name: "A", code: "A" }] }],
    students: [
      { id: "std-1", admissionNumber: "001", firstName: "Ann", lastName: "Bee", isActive: true },
      { id: "std-2", admissionNumber: "002", firstName: "Ben", lastName: "Kay", isActive: true },
    ],
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
}

function makeCsv(rows: string[]) {
  return [
    "admissionNumber,class,stream,subject,term,examType,marks",
    ...rows,
  ].join("\n");
}

function buildServiceMock(options: { failOnUpsertCall?: number } = {}) {
  const persisted = {
    marks: [] as Array<{ studentId: string; subjectId: string; termId: string; assessmentType: string; marks: number; importBatchId: string }>,
    batches: [] as Array<{ id: string; schoolId: string; status: string; source: string; summary: string | null }>,
    rows: [] as Array<{ batchId: string; rowNumber: number; isValid: boolean; errors: string[] }>,
    logs: [] as Array<{ action: string; correlationId?: string | null }>,
  };

  let batchSeq = 0;
  let upsertCalls = 0;

  const rootBatchCreate = vi.fn(async ({ data }: any) => {
    const batchId = `failed-batch-${++batchSeq}`;
    persisted.batches.push({
      id: batchId,
      schoolId: data.schoolId,
      status: data.status,
      source: data.source,
      summary: data.summary ?? null,
    });
    for (const row of data.rows?.create ?? []) {
      persisted.rows.push({
        batchId,
        rowNumber: row.rowNumber,
        isValid: row.isValid,
        errors: row.errors,
      });
    }
    return { id: batchId };
  });

  const tx = {
    markImportBatch: {
      create: vi.fn(async ({ data }: any) => {
        const batchId = `batch-${++batchSeq}`;
        txState.batches.push({
          id: batchId,
          schoolId: data.schoolId,
          status: data.status,
          source: data.source,
          summary: data.summary ?? null,
        });
        for (const row of data.rows?.create ?? []) {
          txState.rows.push({
            batchId,
            rowNumber: row.rowNumber,
            isValid: row.isValid,
            errors: row.errors,
          });
        }
        return { id: batchId };
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const batch = txState.batches.find((item) => item.id === where.id);
        if (!batch) throw new Error("Batch not found in transaction.");
        batch.status = data.status ?? batch.status;
        batch.source = data.source ?? batch.source;
        batch.summary = data.summary ?? batch.summary;
        return { ...batch };
      }),
    },
    subjectMark: {
      upsert: vi.fn(async ({ where, update, create }: any) => {
        upsertCalls++;
        if (options.failOnUpsertCall && upsertCalls === options.failOnUpsertCall) {
          throw new Error("Injected subjectMark failure");
        }

        const key = where.studentId_subjectId_termId_assessmentType;
        const existing = txState.marks.find((item) =>
          item.studentId === key.studentId
          && item.subjectId === key.subjectId
          && item.termId === key.termId
          && item.assessmentType === key.assessmentType,
        );

        if (existing) {
          existing.marks = Number(update.marks);
          existing.importBatchId = update.importBatchId;
          return existing;
        }

        const created = {
          studentId: create.studentId,
          subjectId: create.subjectId,
          termId: create.termId,
          assessmentType: create.assessmentType,
          marks: Number(create.marks),
          importBatchId: create.importBatchId,
        };
        txState.marks.push(created);
        return created;
      }),
    },
    auditLog: {
      create: vi.fn(async ({ data }: any) => {
        txState.logs.push({ action: data.action, correlationId: data.correlationId ?? null });
        return {};
      }),
    },
  };

  let txState = {
    marks: [...persisted.marks],
    batches: [...persisted.batches],
    rows: [...persisted.rows],
    logs: [...persisted.logs],
  };

  const mockPrisma = {
    appSetting: { findUnique: vi.fn(async () => null) },
    school: {
      findUnique: vi.fn(async () => makeSchool()),
      findUniqueOrThrow: vi.fn(async () => makeSchool()),
    },
    subjectMark: {
      findMany: vi.fn(async () => []),
    },
    markImportBatch: {
      create: rootBatchCreate,
    },
    auditLog: {
      findFirst: vi.fn(async () => ({ id: "prior-dry-run" })),
      create: vi.fn(async ({ data }: any) => {
        persisted.logs.push({ action: data.action, correlationId: data.correlationId ?? null });
        return {};
      }),
    },
    $transaction: vi.fn(async (callback: (client: typeof tx) => Promise<unknown>) => {
      txState = {
        marks: persisted.marks.map((item) => ({ ...item })),
        batches: persisted.batches.map((item) => ({ ...item })),
        rows: persisted.rows.map((item) => ({ ...item })),
        logs: persisted.logs.map((item) => ({ ...item })),
      };

      const result = await callback(tx);
      persisted.marks = txState.marks.map((item) => ({ ...item }));
      persisted.batches = txState.batches.map((item) => ({ ...item }));
      persisted.rows = txState.rows.map((item) => ({ ...item }));
      persisted.logs = txState.logs.map((item) => ({ ...item }));
      return result;
    }),
  } as unknown as PrismaClient;

  return { mockPrisma, persisted, tx, rootBatchCreate };
}

describe("Phase 3 import atomicity", () => {
  it("rolls back all CSV writes when one subjectMark upsert fails", async () => {
    const { mockPrisma, persisted } = buildServiceMock({ failOnUpsertCall: 2 });

    const result = await commitMarksImport(
      mockPrisma,
      "H2SCHOOL",
      makeCsv([
        "001,P1,A,Mathematics,Term 1,BOT,85",
        "002,P1,A,Mathematics,Term 1,BOT,91",
      ]),
    );

    expect(result.status).toBe("FAILED");
    expect(result.batchId).toBeTruthy();
    expect(persisted.marks).toHaveLength(0);
    expect(persisted.batches).toHaveLength(1);
    expect(persisted.batches[0]?.status).toBe("FAILED");
    expect(persisted.rows).toHaveLength(2);
    expect(persisted.rows.every((row) => row.errors.length > 0)).toBe(true);
    expect(persisted.logs).toHaveLength(1);
    expect(persisted.logs[0]?.action).toBe("marks.import_failed");
  });

  it("rejects invalid rows before commit and keeps row errors exportable", async () => {
    const { mockPrisma, persisted } = buildServiceMock();

    const result = await commitMarksImport(
      mockPrisma,
      "H2SCHOOL",
      makeCsv([
        "001,P1,A,Mathematics,Term 1,BOT,AB",
      ]),
    );

    expect(result.status).toBe("FAILED");
    expect(result.batchId).toBeTruthy();
    expect(persisted.marks).toHaveLength(0);
    expect(persisted.batches[0]?.status).toBe("FAILED");
    expect(result.rows[0]?.errors[0]).toMatch(/AB is not allowed here/i);
    expect(persisted.rows[0]?.errors[0]).toMatch(/AB is not allowed here/i);
    expect(persisted.logs[0]?.action).toBe("marks.import_failed");
  });

  it("commits all valid rows and marks in one successful transaction", async () => {
    const { mockPrisma, persisted } = buildServiceMock();

    const result = await commitMarksImport(
      mockPrisma,
      "H2SCHOOL",
      makeCsv([
        "001,P1,A,Mathematics,Term 1,BOT,85",
        "002,P1,A,Mathematics,Term 1,BOT,91",
      ]),
    );

    expect(result.status).toBe("COMMITTED");
    expect(result.validRows).toBe(2);
    expect(result.invalidRows).toBe(0);
    expect(persisted.marks).toHaveLength(2);
    expect(persisted.batches).toHaveLength(1);
    expect(persisted.batches[0]?.status).toBe("COMMITTED");
    expect(persisted.logs[0]?.action).toBe("marks.imported");
  });

  it("re-running the same import stays idempotent for mark records", async () => {
    const { mockPrisma, persisted } = buildServiceMock();
    const csv = makeCsv([
      "001,P1,A,Mathematics,Term 1,BOT,85",
      "002,P1,A,Mathematics,Term 1,BOT,91",
    ]);

    const first = await commitMarksImport(mockPrisma, "H2SCHOOL", csv);
    const second = await commitMarksImport(mockPrisma, "H2SCHOOL", csv);

    expect(first.status).toBe("COMMITTED");
    expect(second.status).toBe("COMMITTED");
    expect(persisted.marks).toHaveLength(2);
    expect(persisted.marks.map((mark) => mark.marks).sort((a, b) => a - b)).toEqual([85, 91]);
  });
});

const { batchFindFirst, rowFindMany, errorSchoolFindUnique } = vi.hoisted(() => ({
  batchFindFirst: vi.fn(async () => null as unknown),
  rowFindMany: vi.fn(async () => [] as unknown[]),
  errorSchoolFindUnique: vi.fn(async () => ({ id: "sch-err", code: "ERRSCH", name: "Error School" })),
}));

vi.mock("../../server/db/prisma", () => ({
  prisma: {
    school: { findUnique: errorSchoolFindUnique },
    appSetting: { findUnique: vi.fn(async () => null) },
    markImportBatch: { findFirst: batchFindFirst },
    markImportRow: { findMany: rowFindMany },
  },
}));

describe("GET /api/imports/marks/errors/:batchId", () => {
  let app: ReturnType<typeof import("../../server").createServer>;
  let authToken: string;

  beforeAll(async () => {
    const { signToken } = await import("../../server/services/authService");
    const { createServer } = await import("../../server");
    app = createServer();
    authToken = signToken({
      userId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      schoolId: "sch-err",
      name: "Test Admin",
      email: "admin@errsch.test",
      role: "ADMIN_OPERATOR",
      tokenVersion: 0,
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
    errorSchoolFindUnique.mockResolvedValue({ id: "sch-err", code: "ERRSCH", name: "Error School" });
    batchFindFirst.mockResolvedValue(null);
    rowFindMany.mockResolvedValue([]);
  });

  it("returns 404 when batch does not exist or belongs to another school", async () => {
    const res = await request(app)
      .get("/api/imports/marks/errors/batch-not-found")
      .set("Authorization", `Bearer ${authToken}`);
    expect(res.status).toBe(404);
  }, 15000);

  it("exports the same row errors stored on the batch", async () => {
    batchFindFirst.mockResolvedValue({ id: "batch-csv-1", schoolId: "sch-err", source: "csv" });
    rowFindMany.mockResolvedValue([
      {
        id: "row-1",
        batchId: "batch-csv-1",
        rowNumber: 2,
        raw: { admissionNumber: "001", class: "P1", stream: "A", subject: "Mathematics", term: "Term 1", examType: "BOT", marks: "AB" },
        isValid: false,
        errors: ["AB is not allowed here. Enter 0-100."],
      },
    ]);

    const res = await request(app)
      .get("/api/imports/marks/errors/batch-csv-1")
      .set("Authorization", `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/csv/);
    expect(res.text).toContain("AB is not allowed here. Enter 0-100.");
  }, 15000);
});
