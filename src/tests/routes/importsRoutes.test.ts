import request from "supertest";
import { describe, expect, it } from "vitest";
import { createServer } from "../../server";

const SCHOOL = "SCU-PREVIEW";
const UNKNOWN = "UNKNOWN-SCHOOL-XYZ";

const validContext = {
  marksheetId: "MS-2026-S1A-A-MATH-BOT-T1",
  className: "Senior 1 A",
  streamName: "A",
  subjectName: "Mathematics",
  termName: "Term 1",
  examType: "BOT",
  academicYear: "2026",
};

// ── Scan upload endpoint ──────────────────────────────────────────────────────

describe("POST /api/imports/scans/upload", () => {
  it("returns 400 when fileName is missing", async () => {
    const res = await request(createServer()).post("/api/imports/scans/upload").send({
      schoolCode: SCHOOL,
      fileType: "PDF",
      context: validContext,
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 when context is missing", async () => {
    const res = await request(createServer()).post("/api/imports/scans/upload").send({
      schoolCode: SCHOOL,
      fileName: "marksheet.pdf",
      fileType: "PDF",
    });
    expect(res.status).toBe(400);
  });

  it("returns 400 for unsupported scan file type CSV", async () => {
    const res = await request(createServer()).post("/api/imports/scans/upload").send({
      schoolCode: UNKNOWN,
      fileName: "marks.csv",
      fileType: "CSV",
      context: validContext,
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/unsupported scan file type/i);
  });

  it("returns 400 for unsupported scan file type XLS", async () => {
    const res = await request(createServer()).post("/api/imports/scans/upload").send({
      schoolCode: UNKNOWN,
      fileName: "marks.xls",
      fileType: "XLS",
      context: validContext,
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/unsupported/i);
  });

  it("accepts PDF file type — returns 404 for unknown school (not 400)", async () => {
    const res = await request(createServer()).post("/api/imports/scans/upload").send({
      schoolCode: UNKNOWN,
      fileName: "marksheet.pdf",
      fileType: "PDF",
      context: validContext,
    });
    // Format was accepted (PDF is valid); school lookup fails → 404
    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
  });

  it("accepts PNG file type — returns 404 for unknown school (not 400)", async () => {
    const res = await request(createServer()).post("/api/imports/scans/upload").send({
      schoolCode: UNKNOWN,
      fileName: "marksheet.png",
      fileType: "PNG",
      context: validContext,
    });
    expect(res.status).toBe(404);
  });

  it("accepts JPG file type — returns 404 for unknown school (not 400)", async () => {
    const res = await request(createServer()).post("/api/imports/scans/upload").send({
      schoolCode: UNKNOWN,
      fileName: "marksheet.jpg",
      fileType: "JPG",
      context: validContext,
    });
    expect(res.status).toBe(404);
  });

  it("accepts JPEG file type — returns 404 for unknown school (not 400)", async () => {
    const res = await request(createServer()).post("/api/imports/scans/upload").send({
      schoolCode: UNKNOWN,
      fileName: "marksheet.jpeg",
      fileType: "JPEG",
      context: validContext,
    });
    expect(res.status).toBe(404);
  });

  it("accepts WEBP file type — returns 404 for unknown school (not 400)", async () => {
    const res = await request(createServer()).post("/api/imports/scans/upload").send({
      schoolCode: UNKNOWN,
      fileName: "marksheet.webp",
      fileType: "WEBP",
      context: validContext,
    });
    expect(res.status).toBe(404);
  });

  it("returns EXTRACTION_NOT_CONFIGURED with empty rows for SCU-PREVIEW school", async () => {
    const res = await request(createServer()).post("/api/imports/scans/upload").send({
      schoolCode: SCHOOL,
      fileName: "s1a-math-bot.pdf",
      fileType: "PDF",
      fileSize: 204800,
      context: validContext,
    });
    expect(res.status).toBe(200);
    expect(res.body.parseStatus).toBe("EXTRACTION_NOT_CONFIGURED");
    expect(res.body.message).toMatch(/extraction engine not configured/i);
    expect(res.body.rows).toEqual([]);
    expect(typeof res.body.batchId).toBe("string");
  });

  it("does not auto-commit scanned rows — rows array is always empty from engine", async () => {
    const res = await request(createServer()).post("/api/imports/scans/upload").send({
      schoolCode: SCHOOL,
      fileName: "test.png",
      fileType: "PNG",
      context: validContext,
    });
    expect(res.status).toBe(200);
    // Operator review required: rows must be empty until OCR provides them
    expect(res.body.rows).toEqual([]);
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
  });
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
