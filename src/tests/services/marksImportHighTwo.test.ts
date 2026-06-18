import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { commitMarksImport } from "../../server/services/marksImportService";
import type { PrismaClient } from "@prisma/client";

// â”€â”€ Shared test fixtures â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function makeSchool() {
  return {
    id: "sch-h2",
    code: "H2SCHOOL",
    name: "High Two School",
    classes: [{ id: "cls-1", name: "P1", code: "P1", streams: [{ id: "str-1", name: "A", code: "A" }] }],
    students: [{ id: "std-1", admissionNumber: "001", firstName: "Ann", lastName: "Bee", isActive: true }],
    subjects: [{ id: "sub-1", name: "Mathematics", code: "MATH", isActive: true }],
    academicYears: [{ id: "yr-1", isActive: true, terms: [{ id: "trm-1", name: "Term 1", isActive: true }] }],
  };
}

/** Generate a CSV with N identical rows (same student/class/stream/subject/examType). */
function makeCSV(n: number) {
  const header = "admissionNumber,class,stream,subject,term,examType,marks";
  const rows = Array.from({ length: n }, () => "001,P1,A,Mathematics,Term 1,BOT,85");
  return [header, ...rows].join("\n");
}

function buildServiceMock(txImpl?: (ops: Array<Promise<unknown>>) => Promise<unknown>) {
  const defaultTx = async (ops: Array<Promise<unknown>>) => Promise.all(ops);
  const txFn = vi.fn().mockImplementation(txImpl ?? defaultTx);
  const auditLogCreate = vi.fn(async () => ({}));
  const batchUpdate = vi.fn(async () => ({}));

  const mockPrisma = {
    appSetting: { findUnique: vi.fn(async () => null) },
    school: {
      findUnique: vi.fn(async () => makeSchool()),
      findUniqueOrThrow: vi.fn(async () => makeSchool()),
    },
    subjectMark: {
      findMany: vi.fn(async () => []),
      upsert: vi.fn(async () => ({})),
    },
    markImportBatch: {
      create: vi.fn(async () => ({ id: "batch-h2" })),
      update: batchUpdate,
    },
    markImportRow: {
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    auditLog: {
      create: auditLogCreate,
      findFirst: vi.fn(async () => ({ id: "prior-dry-run" })),
    },
    $transaction: txFn,
  } as unknown as PrismaClient;

  return { mockPrisma, txFn, auditLogCreate, batchUpdate };
}

// â”€â”€ Service tests â€” chunked commit â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe("HIGH 2 â€” commitMarksImport: chunked $transaction", () => {
  it("uses $transaction for upserts (not individual awaits)", async () => {
    const { mockPrisma, txFn } = buildServiceMock();
    const result = await commitMarksImport(mockPrisma, "H2SCHOOL", makeCSV(1));
    expect(result.status).toBe("COMMITTED");
    // $transaction called at least once for the upsert chunk
    expect(txFn).toHaveBeenCalled();
  });

  it("calls $transaction twice for 51 rows (chunk 1=50, chunk 2=1)", async () => {
    let callCount = 0;
    const { mockPrisma, txFn } = buildServiceMock(async (ops) => {
      callCount++;
      return Promise.all(ops);
    });

    const result = await commitMarksImport(mockPrisma, "H2SCHOOL", makeCSV(51));
    expect(result.status).toBe("COMMITTED");
    // Two upsert chunks + possibly one more for error-row updates (no errors here)
    const upsertCalls = txFn.mock.calls.filter((args) => Array.isArray(args[0]) && (args[0] as unknown[]).length > 0);
    expect(upsertCalls.length).toBeGreaterThanOrEqual(2);
    expect(callCount).toBe(2);
  });

  it("records chunk failure without aborting the whole import", async () => {
    let callIndex = 0;
    const { mockPrisma, batchUpdate, auditLogCreate } = buildServiceMock(async (ops) => {
      callIndex++;
      if (callIndex === 2) throw new Error("DB chunk error");
      return Promise.all(ops as Promise<unknown>[]);
    });

    // 51 rows â†’ chunk 1 (50 rows) succeeds, chunk 2 (1 row) fails
    const result = await commitMarksImport(mockPrisma, "H2SCHOOL", makeCSV(51));

    // Partial commit: some rows succeeded, some failed
    expect(result.status).toBe("COMMITTED");
    expect(result.validRows).toBe(50);
    expect(result.invalidRows).toBe(1);

    // Batch updated to reflect actual outcome
    expect(batchUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "COMMITTED",
          summary: expect.stringContaining("1 rows failed"),
        }),
      }),
    );

    // Audit log records both counts
    expect(auditLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "marks.imported",
          details: expect.objectContaining({ successCount: 50, failedCount: 1 }),
        }),
      }),
    );
  });

  it("returns status FAILED and failedCount=totalRows when all chunks fail", async () => {
    let callIndex = 0;
    const { mockPrisma, batchUpdate } = buildServiceMock(async (ops) => {
      callIndex++;
      if (callIndex === 1) throw new Error("Total DB failure"); // upsert chunk fails
      return Promise.all(ops as Promise<unknown>[]); // error-row updateMany can proceed
    });

    const result = await commitMarksImport(mockPrisma, "H2SCHOOL", makeCSV(1));

    expect(result.status).toBe("FAILED");
    expect(result.invalidRows).toBe(1);
    expect(result.validRows).toBe(0);

    expect(batchUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "FAILED" }),
      }),
    );
  });

  it("audit log details include successCount and failedCount on full success", async () => {
    const { mockPrisma, auditLogCreate } = buildServiceMock();

    await commitMarksImport(mockPrisma, "H2SCHOOL", makeCSV(1));

    expect(auditLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "marks.imported",
          details: expect.objectContaining({ successCount: 1, failedCount: 0 }),
        }),
      }),
    );
  });
});

// â”€â”€ Route tests â€” GET /api/imports/marks/errors/:batchId â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

describe("HIGH 2 â€” GET /api/imports/marks/errors/:batchId", () => {
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
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
    errorSchoolFindUnique.mockResolvedValue({ id: "sch-err", code: "ERRSCH", name: "Error School" });
    batchFindFirst.mockResolvedValue(null);
    rowFindMany.mockResolvedValue([]);
  });

  it("returns 404 when batch does not exist or belongs to another school", async () => {
    batchFindFirst.mockResolvedValue(null);
    const res = await request(app)
      .get("/api/imports/marks/errors/batch-not-found")
      .set("Authorization", `Bearer ${authToken}`);
    expect(res.status).toBe(404);
  }, 15000);

  it("returns CSV with correct headers when batch has error rows", async () => {
    batchFindFirst.mockResolvedValue({ id: "batch-csv-1", schoolId: "sch-err", source: "csv" });
    rowFindMany.mockResolvedValue([
      {
        id: "row-1",
        batchId: "batch-csv-1",
        rowNumber: 2,
        raw: { admissionNumber: "001", class: "P1", stream: "A", subject: "Mathematics", term: "Term 1", examType: "BOT", marks: "150" },
        isValid: false,
        errors: ["-1 is outside the allowed range (0-100)."],
      },
    ]);

    const res = await request(app)
      .get("/api/imports/marks/errors/batch-csv-1")
      .set("Authorization", `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/csv/);
    expect(res.headers["content-disposition"]).toMatch(/attachment/);
    const lines = (res.text as string).split("\n");
    expect(lines[0]).toBe("rowNumber,admissionNumber,class,stream,subject,term,examType,marks,errors");
    expect(lines[1]).toContain("001");
    expect(lines[1]).toContain("Mathematics");
    expect(lines[1]).toContain("-1 is outside the allowed range");
  }, 15000);

  it("returns only a header row when the batch has no errors", async () => {
    batchFindFirst.mockResolvedValue({ id: "batch-clean", schoolId: "sch-err", source: "csv" });
    rowFindMany.mockResolvedValue([
      {
        id: "row-ok",
        batchId: "batch-clean",
        rowNumber: 2,
        raw: { admissionNumber: "001", class: "P1", stream: "A", subject: "Math", term: "Term 1", examType: "BOT", marks: "85" },
        isValid: true,
        errors: [],
      },
    ]);

    const res = await request(app)
      .get("/api/imports/marks/errors/batch-clean")
      .set("Authorization", `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    const lines = (res.text as string).trim().split("\n");
    // Only the header line â€” no error rows
    expect(lines).toHaveLength(1);
    expect(lines[0]).toBe("rowNumber,admissionNumber,class,stream,subject,term,examType,marks,errors");
  }, 15000);
});

