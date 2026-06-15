import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mocks ───────────────────────────────────────────────────────────────────
const {
  markImportBatchCreate,
  markImportBatchFindUnique,
  txSubjectMarkUpsert,
  txMarkImportBatchUpdate,
  txAuditLogCreate,
  mockTransaction,
  subjectMarkCreate,
  subjectMarkUpsert,
  subjectMarkCount,
} = vi.hoisted(() => {
  const txSubjectMarkUpsert = vi.fn(async () => ({}));
  const txMarkImportBatchUpdate = vi.fn(async () => ({ id: "job-123", status: "COMMITTED" }));
  const txAuditLogCreate = vi.fn(async () => ({}));

  const mockTransaction = vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
    fn({
      subjectMark: { upsert: txSubjectMarkUpsert },
      markImportBatch: { update: txMarkImportBatchUpdate },
      auditLog: { create: txAuditLogCreate },
    }),
  );

  // Default batch: school-1, DRY_RUN, with a valid context including a stream UUID
  const defaultBatch = () => ({
    id: "job-123",
    schoolId: "school-1",
    status: "DRY_RUN",
    summary: JSON.stringify({
      context: {
        classId: "aaaaaaaa-0000-0000-0000-000000000001",
        streamId: "aaaaaaaa-0000-0000-0000-000000000004",
        subjectId: "aaaaaaaa-0000-0000-0000-000000000002",
        termId: "aaaaaaaa-0000-0000-0000-000000000003",
        examType: "BOT",
      },
    }),
  });

  return {
    markImportBatchCreate: vi.fn(async () => ({ id: "job-123" })),
    markImportBatchFindUnique: vi.fn(async () => defaultBatch()),
    txSubjectMarkUpsert,
    txMarkImportBatchUpdate,
    txAuditLogCreate,
    mockTransaction,
    subjectMarkCreate: vi.fn(),
    subjectMarkUpsert: vi.fn(),
    subjectMarkCount: vi.fn(async () => 2),
  };
});

vi.mock("../../server/db/prisma", () => ({
  prisma: {
    $transaction: mockTransaction,
    school: { findUnique: vi.fn(async () => ({ id: "school-1", code: "SCU-PREVIEW" })) },
    schoolClass: {
      findFirst: vi.fn(async () => ({ id: "class-1", schoolId: "school-1", streams: [] })),
      findMany: vi.fn(async () => [{ id: "class-1", name: "Senior 1", code: "S1" }]),
    },
    subject: {
      findFirst: vi.fn(async () => ({ id: "subject-1" })),
      findMany: vi.fn(async () => [{ id: "subject-1", name: "Mathematics", code: "MATH" }]),
    },
    term: {
      findFirst: vi.fn(async () => ({ id: "term-1", academicYearId: "year-1" })),
      findMany: vi.fn(async () => [
        { id: "term-1", name: "Term 1", isActive: true, academicYear: { name: "2025/2026" } },
      ]),
    },
    stream: {
      findFirst: vi.fn(async () => null),
      findMany: vi.fn(async () => []),
    },
    classEnrollment: { findMany: vi.fn(async () => []) },
    markImportBatch: {
      create: markImportBatchCreate,
      findUnique: markImportBatchFindUnique,
    },
    subjectMark: { create: subjectMarkCreate, upsert: subjectMarkUpsert, count: subjectMarkCount },
  },
}));

vi.mock("../../server/services/geminiOcrService", () => ({
  extractMarksWithGemini: vi.fn(async () => ({
    rows: [
      { studentId: "SC2026-00001", studentName: "Alice Nantongo", mark: "82", confidenceScore: 1, needsReview: false },
      { studentId: "SC2026-00094", studentName: "Faith Mukulu", mark: "", confidenceScore: 1, needsReview: false },
    ],
    summary: { totalRows: 2, validRows: 1, reviewRows: 1, missingMarkRows: 1, invalidMarkRows: 0 },
  })),
}));

vi.mock("../../server/services/geminiMarksImportService", async (importActual) => {
  const actual = await importActual<typeof import("../../server/services/geminiMarksImportService")>();
  return {
    ...actual,
    loadExpectedStudents: vi.fn(async () => [
      { studentId: "db-1", admissionNumber: "SC2026-00001", studentName: "Alice Nantongo" },
      { studentId: "db-2", admissionNumber: "SC2026-00094", studentName: "Faith Mukulu" },
    ]),
  };
});

import { createServer } from "../../server";

const IMAGE = Buffer.from("fake-marksheet-bytes");

// Valid UUIDs that pass UUID_RE validation.
const CLS = "aaaaaaaa-0000-0000-0000-000000000001";
const SUBJ = "aaaaaaaa-0000-0000-0000-000000000002";
const TERM = "aaaaaaaa-0000-0000-0000-000000000003";
const STREAM = "aaaaaaaa-0000-0000-0000-000000000004";
const STU1 = "aaaaaaaa-0000-0000-0000-000000000011";
const STU2 = "aaaaaaaa-0000-0000-0000-000000000012";
const JOB = "aaaaaaaa-0000-0000-0000-000000000099";

// Two fully-validated READY rows for commit tests.
const VALID_REVIEWED_ROWS = [
  {
    rowNumber: 1,
    extractedStudentId: "SC2026-00001",
    extractedStudentName: "Alice Nantongo",
    matchedStudentId: STU1,
    matchedStudentName: "Alice Nantongo",
    mark: "82",
    confidenceScore: 0.95,
    status: "READY",
    issues: [],
    raw: {},
  },
  {
    rowNumber: 2,
    extractedStudentId: "SC2026-00094",
    extractedStudentName: "Faith Mukulu",
    matchedStudentId: STU2,
    matchedStudentName: "Faith Mukulu",
    mark: "65",
    confidenceScore: 0.9,
    status: "READY",
    issues: [],
    raw: {},
  },
];

beforeEach(() => {
  subjectMarkCreate.mockClear();
  subjectMarkUpsert.mockClear();
  subjectMarkCount.mockClear();
  markImportBatchCreate.mockClear();
  markImportBatchFindUnique.mockClear();
  txSubjectMarkUpsert.mockClear();
  txMarkImportBatchUpdate.mockClear();
  txAuditLogCreate.mockClear();
  mockTransaction.mockClear();
});

describe("POST /api/marks-import/scan/extract", () => {
  it("returns 400 when no image is uploaded", async () => {
    const res = await request(createServer())
      .post("/api/marks-import/scan/extract")
      .field("classId", "class-1")
      .field("subjectId", "subject-1")
      .field("termId", "term-1")
      .field("examType", "BOT");
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("MISSING_IMAGE");
  });

  it("returns 400 when required context is missing", async () => {
    const res = await request(createServer())
      .post("/api/marks-import/scan/extract")
      .attach("image", IMAGE, { filename: "marks.jpg", contentType: "image/jpeg" })
      .field("subjectId", "subject-1") // classId, termId, examType missing
      .field("termId", "term-1");
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("MISSING_CONTEXT");
    expect(res.body.fields).toContain("classId");
    expect(res.body.fields).toContain("examType");
  });

  it("extracts, validates, and returns the review payload without saving marks", async () => {
    const res = await request(createServer())
      .post("/api/marks-import/scan/extract")
      .attach("image", IMAGE, { filename: "marks.jpg", contentType: "image/jpeg" })
      .field("classId", CLS)
      .field("subjectId", SUBJ)
      .field("termId", TERM)
      .field("examType", "BOT");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.jobId).toBe("job-123");
    expect(res.body.count).toBe(2);
    expect(res.body.summary.totalRows).toBe(2);

    const faith = res.body.rows.find((r: { extractedStudentId: string }) => r.extractedStudentId === "SC2026-00094");
    expect(faith.status).toBe("REVIEW_REQUIRED");
    expect(faith.issues).toContain("Missing mark");

    // No marks persisted during extraction.
    expect(subjectMarkCreate).not.toHaveBeenCalled();
    expect(subjectMarkUpsert).not.toHaveBeenCalled();
    expect(markImportBatchCreate).toHaveBeenCalledTimes(1);
  });
});

describe("UUID validation", () => {
  it("returns 400 INVALID_ID when classId is not a UUID", async () => {
    const res = await request(createServer())
      .post("/api/marks-import/scan/extract")
      .attach("image", IMAGE, { filename: "marks.jpg", contentType: "image/jpeg" })
      .field("classId", "1")
      .field("subjectId", "subject-1")
      .field("termId", "term-1")
      .field("examType", "BOT");
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("INVALID_ID");
  });

  it("returns 400 INVALID_ID when subjectId is not a UUID", async () => {
    const res = await request(createServer())
      .post("/api/marks-import/scan/extract")
      .attach("image", IMAGE, { filename: "marks.jpg", contentType: "image/jpeg" })
      .field("classId", CLS)
      .field("subjectId", "1")
      .field("termId", TERM)
      .field("examType", "BOT");
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("INVALID_ID");
  });

  it("returns 400 INVALID_ID when termId is not a UUID", async () => {
    const res = await request(createServer())
      .post("/api/marks-import/scan/extract")
      .attach("image", IMAGE, { filename: "marks.jpg", contentType: "image/jpeg" })
      .field("classId", CLS)
      .field("subjectId", SUBJ)
      .field("termId", "1")
      .field("examType", "BOT");
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("INVALID_ID");
  });
});

describe("debugNoDb mode", () => {
  it("returns rows from Gemini without any DB calls when ?debugNoDb=true", async () => {
    const res = await request(createServer())
      .post("/api/marks-import/scan/extract?debugNoDb=true")
      .attach("image", IMAGE, { filename: "marks.jpg", contentType: "image/jpeg" })
      .field("classId", CLS)
      .field("subjectId", SUBJ)
      .field("termId", TERM)
      .field("examType", "BOT");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.rows)).toBe(true);
    expect(res.body.rows.length).toBeGreaterThan(0);
    expect(markImportBatchCreate).not.toHaveBeenCalled();
  });
});

describe("no active students", () => {
  it("returns 400 NO_STUDENTS at stage load_expected_students when roster is empty", async () => {
    const { loadExpectedStudents } = await import("../../server/services/geminiMarksImportService");
    vi.mocked(loadExpectedStudents).mockResolvedValueOnce([]);

    const res = await request(createServer())
      .post("/api/marks-import/scan/extract")
      .attach("image", IMAGE, { filename: "marks.jpg", contentType: "image/jpeg" })
      .field("classId", CLS)
      .field("subjectId", SUBJ)
      .field("termId", TERM)
      .field("examType", "BOT");

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("NO_STUDENTS");
    expect(res.body.stage).toBe("load_expected_students");
  });
});

describe("MarkImportBatch failure", () => {
  it("returns 400 at stage create_import_batch when batch creation fails", async () => {
    markImportBatchCreate.mockRejectedValueOnce(new Error("Prisma: connection refused"));

    const res = await request(createServer())
      .post("/api/marks-import/scan/extract")
      .attach("image", IMAGE, { filename: "marks.jpg", contentType: "image/jpeg" })
      .field("classId", CLS)
      .field("subjectId", SUBJ)
      .field("termId", TERM)
      .field("examType", "BOT");

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("BATCH_CREATE_FAILED");
    expect(res.body.stage).toBe("create_import_batch");
  });
});

describe("GET /api/marks-import/scan/options", () => {
  it("returns classes, streams, subjects, terms, and examTypes for the resolved school", async () => {
    const res = await request(createServer())
      .get("/api/marks-import/scan/options")
      .query({ schoolCode: "SCU-PREVIEW" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.classes).toEqual([{ id: "class-1", name: "Senior 1", code: "S1" }]);
    expect(res.body.streams).toEqual([]);
    expect(res.body.subjects).toEqual([{ id: "subject-1", name: "Mathematics", code: "MATH" }]);
    expect(res.body.terms[0]).toMatchObject({ id: "term-1", isActive: true });
    expect(res.body.terms[0].name).toContain("Term 1");
    expect(res.body.examTypes).toEqual(["BOT", "MOT", "EOT"]);
  });

  it("filters out non-canonical classes (S1A, S1B) and returns only Senior 1 (S1)", async () => {
    const { prisma } = await import("../../server/db/prisma");
    vi.mocked(prisma.schoolClass.findMany).mockResolvedValueOnce([
      { id: "class-s1",  name: "Senior 1",   code: "S1"  } as never,
      { id: "class-s1a", name: "Senior 1 A", code: "S1A" } as never,
      { id: "class-s1b", name: "Senior 1 B", code: "S1B" } as never,
    ]);

    const res = await request(createServer())
      .get("/api/marks-import/scan/options")
      .query({ schoolCode: "SCU-PREVIEW" });

    expect(res.status).toBe(200);
    const codes = res.body.classes.map((c: { code: string }) => c.code);
    expect(codes).toContain("S1");
    expect(codes).not.toContain("S1A");
    expect(codes).not.toContain("S1B");
  });

  it("filters streams to only those under canonical classes", async () => {
    const { prisma } = await import("../../server/db/prisma");
    vi.mocked(prisma.schoolClass.findMany).mockResolvedValueOnce([
      { id: "class-s1",  name: "Senior 1",   code: "S1"  } as never,
      { id: "class-s1a", name: "Senior 1 A", code: "S1A" } as never,
    ]);
    vi.mocked(prisma.stream.findMany).mockResolvedValueOnce([
      { id: "stream-a", classId: "class-s1",  name: "A", code: "A" } as never,
      { id: "stream-b", classId: "class-s1",  name: "B", code: "B" } as never,
      { id: "stream-x", classId: "class-s1a", name: "A", code: "A" } as never,
    ]);

    const res = await request(createServer())
      .get("/api/marks-import/scan/options")
      .query({ schoolCode: "SCU-PREVIEW" });

    expect(res.status).toBe(200);
    const streamIds = res.body.streams.map((s: { id: string }) => s.id);
    expect(streamIds).toContain("stream-a");
    expect(streamIds).toContain("stream-b");
    expect(streamIds).not.toContain("stream-x");
  });
});

describe("Gemini error handling", () => {
  it("returns 503 GEMINI_NOT_CONFIGURED when GEMINI_API_KEY is missing", async () => {
    const { extractMarksWithGemini } = await import("../../server/services/geminiOcrService");
    vi.mocked(extractMarksWithGemini).mockRejectedValueOnce(new Error("Missing GEMINI_API_KEY"));

    const res = await request(createServer())
      .post("/api/marks-import/scan/extract")
      .attach("image", IMAGE, { filename: "marks.jpg", contentType: "image/jpeg" })
      .field("classId", CLS).field("subjectId", SUBJ)
      .field("termId", TERM).field("examType", "BOT");

    expect(res.status).toBe(503);
    expect(res.body.code).toBe("GEMINI_NOT_CONFIGURED");
  });

  it("returns 503 GEMINI_AUTH_ERROR for an invalid API key", async () => {
    const { extractMarksWithGemini } = await import("../../server/services/geminiOcrService");
    vi.mocked(extractMarksWithGemini).mockRejectedValueOnce(new Error("API key not valid. Please pass a valid API key."));

    const res = await request(createServer())
      .post("/api/marks-import/scan/extract")
      .attach("image", IMAGE, { filename: "marks.jpg", contentType: "image/jpeg" })
      .field("classId", CLS).field("subjectId", SUBJ)
      .field("termId", TERM).field("examType", "BOT");

    expect(res.status).toBe(503);
    expect(res.body.code).toBe("GEMINI_AUTH_ERROR");
  });

  it("returns 503 GEMINI_RATE_LIMIT on quota exhaustion", async () => {
    const { extractMarksWithGemini } = await import("../../server/services/geminiOcrService");
    vi.mocked(extractMarksWithGemini).mockRejectedValueOnce(new Error("RESOURCE_EXHAUSTED: quota exceeded"));

    const res = await request(createServer())
      .post("/api/marks-import/scan/extract")
      .attach("image", IMAGE, { filename: "marks.jpg", contentType: "image/jpeg" })
      .field("classId", CLS).field("subjectId", SUBJ)
      .field("termId", TERM).field("examType", "BOT");

    expect(res.status).toBe(503);
    expect(res.body.code).toBe("GEMINI_RATE_LIMIT");
  });

  it("returns 400 GEMINI_PARSE_ERROR when Gemini returns empty response", async () => {
    const { extractMarksWithGemini } = await import("../../server/services/geminiOcrService");
    vi.mocked(extractMarksWithGemini).mockRejectedValueOnce(new Error("Gemini returned empty response"));

    const res = await request(createServer())
      .post("/api/marks-import/scan/extract")
      .attach("image", IMAGE, { filename: "marks.jpg", contentType: "image/jpeg" })
      .field("classId", CLS).field("subjectId", SUBJ)
      .field("termId", TERM).field("examType", "BOT");

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("GEMINI_PARSE_ERROR");
  });
});

describe("file validation boundaries", () => {
  it("returns 400 JSON when image exceeds 10 MB size limit", async () => {
    const oversized = Buffer.alloc(10 * 1024 * 1024 + 1);
    const res = await request(createServer())
      .post("/api/marks-import/scan/extract")
      .attach("image", oversized, { filename: "big.jpg", contentType: "image/jpeg" })
      .field("classId", CLS)
      .field("subjectId", SUBJ)
      .field("termId", TERM)
      .field("examType", "BOT");
    expect(res.status).toBe(400);
    expect(res.type).toMatch(/json/);
    expect(res.body.code).toBe("FILE_TOO_LARGE");
  });

  it("returns 400 JSON for unsupported file types", async () => {
    const res = await request(createServer())
      .post("/api/marks-import/scan/extract")
      .attach("image", Buffer.from("not-an-image"), { filename: "data.txt", contentType: "text/plain" })
      .field("classId", CLS)
      .field("subjectId", SUBJ)
      .field("termId", TERM)
      .field("examType", "BOT");
    expect(res.status).toBe(400);
    expect(res.type).toMatch(/json/);
    expect(res.body.code).toBe("UNSUPPORTED_FILE_TYPE");
  });
});

// ── POST /api/marks-import/scan/commit ────────────────────────────────────

describe("POST /api/marks-import/scan/commit — input validation", () => {
  it("rejects missing jobId with 400 INVALID_JOB_ID", async () => {
    const res = await request(createServer())
      .post("/api/marks-import/scan/commit")
      .send({ reviewedRows: VALID_REVIEWED_ROWS });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("INVALID_JOB_ID");
  });

  it("rejects non-UUID jobId with 400 INVALID_JOB_ID", async () => {
    const res = await request(createServer())
      .post("/api/marks-import/scan/commit")
      .send({ jobId: "not-a-uuid", reviewedRows: VALID_REVIEWED_ROWS });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("INVALID_JOB_ID");
  });

  it("rejects missing reviewedRows with 400 MISSING_ROWS", async () => {
    const res = await request(createServer())
      .post("/api/marks-import/scan/commit")
      .send({ jobId: JOB });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("MISSING_ROWS");
  });
});

describe("POST /api/marks-import/scan/commit — batch checks", () => {
  it("rejects an unknown jobId with 404 BATCH_NOT_FOUND", async () => {
    markImportBatchFindUnique.mockResolvedValueOnce(null);
    const res = await request(createServer())
      .post("/api/marks-import/scan/commit")
      .send({ jobId: "aaaaaaaa-dead-beef-0000-000000000000", reviewedRows: VALID_REVIEWED_ROWS });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe("BATCH_NOT_FOUND");
  });

  it("rejects an already committed batch with 409 ALREADY_COMMITTED", async () => {
    markImportBatchFindUnique.mockResolvedValueOnce({
      id: "job-123",
      schoolId: "school-1",
      status: "COMMITTED",
      summary: "{}",
    });
    const res = await request(createServer())
      .post("/api/marks-import/scan/commit")
      .send({ jobId: JOB, reviewedRows: VALID_REVIEWED_ROWS });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("ALREADY_COMMITTED");
  });
});

describe("POST /api/marks-import/scan/commit — row-level validation", () => {
  it("rejects a row with a missing mark with 400 ROW_VALIDATION_FAILED", async () => {
    const rows = VALID_REVIEWED_ROWS.map((r, i) =>
      i === 0 ? { ...r, mark: "" } : r,
    );
    const res = await request(createServer())
      .post("/api/marks-import/scan/commit")
      .send({ jobId: JOB, reviewedRows: rows });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("ROW_VALIDATION_FAILED");
    expect(res.body.rowIssues[0].issues).toContain("Mark is required.");
  });

  it("rejects duplicate matchedStudentId across rows with 400 ROW_VALIDATION_FAILED", async () => {
    const rows = VALID_REVIEWED_ROWS.map((r) => ({ ...r, matchedStudentId: STU1 }));
    const res = await request(createServer())
      .post("/api/marks-import/scan/commit")
      .send({ jobId: JOB, reviewedRows: rows });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("ROW_VALIDATION_FAILED");
    const dupeRow = res.body.rowIssues.find((ri: { issues: string[] }) =>
      ri.issues.some((i) => /duplicate/i.test(i)),
    );
    expect(dupeRow).toBeDefined();
  });

  it("rejects a row with status REVIEW_REQUIRED with 400 ROW_VALIDATION_FAILED", async () => {
    const rows = VALID_REVIEWED_ROWS.map((r, i) =>
      i === 0 ? { ...r, status: "REVIEW_REQUIRED", issues: ["Missing mark"] } : r,
    );
    const res = await request(createServer())
      .post("/api/marks-import/scan/commit")
      .send({ jobId: JOB, reviewedRows: rows });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("ROW_VALIDATION_FAILED");
    expect(res.body.rowIssues[0].issues.some((i: string) => /REVIEW_REQUIRED/i.test(i))).toBe(true);
  });
});

describe("POST /api/marks-import/scan/commit — successful commit", () => {
  it("upserts one SubjectMark per reviewed row and responds 200 with finalizedRows", async () => {
    const res = await request(createServer())
      .post("/api/marks-import/scan/commit")
      .send({ jobId: JOB, reviewedRows: VALID_REVIEWED_ROWS });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.committedRows).toBe(2);
    expect(res.body.finalizedRows).toBe(2);
    expect(res.body.reportsReady).toBe(true);
    expect(res.body.batchId).toBe("job-123"); // batch mock returns id "job-123"
    expect(typeof res.body.message).toBe("string");
    expect(txSubjectMarkUpsert).toHaveBeenCalledTimes(2);
  });

  it("saves SubjectMark with status FINALIZED, not DRAFT", async () => {
    await request(createServer())
      .post("/api/marks-import/scan/commit")
      .send({ jobId: JOB, reviewedRows: VALID_REVIEWED_ROWS });

    const upsertArg = txSubjectMarkUpsert.mock.calls[0][0] as {
      create: { status: string };
      update: { status: string };
    };
    expect(upsertArg.create.status).toBe("FINALIZED");
    expect(upsertArg.update.status).toBe("FINALIZED");
  });

  it("saves SubjectMark with the same assessmentType as the import context", async () => {
    await request(createServer())
      .post("/api/marks-import/scan/commit")
      .send({ jobId: JOB, reviewedRows: VALID_REVIEWED_ROWS });

    const upsertArg = txSubjectMarkUpsert.mock.calls[0][0] as {
      where: { studentId_subjectId_termId_assessmentType: { assessmentType: string } };
      create: { assessmentType: string };
    };
    expect(upsertArg.where.studentId_subjectId_termId_assessmentType.assessmentType).toBe("BOT");
    expect(upsertArg.create.assessmentType).toBe("BOT");
  });

  it("saves SubjectMark with the same classId, streamId, and termId as the import context", async () => {
    await request(createServer())
      .post("/api/marks-import/scan/commit")
      .send({ jobId: JOB, reviewedRows: VALID_REVIEWED_ROWS });

    const upsertArg = txSubjectMarkUpsert.mock.calls[0][0] as {
      create: { classId: string; streamId: string; termId: string };
    };
    expect(upsertArg.create.classId).toBe(CLS);
    expect(upsertArg.create.streamId).toBe(STREAM);
    expect(upsertArg.create.termId).toBe(TERM);
  });

  it("returns navigation context (schoolCode, classId, streamId, termId, subjectId, assessmentType) for Go to Reports", async () => {
    const res = await request(createServer())
      .post("/api/marks-import/scan/commit")
      .send({ jobId: JOB, reviewedRows: VALID_REVIEWED_ROWS });

    expect(res.body.schoolCode).toBe("SCU-PREVIEW");
    expect(res.body.academicYearId).toBe("year-1");
    expect(res.body.classId).toBe(CLS);
    expect(res.body.streamId).toBe(STREAM);
    expect(res.body.termId).toBe(TERM);
    expect(res.body.subjectId).toBe(SUBJ);
    expect(res.body.assessmentType).toBe("BOT");
  });

  it("sets batch status to COMMITTED inside the transaction", async () => {
    await request(createServer())
      .post("/api/marks-import/scan/commit")
      .send({ jobId: JOB, reviewedRows: VALID_REVIEWED_ROWS });

    expect(txMarkImportBatchUpdate).toHaveBeenCalledTimes(1);
    const updateCall = txMarkImportBatchUpdate.mock.calls[0][0] as { data: { status: string } };
    expect(updateCall.data.status).toBe("COMMITTED");
  });

  it("creates an AuditLog entry with action GEMINI_SCAN_COMMITTED", async () => {
    await request(createServer())
      .post("/api/marks-import/scan/commit")
      .send({ jobId: JOB, reviewedRows: VALID_REVIEWED_ROWS });

    expect(txAuditLogCreate).toHaveBeenCalledTimes(1);
    const createCall = txAuditLogCreate.mock.calls[0][0] as { data: { action: string } };
    expect(createCall.data.action).toBe("GEMINI_SCAN_COMMITTED");
  });

  it("does not duplicate marks on repeated commit (second commit returns 409)", async () => {
    // First commit succeeds; batch now shows COMMITTED.
    markImportBatchFindUnique
      .mockResolvedValueOnce({
        id: "job-123",
        schoolId: "school-1",
        status: "DRY_RUN",
        summary: JSON.stringify({
          context: { classId: CLS, streamId: STREAM, subjectId: SUBJ, termId: TERM, examType: "BOT" },
        }),
      })
      .mockResolvedValueOnce({
        id: "job-123",
        schoolId: "school-1",
        status: "COMMITTED",
        summary: "{}",
      });

    const first = await request(createServer())
      .post("/api/marks-import/scan/commit")
      .send({ jobId: JOB, reviewedRows: VALID_REVIEWED_ROWS });
    expect(first.status).toBe(200);

    const second = await request(createServer())
      .post("/api/marks-import/scan/commit")
      .send({ jobId: JOB, reviewedRows: VALID_REVIEWED_ROWS });
    expect(second.status).toBe(409);
    expect(second.body.code).toBe("ALREADY_COMMITTED");

    expect(txSubjectMarkUpsert).toHaveBeenCalledTimes(2); // only first commit's 2 rows
  });
});
