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
    expect(res.body.error).toMatch(/no scan file/i);
  });

  it("returns 400 when context field is missing", async () => {
    const res = await request(createServer())
      .post("/api/imports/scans/upload")
      .field("schoolCode", SCHOOL)
      .attach("file", FAKE_PNG, { filename: "marksheet.png", contentType: "image/png" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/context/i);
  });

  it("returns 400 for unsupported scan file type CSV", async () => {
    const res = await request(createServer())
      .post("/api/imports/scans/upload")
      .field("schoolCode", SCHOOL)
      .field("context", validContext)
      .attach("file", Buffer.from("a,b,c"), { filename: "marks.csv", contentType: "text/csv" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/unsupported scan file type/i);
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
    expect(res.body.error).toMatch(/unsupported/i);
  });

  it("accepts PDF — returns 404 for unknown school (format accepted, school missing)", async () => {
    const res = await request(createServer())
      .post("/api/imports/scans/upload")
      .field("schoolCode", UNKNOWN)
      .field("context", validContext)
      .attach("file", FAKE_PDF, { filename: "marksheet.pdf", contentType: "application/pdf" });
    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
  });

  it("accepts PNG — returns 404 for unknown school", async () => {
    const res = await request(createServer())
      .post("/api/imports/scans/upload")
      .field("schoolCode", UNKNOWN)
      .field("context", validContext)
      .attach("file", FAKE_PNG, { filename: "marksheet.png", contentType: "image/png" });
    expect(res.status).toBe(404);
  });

  it("accepts JPG — returns 404 for unknown school", async () => {
    const res = await request(createServer())
      .post("/api/imports/scans/upload")
      .field("schoolCode", UNKNOWN)
      .field("context", validContext)
      .attach("file", FAKE_PNG, { filename: "marksheet.jpg", contentType: "image/jpeg" });
    expect(res.status).toBe(404);
  });

  it("accepts JPEG — returns 404 for unknown school", async () => {
    const res = await request(createServer())
      .post("/api/imports/scans/upload")
      .field("schoolCode", UNKNOWN)
      .field("context", validContext)
      .attach("file", FAKE_PNG, { filename: "marksheet.jpeg", contentType: "image/jpeg" });
    expect(res.status).toBe(404);
  });

  it("accepts WEBP — returns 404 for unknown school", async () => {
    const res = await request(createServer())
      .post("/api/imports/scans/upload")
      .field("schoolCode", UNKNOWN)
      .field("context", validContext)
      .attach("file", FAKE_PNG, { filename: "marksheet.webp", contentType: "image/webp" });
    expect(res.status).toBe(404);
  });

  it("returns 200 with batchId for SCU-PREVIEW — extraction may fail on fake image", async () => {
    const res = await request(createServer())
      .post("/api/imports/scans/upload")
      .field("schoolCode", SCHOOL)
      .field("context", validContext)
      .attach("file", FAKE_PNG, { filename: "test.png", contentType: "image/png" });
    expect(res.status).toBe(200);
    expect(typeof res.body.batchId).toBe("string");
    expect(res.body.batchId.length).toBeGreaterThan(0);
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
});

// ── Context detection endpoints ───────────────────────────────────────────────

describe("POST /api/imports/scans/detect-context", () => {
  it("returns 404 for unknown school", async () => {
    const res = await request(createServer())
      .post("/api/imports/scans/detect-context")
      .field("schoolCode", UNKNOWN)
      .attach("file", FAKE_PNG, { filename: "test.png", contentType: "image/png" });
    expect(res.status).toBe(404);
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
  });

  it("returns 404 for unknown school", async () => {
    const res = await request(createServer()).get(
      `/api/imports/scans/context?marksheetId=MS-2026-S1-A-MATH-BOT-T1&schoolCode=${UNKNOWN}`,
    );
    expect(res.status).toBe(404);
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
});
