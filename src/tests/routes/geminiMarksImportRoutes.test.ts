import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mocks ───────────────────────────────────────────────────────────────────
// vi.hoisted ensures these are available when vi.mock factories run (vi.mock is hoisted).
const { markImportBatchCreate, subjectMarkCreate, subjectMarkUpsert } = vi.hoisted(() => ({
  markImportBatchCreate: vi.fn(async () => ({ id: "job-123" })),
  subjectMarkCreate: vi.fn(),
  subjectMarkUpsert: vi.fn(),
}));

vi.mock("../../server/db/prisma", () => ({
  prisma: {
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
      findFirst: vi.fn(async () => ({ id: "term-1" })),
      findMany: vi.fn(async () => [
        { id: "term-1", name: "Term 1", isActive: true, academicYear: { name: "2025/2026" } },
      ]),
    },
    stream: {
      findFirst: vi.fn(async () => null),
      findMany: vi.fn(async () => []),
    },
    classEnrollment: { findMany: vi.fn(async () => []) },
    markImportBatch: { create: markImportBatchCreate },
    subjectMark: { create: subjectMarkCreate, upsert: subjectMarkUpsert },
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

// Valid UUIDs that pass UUID_RE validation and satisfy the Prisma mocks (mocks ignore actual values).
const CLS = "aaaaaaaa-0000-0000-0000-000000000001";
const SUBJ = "aaaaaaaa-0000-0000-0000-000000000002";
const TERM = "aaaaaaaa-0000-0000-0000-000000000003";

beforeEach(() => {
  subjectMarkCreate.mockClear();
  subjectMarkUpsert.mockClear();
  markImportBatchCreate.mockClear();
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

    // Faith Mukulu empty mark must be REVIEW_REQUIRED with "Missing mark"
    const faith = res.body.rows.find((r: { extractedStudentId: string }) => r.extractedStudentId === "SC2026-00094");
    expect(faith.status).toBe("REVIEW_REQUIRED");
    expect(faith.issues).toContain("Missing mark");

    // No marks were persisted during extraction.
    expect(subjectMarkCreate).not.toHaveBeenCalled();
    expect(subjectMarkUpsert).not.toHaveBeenCalled();
    // A non-committing job record was created.
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
    // Batch and school lookups must be skipped in debugNoDb mode.
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
  it("returns 400 at stage create_import_batch and logs Prisma error when batch creation fails", async () => {
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

describe("POST /api/marks-import/scan/commit", () => {
  it("is disabled in this phase and never saves marks", async () => {
    const res = await request(createServer())
      .post("/api/marks-import/scan/commit")
      .send({ jobId: "job-123", rows: [] });
    expect(res.status).toBe(501);
    expect(res.body.code).toBe("COMMIT_NOT_ENABLED");
    expect(subjectMarkCreate).not.toHaveBeenCalled();
    expect(subjectMarkUpsert).not.toHaveBeenCalled();
  });
});
