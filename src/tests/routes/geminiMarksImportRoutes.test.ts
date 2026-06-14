import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mocks ───────────────────────────────────────────────────────────────────
const subjectMarkCreate = vi.fn();
const subjectMarkUpsert = vi.fn();
const markImportBatchCreate = vi.fn(async () => ({ id: "job-123" }));

vi.mock("../../server/db/prisma", () => ({
  prisma: {
    school: { findUnique: vi.fn(async () => ({ id: "school-1", code: "SCU-PREVIEW" })) },
    schoolClass: { findFirst: vi.fn(async () => ({ id: "class-1", schoolId: "school-1", streams: [] })) },
    subject: { findFirst: vi.fn(async () => ({ id: "subject-1" })) },
    term: { findFirst: vi.fn(async () => ({ id: "term-1" })) },
    stream: { findFirst: vi.fn(async () => null) },
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
      .field("classId", "class-1")
      .field("subjectId", "subject-1")
      .field("termId", "term-1")
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
