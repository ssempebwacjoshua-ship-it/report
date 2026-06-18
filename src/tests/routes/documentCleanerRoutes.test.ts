import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createServer } from "../../server";

// ── Smart Pages service mock ──────────────────────────────────────────────────

const smartPagesMockState = vi.hoisted(() => ({
  remainingPages: 5000,
  allowHighAccuracy: false,
  isDuplicate: false,
  extractionShouldThrow: false,
}));

vi.mock("../../server/services/smartPagesService", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../server/services/smartPagesService")>();
  return {
    ...original,
    estimatePageCount: () => 1,
    getDefaultExtractionMode: () => "balanced" as const,
    canExtract: vi.fn(async (_schoolId: string, _pageCount: number) => {
      if (smartPagesMockState.remainingPages <= 0) {
        return { allowed: false, code: "SMART_PAGES_EXHAUSTED", message: "No Smart Pages remaining." };
      }
      return { allowed: true };
    }),
    isDuplicateJob: vi.fn(async () => smartPagesMockState.isDuplicate),
    deductPages: vi.fn(async () => undefined),
    isHighAccuracyAllowed: vi.fn(async () => smartPagesMockState.allowHighAccuracy),
    getSummary: vi.fn(async () => ({
      includedPages: 5000,
      topUpPages: 0,
      usedPages: 5000 - smartPagesMockState.remainingPages,
      remainingPages: smartPagesMockState.remainingPages,
      planName: "STANDARD" as const,
      billingCycle: "ACADEMIC_YEAR",
      allowHighAccuracy: smartPagesMockState.allowHighAccuracy,
    })),
  };
});

const FAKE_PNG = Buffer.from("not-a-real-png");
const FAKE_PDF = Buffer.from("%PDF-1.4 fake");

const validDocument = {
  documentType: "table",
  title: "LIST OF EXAMINERS",
  schoolName: "NALYA SS",
  academicYear: "2026",
  term: "TERM 1",
  columns: ["NO", "TEACHER'S NAME", "SUBJECT", "LEVEL"],
  rows: [
    { cells: ["1", "NAKOTTA LAWRENCE", "Physics", "A Level"], confidence: 0.92 },
    { cells: ["2", "NAKAZZI SARAH", "Mathematics", "O Level"], confidence: 0.85 },
  ],
  uncertainCells: [
    { rowIndex: 1, columnIndex: 1, reason: "low handwriting confidence" },
  ],
};

// ── Upload endpoint ────────────────────────────────────────────────────────────

describe("POST /api/documents/cleaner/upload", () => {
  it("returns 400 MISSING_FILE when no file is attached", async () => {
    const res = await request(createServer())
      .post("/api/documents/cleaner/upload");
    expect(res.status).toBe(400);
    expect(res.body.error).toBe(true);
    expect(res.body.code).toBe("MISSING_FILE");
    expect(typeof res.body.message).toBe("string");
  });

  it("returns 400 UNSUPPORTED_FILE_TYPE for a CSV file", async () => {
    const res = await request(createServer())
      .post("/api/documents/cleaner/upload")
      .attach("file", Buffer.from("a,b,c"), { filename: "sheet.csv", contentType: "text/csv" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe(true);
    expect(res.body.code).toBe("UNSUPPORTED_FILE_TYPE");
    expect(typeof res.body.message).toBe("string");
  });

  it("returns 400 UNSUPPORTED_FILE_TYPE for a DOCX file", async () => {
    const res = await request(createServer())
      .post("/api/documents/cleaner/upload")
      .attach("file", Buffer.from("PK fake docx"), { filename: "doc.docx", contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe(true);
    expect(res.body.code).toBe("UNSUPPORTED_FILE_TYPE");
  });

  it("returns 200 with draft structure for a valid PNG upload", async () => {
    const res = await request(createServer())
      .post("/api/documents/cleaner/upload")
      .attach("file", FAKE_PNG, { filename: "doc.png", contentType: "image/png" });
    expect(res.status).toBe(200);
    expect(typeof res.body.draftId).toBe("string");
    expect(res.body.draftId.length).toBeGreaterThan(0);
    expect(res.body.document).toBeDefined();
    expect(res.body.document.documentType).toBe("table");
    expect(Array.isArray(res.body.document.columns)).toBe(true);
    expect(Array.isArray(res.body.document.rows)).toBe(true);
    expect(Array.isArray(res.body.document.uncertainCells)).toBe(true);
    expect(typeof res.body.document.title).toBe("string");
    expect(typeof res.body.document.schoolName).toBe("string");
    expect(typeof res.body.document.academicYear).toBe("string");
    expect(typeof res.body.document.term).toBe("string");
  });

  it("returns 200 with imagePreviewUrl string for a valid PNG upload", async () => {
    const res = await request(createServer())
      .post("/api/documents/cleaner/upload")
      .attach("file", FAKE_PNG, { filename: "doc.png", contentType: "image/png" });
    expect(res.status).toBe(200);
    expect(typeof res.body.imagePreviewUrl).toBe("string");
  });

  it("accepts PDF format", async () => {
    const res = await request(createServer())
      .post("/api/documents/cleaner/upload")
      .attach("file", FAKE_PDF, { filename: "doc.pdf", contentType: "application/pdf" });
    expect(res.status).toBe(200);
    expect(res.body.draftId).toBeDefined();
  });

  it("accepts JPG format", async () => {
    const res = await request(createServer())
      .post("/api/documents/cleaner/upload")
      .attach("file", FAKE_PNG, { filename: "doc.jpg", contentType: "image/jpeg" });
    expect(res.status).toBe(200);
    expect(res.body.draftId).toBeDefined();
  });

  it("returns uncertain cells array (may be empty when OCR unavailable)", async () => {
    const res = await request(createServer())
      .post("/api/documents/cleaner/upload")
      .attach("file", FAKE_PNG, { filename: "doc.png", contentType: "image/png" });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.document.uncertainCells)).toBe(true);
    for (const cell of res.body.document.uncertainCells as unknown[]) {
      expect(typeof (cell as { rowIndex: number }).rowIndex).toBe("number");
      expect(typeof (cell as { columnIndex: number }).columnIndex).toBe("number");
      expect(typeof (cell as { reason: string }).reason).toBe("string");
    }
  });

  it("does not import/touch marks import routes (no cross-contamination)", async () => {
    // Marks import is unaffected ? its own health check still works
    const res = await request(createServer())
      .get("/api/imports/scans/context?marksheetId=MS-2026-S1-A-MATH-BOT-T1&schoolCode=SCU-PREVIEW");
    expect([200, 404]).toContain(res.status);
    expect(res.body.detectionStatus ?? res.body.code).toBeDefined();
  });
});

// ── Generate-PDF (printable HTML) endpoint ────────────────────────────────────

describe("POST /api/documents/cleaner/generate-pdf", () => {
  it("returns 400 when document body is missing", async () => {
    const res = await request(createServer())
      .post("/api/documents/cleaner/generate-pdf")
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe(true);
    expect(typeof res.body.message).toBe("string");
  });

  it("returns 400 when rows is not an array", async () => {
    const res = await request(createServer())
      .post("/api/documents/cleaner/generate-pdf")
      .send({ document: { ...validDocument, rows: "not-an-array" } });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe(true);
  });

  it("returns 200 text/html for a valid document", async () => {
    const res = await request(createServer())
      .post("/api/documents/cleaner/generate-pdf")
      .send({ document: validDocument });
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/html/);
    expect(typeof res.text).toBe("string");
    expect(res.text.length).toBeGreaterThan(100);
  });

  it("HTML output includes the document title", async () => {
    const res = await request(createServer())
      .post("/api/documents/cleaner/generate-pdf")
      .send({ document: validDocument });
    expect(res.status).toBe(200);
    expect(res.text).toContain("LIST OF EXAMINERS");
  });

  it("HTML output includes school name", async () => {
    const res = await request(createServer())
      .post("/api/documents/cleaner/generate-pdf")
      .send({ document: validDocument });
    expect(res.status).toBe(200);
    expect(res.text).toContain("NALYA SS");
  });

  it("HTML output includes row data", async () => {
    const res = await request(createServer())
      .post("/api/documents/cleaner/generate-pdf")
      .send({ document: validDocument });
    expect(res.status).toBe(200);
    expect(res.text).toContain("NAKOTTA LAWRENCE");
  });

  it("HTML output includes print media CSS", async () => {
    const res = await request(createServer())
      .post("/api/documents/cleaner/generate-pdf")
      .send({ document: validDocument });
    expect(res.status).toBe(200);
    expect(res.text).toContain("@media print");
  });

  it("HTML output does not contain AI branding or AI references", async () => {
    const res = await request(createServer())
      .post("/api/documents/cleaner/generate-pdf")
      .send({ document: validDocument });
    expect(res.status).toBe(200);
    // No "AI", "Artificial Intelligence", or "machine learning" references
    expect(res.text).not.toMatch(/\bArtificial Intelligence\b/i);
    expect(res.text).not.toMatch(/\bmachine learning\b/i);
    // "AI" as a standalone word/abbreviation should not appear
    expect(res.text).not.toMatch(/\bAI\b/);
  });

  it("respects custom primaryColor when provided", async () => {
    const res = await request(createServer())
      .post("/api/documents/cleaner/generate-pdf")
      .send({ document: validDocument, primaryColor: "#c0392b" });
    expect(res.status).toBe(200);
    expect(res.text).toContain("#c0392b");
  });

  it("uses default blue color when primaryColor not provided", async () => {
    const res = await request(createServer())
      .post("/api/documents/cleaner/generate-pdf")
      .send({ document: validDocument });
    expect(res.status).toBe(200);
    // Default primary color should appear in the output
    expect(res.text).toMatch(/#1e40af|#1d4ed8|blue/i);
  });
});

// ── Smart Pages ? GET summary endpoint ────────────────────────────────────────

describe("GET /api/documents/cleaner/smart-pages", () => {
  beforeEach(() => {
    smartPagesMockState.remainingPages = 5000;
    smartPagesMockState.allowHighAccuracy = false;
    smartPagesMockState.isDuplicate = false;
    smartPagesMockState.extractionShouldThrow = false;
  });

  it("returns 200 with summary when schoolCode is provided", async () => {
    const res = await request(createServer())
      .get("/api/documents/cleaner/smart-pages")
      .query({ schoolCode: "SCU-PREVIEW" });
    expect(res.status).toBe(200);
    expect(typeof res.body.remainingPages).toBe("number");
    expect(typeof res.body.includedPages).toBe("number");
    expect(typeof res.body.usedPages).toBe("number");
    expect(typeof res.body.billingCycle).toBe("string");
  });

  it("returns 400 when schoolCode is missing", async () => {
    const res = await request(createServer())
      .get("/api/documents/cleaner/smart-pages");
    expect(res.status).toBe(400);
    expect(res.body.error).toBe(true);
  });
});

// ── Smart Pages ? page allowance enforcement ──────────────────────────────────

describe("Smart Pages ? allowance enforcement on upload", () => {
  beforeEach(() => {
    smartPagesMockState.remainingPages = 5000;
    smartPagesMockState.allowHighAccuracy = false;
    smartPagesMockState.isDuplicate = false;
    smartPagesMockState.extractionShouldThrow = false;
  });

  it("returns 402 SMART_PAGES_EXHAUSTED when school has no remaining pages", async () => {
    smartPagesMockState.remainingPages = 0;
    const res = await request(createServer())
      .post("/api/documents/cleaner/upload")
      .field("schoolCode", "SCU-PREVIEW")
      .attach("file", FAKE_PNG, { filename: "doc.png", contentType: "image/png" });
    expect(res.status).toBe(402);
    expect(res.body.error).toBe(true);
    expect(res.body.code).toBe("SMART_PAGES_EXHAUSTED");
    expect(typeof res.body.message).toBe("string");
  });

  it("returns 200 when schoolCode omitted (no billing check applied)", async () => {
    smartPagesMockState.remainingPages = 0; // would block with schoolCode
    const res = await request(createServer())
      .post("/api/documents/cleaner/upload")
      .attach("file", FAKE_PNG, { filename: "doc.png", contentType: "image/png" });
    expect(res.status).toBe(200); // no billing check without schoolCode
  });
});

// ── Smart Pages ? extraction mode enforcement ─────────────────────────────────

describe("Smart Pages ? extraction mode enforcement", () => {
  beforeEach(() => {
    smartPagesMockState.remainingPages = 5000;
    smartPagesMockState.allowHighAccuracy = false;
    smartPagesMockState.isDuplicate = false;
  });

  it("returns 403 HIGH_ACCURACY_NOT_ALLOWED when plan does not allow high_accuracy", async () => {
    smartPagesMockState.allowHighAccuracy = false;
    const res = await request(createServer())
      .post("/api/documents/cleaner/upload")
      .field("schoolCode", "SCU-PREVIEW")
      .field("extractionMode", "high_accuracy")
      .attach("file", FAKE_PNG, { filename: "doc.png", contentType: "image/png" });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe(true);
    expect(res.body.code).toBe("HIGH_ACCURACY_NOT_ALLOWED");
  });

  it("accepts balanced mode (default) without any errors", async () => {
    const res = await request(createServer())
      .post("/api/documents/cleaner/upload")
      .field("schoolCode", "SCU-PREVIEW")
      .field("extractionMode", "balanced")
      .attach("file", FAKE_PNG, { filename: "doc.png", contentType: "image/png" });
    expect(res.status).toBe(200);
  });

  it("accepts economical mode", async () => {
    const res = await request(createServer())
      .post("/api/documents/cleaner/upload")
      .field("schoolCode", "SCU-PREVIEW")
      .field("extractionMode", "economical")
      .attach("file", FAKE_PNG, { filename: "doc.png", contentType: "image/png" });
    expect(res.status).toBe(200);
  });

  it("accepts high_accuracy mode when plan allows it", async () => {
    smartPagesMockState.allowHighAccuracy = true;
    const res = await request(createServer())
      .post("/api/documents/cleaner/upload")
      .field("schoolCode", "SCU-PREVIEW")
      .field("extractionMode", "high_accuracy")
      .attach("file", FAKE_PNG, { filename: "doc.png", contentType: "image/png" });
    expect(res.status).toBe(200);
  });
});

// ── Smart Pages ? generate-pdf does NOT deduct pages ─────────────────────────

describe("Smart Pages ? generate-pdf billing behaviour", () => {
  it("generate-pdf succeeds even when schoolCode has no remaining pages (no billing check)", async () => {
    smartPagesMockState.remainingPages = 0;
    const res = await request(createServer())
      .post("/api/documents/cleaner/generate-pdf")
      .send({ document: validDocument });
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/html/);
  });
});

// ── Smart Pages ? idempotency / deduplication ─────────────────────────────────

describe("Smart Pages ? deduplication", () => {
  beforeEach(() => {
    smartPagesMockState.remainingPages = 5000;
    smartPagesMockState.allowHighAccuracy = false;
    smartPagesMockState.isDuplicate = false;
  });

  it("returns 200 without charging when same file was already processed (duplicate job)", async () => {
    smartPagesMockState.isDuplicate = true;
    const res = await request(createServer())
      .post("/api/documents/cleaner/upload")
      .field("schoolCode", "SCU-PREVIEW")
      .attach("file", FAKE_PNG, { filename: "doc.png", contentType: "image/png" });
    expect(res.status).toBe(200);
    // fromCache flag indicates no new charge
    expect(res.body.fromCache).toBe(true);
  });
});

// ── Smart Pages ? response includes extraction metadata ───────────────────────

describe("Smart Pages ? extraction metadata in response", () => {
  beforeEach(() => {
    smartPagesMockState.remainingPages = 5000;
    smartPagesMockState.isDuplicate = false;
  });

  it("upload response includes pageEstimate and extractionMode when schoolCode provided", async () => {
    const res = await request(createServer())
      .post("/api/documents/cleaner/upload")
      .field("schoolCode", "SCU-PREVIEW")
      .attach("file", FAKE_PNG, { filename: "doc.png", contentType: "image/png" });
    expect(res.status).toBe(200);
    expect(typeof res.body.pageEstimate).toBe("number");
    expect(typeof res.body.extractionMode).toBe("string");
  });
});

// ── Error shape ────────────────────────────────────────────────────────────────

describe("Document cleaner error responses", () => {
  it("all error responses include error:true, code, message, details", async () => {
    const errorCalls = [
      () => request(createServer()).post("/api/documents/cleaner/upload"),
      () => request(createServer())
        .post("/api/documents/cleaner/upload")
        .attach("file", Buffer.from("bad"), { filename: "bad.xls", contentType: "application/vnd.ms-excel" }),
      () => request(createServer()).post("/api/documents/cleaner/generate-pdf").send({}),
    ];
    for (const call of errorCalls) {
      const res = await call();
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.body.error).toBe(true);
      expect(typeof res.body.code).toBe("string");
      expect(typeof res.body.message).toBe("string");
      expect(Array.isArray(res.body.details)).toBe(true);
      expect(res.body.message).not.toBe("Unexpected error");
      expect(res.body.message).not.toMatch(/^unexpected server error$/i);
    }
  });
});

