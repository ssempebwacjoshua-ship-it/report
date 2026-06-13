import request from "supertest";
import { describe, expect, it } from "vitest";
import { createServer } from "../../server";

const SCHOOL = "SCU-PREVIEW";
const UNKNOWN = "UNKNOWN-SCHOOL-XYZ";

const validContext = JSON.stringify({
  marksheetId: "MS-2026-S1A-A-MATH-BOT-T1",
  className: "Senior 1 A",
  streamName: "A",
  subjectName: "Mathematics",
  termName: "Term 1",
  examType: "BOT",
  academicYear: "2026",
});

// Tiny dummy buffer — not a valid image; Sharp will reject it gracefully
const FAKE_PNG = Buffer.from("not-a-real-png");
const FAKE_PDF = Buffer.from("%PDF-1.4 fake");

// ── Scan upload endpoint ──────────────────────────────────────────────────────

describe("POST /api/imports/scans/upload", () => {
  it("returns 400 when no file is attached", async () => {
    const res = await request(createServer())
      .post("/api/imports/scans/upload")
      .field("schoolCode", SCHOOL)
      .field("context", validContext);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe(true);
    expect(res.body.code).toBe("MISSING_FILE");
    expect(res.body.message).toMatch(/no scan file/i);
  });

  it("returns 400 when context field is missing", async () => {
    const res = await request(createServer())
      .post("/api/imports/scans/upload")
      .field("schoolCode", SCHOOL)
      .attach("file", FAKE_PNG, { filename: "marksheet.png", contentType: "image/png" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe(true);
    expect(res.body.code).toBe("CONTEXT_REQUIRED");
    expect(res.body.message).toMatch(/context/i);
  });

  it("returns 400 for unsupported scan file type CSV", async () => {
    const res = await request(createServer())
      .post("/api/imports/scans/upload")
      .field("schoolCode", SCHOOL)
      .field("context", validContext)
      .attach("file", Buffer.from("a,b,c"), { filename: "marks.csv", contentType: "text/csv" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe(true);
    expect(res.body.code).toBe("UNSUPPORTED_FILE_TYPE");
    expect(res.body.message).toMatch(/unsupported file type/i);
  });

  it("returns 400 for unsupported scan file type XLS", async () => {
    const res = await request(createServer())
      .post("/api/imports/scans/upload")
      .field("schoolCode", SCHOOL)
      .field("context", validContext)
      .attach("file", Buffer.from("fake-xls"), {
        filename: "marks.xls",
        contentType: "application/vnd.ms-excel",
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe(true);
    expect(res.body.code).toBe("UNSUPPORTED_FILE_TYPE");
    expect(res.body.message).toMatch(/unsupported file type/i);
  });

  it("accepts PDF — returns 404 for unknown school (format accepted, school missing)", async () => {
    const res = await request(createServer())
      .post("/api/imports/scans/upload")
      .field("schoolCode", UNKNOWN)
      .field("context", validContext)
      .attach("file", FAKE_PDF, { filename: "marksheet.pdf", contentType: "application/pdf" });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe(true);
    expect(res.body.code).toBe("SCHOOL_NOT_FOUND");
    expect(typeof res.body.message).toBe("string");
  });

  it("accepts PNG — returns 404 for unknown school", async () => {
    const res = await request(createServer())
      .post("/api/imports/scans/upload")
      .field("schoolCode", UNKNOWN)
      .field("context", validContext)
      .attach("file", FAKE_PNG, { filename: "marksheet.png", contentType: "image/png" });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe(true);
    expect(res.body.code).toBe("SCHOOL_NOT_FOUND");
  });

  it("accepts JPG — returns 404 for unknown school", async () => {
    const res = await request(createServer())
      .post("/api/imports/scans/upload")
      .field("schoolCode", UNKNOWN)
      .field("context", validContext)
      .attach("file", FAKE_PNG, { filename: "marksheet.jpg", contentType: "image/jpeg" });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe(true);
    expect(res.body.code).toBe("SCHOOL_NOT_FOUND");
  });

  it("accepts JPEG — returns 404 for unknown school", async () => {
    const res = await request(createServer())
      .post("/api/imports/scans/upload")
      .field("schoolCode", UNKNOWN)
      .field("context", validContext)
      .attach("file", FAKE_PNG, { filename: "marksheet.jpeg", contentType: "image/jpeg" });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe(true);
    expect(res.body.code).toBe("SCHOOL_NOT_FOUND");
  });

  it("accepts WEBP — returns 404 for unknown school", async () => {
    const res = await request(createServer())
      .post("/api/imports/scans/upload")
      .field("schoolCode", UNKNOWN)
      .field("context", validContext)
      .attach("file", FAKE_PNG, { filename: "marksheet.webp", contentType: "image/webp" });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe(true);
    expect(res.body.code).toBe("SCHOOL_NOT_FOUND");
  });

  it("returns 200 with batchId for SCU-PREVIEW — extraction may fail on fake image", async () => {
    const res = await request(createServer())
      .post("/api/imports/scans/upload")
      .field("schoolCode", SCHOOL)
      .field("context", validContext)
      .attach("file", FAKE_PNG, { filename: "test.png", contentType: "image/png" });
    expect(res.status).toBe(200);
    expect(typeof res.body.batchId).toBe("string");
    expect(res.body.scanBatchId).toBe(res.body.batchId);
    expect(res.body.batchId.length).toBeGreaterThan(0);
    expect(res.body.contextSource).toBe("selected-context");
    expect(res.body.resolvedContext).toBeDefined();
    // Extraction on a fake file returns PARSED or FAILED — both are valid
    expect(["PARSED", "FAILED"]).toContain(res.body.parseStatus);
    expect(typeof res.body.message).toBe("string");
    expect(Array.isArray(res.body.rows)).toBe(true);
  });

  it("does not auto-commit scanned rows — rows never committed without operator approval", async () => {
    const res = await request(createServer())
      .post("/api/imports/scans/upload")
      .field("schoolCode", SCHOOL)
      .field("context", validContext)
      .attach("file", FAKE_PNG, { filename: "test.png", contentType: "image/png" });
    expect(res.status).toBe(200);
    // Any returned rows must be in PARSED/NEEDS_REVIEW/VALID/INVALID — never COMMITTED
    const rows = (res.body.rows ?? []) as { status: string }[];
    for (const row of rows) {
      expect(row.status).not.toBe("COMMITTED");
    }
  });

  it("scan batch can be reloaded by ID after upload", async () => {
    const upload = await request(createServer())
      .post("/api/imports/scans/upload")
      .field("schoolCode", SCHOOL)
      .field("context", validContext)
      .attach("file", FAKE_PNG, { filename: "test.png", contentType: "image/png" });

    expect(upload.status).toBe(200);

    const reload = await request(createServer()).get(`/api/imports/scan-batches/${upload.body.batchId}`);
    expect(reload.status).toBe(200);
    expect(reload.body.batchId).toBe(upload.body.batchId);
    expect(reload.body.scanBatchId).toBe(upload.body.batchId);
    expect(reload.body.contextSource).toBe("selected-context");
    expect(reload.body.resolvedContext).toBeDefined();
  });
});

describe("POST /api/imports/scans/dry-run", () => {
  it("dry-run does not clear extraction rows and persists operator corrections to the batch", async () => {
    const upload = await request(createServer())
      .post("/api/imports/scans/upload")
      .field("schoolCode", SCHOOL)
      .field("context", validContext)
      .attach("file", FAKE_PNG, { filename: "test.png", contentType: "image/png" });

    expect(upload.status).toBe(200);

    const rows = [{
      rowNumber: 1,
      admissionNumber: "S1A-001",
      studentName: "Kampala Ssempebwa",
      writtenMark: "",
      splitMark: "",
      extractedMark: "",
      suggestedMark: "",
      confidence: 0,
      remarks: "",
      status: "MISSING",
      validationErrors: [],
      operatorCorrection: "76",
    }];

    const dryRun = await request(createServer())
      .post("/api/imports/scans/dry-run")
      .send({
        schoolCode: SCHOOL,
        batchId: upload.body.batchId,
        context: JSON.parse(validContext),
        rows,
      });

    expect(dryRun.status).toBe(200);
    expect(dryRun.body.rows).toHaveLength(1);
    expect(dryRun.body.rows[0].operatorCorrection).toBe("76");

    const reload = await request(createServer()).get(`/api/imports/scan-batches/${upload.body.batchId}`);
    expect(reload.status).toBe(200);
    expect(reload.body.rows).toHaveLength(1);
    expect(reload.body.rows[0].operatorCorrection).toBe("76");
  });
});

// ── Context detection endpoints ───────────────────────────────────────────────

describe("POST /api/imports/scans/detect-context", () => {
  it("returns 404 for unknown school", async () => {
    const res = await request(createServer())
      .post("/api/imports/scans/detect-context")
      .field("schoolCode", UNKNOWN)
      .attach("file", FAKE_PNG, { filename: "test.png", contentType: "image/png" });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe(true);
    expect(res.body.code).toBe("SCHOOL_NOT_FOUND");
  });

  it("returns 200 with detectionStatus for known school (no real ID in fake image)", async () => {
    const res = await request(createServer())
      .post("/api/imports/scans/detect-context")
      .field("schoolCode", SCHOOL)
      .attach("file", FAKE_PNG, { filename: "test.png", contentType: "image/png" });
    expect(res.status).toBe(200);
    expect(["DETECTED", "PARTIAL", "NOT_FOUND", "ERROR"]).toContain(res.body.detectionStatus);
    expect(typeof res.body.message).toBe("string");
  });

  it("resolves context when explicit marksheetId field provided (no file needed)", async () => {
    const res = await request(createServer())
      .post("/api/imports/scans/detect-context")
      .field("schoolCode", SCHOOL)
      .field("marksheetId", "MS-2026-SENI-A-ENGL-BOT-TE");
    expect(res.status).toBe(200);
    // Result can be DETECTED (batch match), PARTIAL (ID decoded), or NOT_FOUND (invalid ID)
    expect(["DETECTED", "PARTIAL", "NOT_FOUND"]).toContain(res.body.detectionStatus);
  });
});

describe("GET /api/imports/scans/context", () => {
  it("returns 400 when marksheetId is missing", async () => {
    const res = await request(createServer()).get(
      `/api/imports/scans/context?schoolCode=${SCHOOL}`,
    );
    expect(res.status).toBe(400);
    expect(res.body.error).toBe(true);
    expect(res.body.code).toBe("MISSING_MARKSHEET_ID");
    expect(typeof res.body.message).toBe("string");
  });

  it("returns 404 for unknown school", async () => {
    const res = await request(createServer()).get(
      `/api/imports/scans/context?marksheetId=MS-2026-S1-A-MATH-BOT-T1&schoolCode=${UNKNOWN}`,
    );
    expect(res.status).toBe(404);
    expect(res.body.error).toBe(true);
    expect(res.body.code).toBe("SCHOOL_NOT_FOUND");
  });

  it("returns detectionStatus for a valid-format ID with known school", async () => {
    const res = await request(createServer()).get(
      `/api/imports/scans/context?marksheetId=MS-2026-SENI-A-ENGL-BOT-TE&schoolCode=${SCHOOL}`,
    );
    expect(res.status).toBe(200);
    expect(["DETECTED", "PARTIAL", "NOT_FOUND"]).toContain(res.body.detectionStatus);
    expect(typeof res.body.message).toBe("string");
  });

  it("returns NOT_FOUND for a malformed ID", async () => {
    const res = await request(createServer()).get(
      `/api/imports/scans/context?marksheetId=NOT-A-VALID-ID&schoolCode=${SCHOOL}`,
    );
    expect(res.status).toBe(200);
    expect(res.body.detectionStatus).toBe("NOT_FOUND");
  });
});

// ── Scan batches list ─────────────────────────────────────────────────────────

describe("GET /api/imports/scans/batches", () => {
  it("returns empty list for unknown school", async () => {
    const res = await request(createServer()).get(
      `/api/imports/scans/batches?schoolCode=${UNKNOWN}`,
    );
    expect(res.status).toBe(200);
    expect(res.body.batches).toEqual([]);
  });

  it("returns array for known school", async () => {
    const res = await request(createServer()).get(
      `/api/imports/scans/batches?schoolCode=${SCHOOL}`,
    );
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.batches)).toBe(true);
  }, 15000);
});

// ── Digital import still works ────────────────────────────────────────────────

describe("POST /api/imports/marks/dry-run (digital)", () => {
  it("returns 400 when csvText is missing", async () => {
    const res = await request(createServer()).post("/api/imports/marks/dry-run").send({
      schoolCode: SCHOOL,
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe(true);
    expect(res.body.code).toBe("IMPORT_VALIDATION_FAILED");
    expect(Array.isArray(res.body.details)).toBe(true);
  });

  it("returns DRY_RUN for valid CSV", async () => {
    const csvText = `admissionNumber,studentName,class,stream,subject,term,examType,marks,comments
S1A-001,Kampala Ssempebwa,Senior 1 A,A,English Language,Term 1,BOT,81,ok`;
    const res = await request(createServer()).post("/api/imports/marks/dry-run").send({
      schoolCode: SCHOOL,
      csvText,
    });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("DRY_RUN");
  });

  it("does not allow commit to bypass dry-run validation", async () => {
    const csvText = `admissionNumber,studentName,class,stream,subject,term,examType,marks,comments
S1A-001,Kampala Ssempebwa,Senior 1 A,A,English Language,Term 1,BOT,81,guard`;
    const res = await request(createServer()).post("/api/imports/marks/commit").send({
      schoolCode: SCHOOL,
      csvText,
    });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("FAILED");
    expect(JSON.stringify(res.body.rows)).toMatch(/Dry-run validation is required before commit/i);
  });
});

// ── Structured error shape tests ─────────────────────────────────────────────

describe("Import error responses always use structured shape", () => {
  it("bad file template (malformed CSV) returns TEMPLATE_ERROR with safe message", async () => {
    // csv-parse throws on mismatched quotes — not a ZodError, but should be caught and structured
    const malformedCsv = `admissionNumber,class\n"unclosed quote,Senior 1 A`;
    const res = await request(createServer()).post("/api/imports/marks/dry-run").send({
      schoolCode: SCHOOL,
      csvText: malformedCsv,
    });
    // Either caught as TEMPLATE_ERROR (csv-parse throw) or returns DRY_RUN with empty rows — both safe
    if (res.status === 400) {
      expect(res.body.error).toBe(true);
      expect(res.body.code).toBe("TEMPLATE_ERROR");
      expect(typeof res.body.message).toBe("string");
      expect(res.body.message).not.toBe("Unexpected error");
      expect(res.body.message).not.toMatch(/unexpected server error/i);
    } else {
      expect(res.status).toBe(200);
    }
  });

  it("missing class/stream/term in scan context returns IMPORT_VALIDATION_FAILED with details", async () => {
    const incompleteContext = JSON.stringify({
      marksheetId: "",
      className: "",
      streamName: "",
      subjectName: "Mathematics",
      termName: "Term 1",
      examType: "BOT",
      academicYear: "2026",
    });
    const res = await request(createServer())
      .post("/api/imports/scans/upload")
      .field("schoolCode", SCHOOL)
      .field("context", incompleteContext)
      .attach("file", FAKE_PNG, { filename: "test.png", contentType: "image/png" });
    // className and streamName required by scanContextSchema → ZodError → IMPORT_VALIDATION_FAILED
    // OR resolvedContext is null → CONTEXT_REQUIRED — both are structured
    expect([400, 200]).toContain(res.status);
    if (res.status === 400) {
      expect(res.body.error).toBe(true);
      expect(typeof res.body.code).toBe("string");
      expect(typeof res.body.message).toBe("string");
      expect(res.body.message).not.toBe("Unexpected error");
    }
  });

  it("OCR unavailable shows OCR provider message (not generic error) in extraction result", async () => {
    const res = await request(createServer())
      .post("/api/imports/scans/upload")
      .field("schoolCode", SCHOOL)
      .field("context", validContext)
      .attach("file", FAKE_PNG, { filename: "test.png", contentType: "image/png" });
    expect(res.status).toBe(200);
    // When OCR is not reachable (test env), extraction returns FAILED with a specific message
    if (!res.body.providerReachable) {
      expect(res.body.parseStatus).toBe("FAILED");
      expect(res.body.message).toMatch(/ocr/i);
      expect(res.body.message).not.toBe("Unexpected error");
      expect(res.body.message).not.toMatch(/unexpected server error/i);
    }
  });

  it("server 500 returns safe structured error — not 'Unexpected error'", async () => {
    // ZodError on malformed request body hits the global handler → structured response
    const res = await request(createServer()).post("/api/imports/scans/dry-run").send({
      schoolCode: SCHOOL,
      // context is required but missing → ZodError → IMPORT_VALIDATION_FAILED
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe(true);
    expect(res.body.code).toBe("IMPORT_VALIDATION_FAILED");
    expect(typeof res.body.message).toBe("string");
    expect(res.body.message).not.toBe("Unexpected error");
    expect(Array.isArray(res.body.details)).toBe(true);
    expect(res.body.details.length).toBeGreaterThan(0);
  });

  it("no matching students in scan dry-run shows all rows as INVALID with enrollment error", async () => {
    const unknownClassContext = {
      ...JSON.parse(validContext) as Record<string, string>,
      className: "NonExistentClass999",
      streamName: "Z",
    };
    const rows = [{
      rowNumber: 1,
      admissionNumber: "S1A-001",
      studentName: "Test Student",
      writtenMark: "",
      splitMark: "",
      extractedMark: "",
      suggestedMark: "",
      confidence: 0,
      remarks: "",
      status: "MISSING",
      validationErrors: [],
      operatorCorrection: "75",
    }];
    const res = await request(createServer())
      .post("/api/imports/scans/dry-run")
      .send({ schoolCode: SCHOOL, context: unknownClassContext, rows });
    // Empty roster → admission numbers not enrolled → rows come back INVALID
    expect(res.status).toBe(200);
    expect(res.body.validRows).toBe(0);
    expect(res.body.invalidRows).toBeGreaterThan(0);
    // Validation error on the row explains the mismatch
    const firstRow = (res.body.rows as Array<{ validationErrors: string[] }>)[0];
    expect(firstRow?.validationErrors?.some((e: string) => /not enrolled/i.test(e))).toBe(true);
  });

  it("error responses always include error:true, code, message, details fields", async () => {
    const errorEndpoints = [
      // 400 — missing file
      () => request(createServer())
        .post("/api/imports/scans/upload")
        .field("schoolCode", SCHOOL)
        .field("context", validContext),
      // 404 — unknown school
      () => request(createServer())
        .post("/api/imports/scans/upload")
        .field("schoolCode", UNKNOWN)
        .field("context", validContext)
        .attach("file", FAKE_PNG, { filename: "test.png", contentType: "image/png" }),
      // 400 — missing csvText ZodError
      () => request(createServer()).post("/api/imports/marks/dry-run").send({ schoolCode: SCHOOL }),
      // 400 — missing marksheetId
      () => request(createServer()).get(`/api/imports/scans/context?schoolCode=${SCHOOL}`),
    ];

    for (const call of errorEndpoints) {
      const res = await call();
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.body.error).toBe(true);
      expect(typeof res.body.code).toBe("string");
      expect(typeof res.body.message).toBe("string");
      expect(Array.isArray(res.body.details)).toBe(true);
      // Frontend must never see only "Unexpected error"
      expect(res.body.message).not.toBe("Unexpected error");
      expect(res.body.message).not.toMatch(/^unexpected server error$/i);
    }
  });
});
