import { describe, expect, it } from "vitest";
import {
  computeMarksheetId,
  computeSheetNumber,
  findMarksheetIdBySheetNumber,
  findMarksheetIdInText,
  findSheetNumberInText,
  normalizeMarksheetId,
  parseMarksheetIdComponents,
  resolveScanMarksheetContext,
} from "../../server/services/marksheetContextService";

// ── parseMarksheetIdComponents ────────────────────────────────────────────────

describe("parseMarksheetIdComponents", () => {
  it("parses a well-formed marksheet ID", () => {
    const c = parseMarksheetIdComponents("MS-2026-SEN1-A-ENGL-EOT-TE");
    expect(c.valid).toBe(true);
    expect(c.year).toBe("2026");
    expect(c.classCode).toBe("SEN1");
    expect(c.stream).toBe("A");
    expect(c.subjectCode).toBe("ENGL");
    expect(c.examType).toBe("EOT");
    expect(c.termCode).toBe("TE");
  });

  it("is case-insensitive", () => {
    const c = parseMarksheetIdComponents("ms-2026-sen1-a-engl-eot-te");
    expect(c.valid).toBe(true);
    expect(c.classCode).toBe("SEN1");
  });

  it("handles streams with digits like A1 or B2", () => {
    const c = parseMarksheetIdComponents("MS-2026-SEN2-A1-MATH-BOT-T1");
    expect(c.valid).toBe(true);
    expect(c.stream).toBe("A1");
    expect(c.examType).toBe("BOT");
  });

  it("accepts all three exam types", () => {
    expect(parseMarksheetIdComponents("MS-2026-S1-A-MATH-BOT-T1").examType).toBe("BOT");
    expect(parseMarksheetIdComponents("MS-2026-S1-A-MATH-MOT-T2").examType).toBe("MOT");
    expect(parseMarksheetIdComponents("MS-2026-S1-A-MATH-EOT-T3").examType).toBe("EOT");
  });

  it("returns invalid for an empty string", () => {
    expect(parseMarksheetIdComponents("").valid).toBe(false);
  });

  it("returns invalid for a missing MS- prefix", () => {
    expect(parseMarksheetIdComponents("2026-SEN1-A-ENGL-EOT-TE").valid).toBe(false);
  });

  it("returns invalid for wrong number of segments", () => {
    expect(parseMarksheetIdComponents("MS-2026-SEN1-A-ENGL-EOT").valid).toBe(false);
  });

  it("returns invalid for a non-string input", () => {
    // @ts-expect-error testing runtime guard
    expect(parseMarksheetIdComponents(null).valid).toBe(false);
  });
});

describe("normalizeMarksheetId", () => {
  it("normalizes SENI to SEN1 for OCR/template ambiguity", () => {
    expect(normalizeMarksheetId("MS-2026-SENI-A-MATH-EOT-TE")).toBe("MS-2026-SEN1-A-MATH-EOT-TE");
    expect(normalizeMarksheetId("MS-2026-SENL-A-MATH-EOT-TE")).toBe("MS-2026-SEN1-A-MATH-EOT-TE");
    expect(normalizeMarksheetId("MS-2026-SEN|-A-MATH-EOT-TE")).toBe("MS-2026-SEN1-A-MATH-EOT-TE");
  });

  it("removes spaces and normalizes dash glyphs", () => {
    expect(normalizeMarksheetId(" ms - 2026 - seni - a - math - eot - te ")).toBe("MS-2026-SEN1-A-MATH-EOT-TE");
    expect(normalizeMarksheetId("MS 2026 SENI A MATH EOT TE")).toBe("MS-2026-SEN1-A-MATH-EOT-TE");
    expect(normalizeMarksheetId("MS–2026–SENI–A–MATH–EOT–TE")).toBe("MS-2026-SEN1-A-MATH-EOT-TE");
  });
});

describe("resolveScanMarksheetContext", () => {
  const selectedContext = {
    marksheetId: "MS-2026-SENI-A-MATH-EOT-TE",
    className: "Senior 1 A",
    streamName: "A",
    subjectName: "Mathematics",
    termName: "Term 1",
    examType: "EOT",
    academicYear: "2025/2026",
  };

  function prismaMock() {
    return {
      markImportBatch: { findMany: async () => [] },
      schoolClass: {
        findMany: async () => [
          { name: "Senior 1 A", streams: [{ name: "A", code: "A" }] },
        ],
      },
      subject: {
        findMany: async () => [{ name: "Mathematics", code: "MATH" }],
      },
      term: {
        findMany: async () => [
          { name: "Term 1", startsOn: new Date("2026-01-10"), academicYear: { name: "2025/2026" } },
        ],
      },
    };
  }

  function prismaMockWithParallelSeniorOneStreams() {
    return {
      markImportBatch: { findMany: async () => [] },
      schoolClass: {
        findMany: async () => [
          { name: "Senior 1 A", streams: [{ name: "A", code: "A" }] },
          { name: "Senior 1 B", streams: [{ name: "B", code: "B" }] },
        ],
      },
      subject: {
        findMany: async () => [{ name: "Mathematics", code: "MATH" }],
      },
      term: {
        findMany: async () => [
          { name: "Term 1", startsOn: new Date("2026-01-10"), academicYear: { name: "2025/2026" } },
        ],
      },
    };
  }

  it("recognized Marksheet ID resolves context", async () => {
    const result = await resolveScanMarksheetContext(prismaMock() as any, "school-1", {
      recognizedMarksheetId: "MS-2026-SENI-A-MATH-EOT-TE",
    });

    expect(result.contextSource).toBe("recognized-id");
    expect(result.normalizedMarksheetId).toBe("MS-2026-SEN1-A-MATH-EOT-TE");
    expect(result.resolvedContext?.className).toBe("Senior 1 A");
    expect(result.resolvedContext?.subjectName).toBe("Mathematics");
  });

  it("prefers the class that owns the requested stream when class codes collide", async () => {
    const result = await resolveScanMarksheetContext(prismaMockWithParallelSeniorOneStreams() as any, "school-1", {
      recognizedMarksheetId: "MS-2026-SENI-B-MATH-EOT-TE",
    });

    expect(result.contextSource).toBe("recognized-id");
    expect(result.resolvedContext?.className).toBe("Senior 1 B");
    expect(result.resolvedContext?.streamName).toBe("B");
  });

  it("selected context fallback works when OCR ID fails", async () => {
    const result = await resolveScanMarksheetContext(prismaMock() as any, "school-1", {
      recognizedMarksheetId: "NOT-A-VALID-ID",
      selectedContext,
    });

    expect(result.contextSource).toBe("selected-context");
    expect(result.resolvedContext).toMatchObject({
      ...selectedContext,
      marksheetId: "MS-2026-SEN1-A-MATH-EOT-TE",
    });
    expect(result.contextWarning).toMatch(/using selected marksheet/i);
  });

  it("no context returns manual-required, not silent extraction", async () => {
    const result = await resolveScanMarksheetContext(prismaMock() as any, "school-1", {});

    expect(result.contextSource).toBe("manual-required");
    expect(result.resolvedContext).toBeNull();
    expect(result.contextWarning).toMatch(/required/i);
  });
});

// ── computeMarksheetId ────────────────────────────────────────────────────────

describe("computeMarksheetId", () => {
  it("produces MS-YEAR-CLASS4-STREAM-SUBJ4-EXAMTYPE-TERM2 format", () => {
    const id = computeMarksheetId("Senior 1 A", "A", "English Language", "EOT", "Term 1", 2026);
    // "Senior1A" ? "SENI" (first 4 chars after removing spaces)
    // "EnglishLanguage" ? "ENGL"
    // "Term1" ? "TE"
    expect(id).toBe("MS-2026-SENI-A-ENGL-EOT-TE");
  });

  it("handles short class names", () => {
    const id = computeMarksheetId("S1", "A", "Mathematics", "BOT", "T1", 2026);
    // "S1" ? "S1" (only 2 chars)
    // "Mathematics" ? "MATH"
    // "T1" ? "T1"
    expect(id).toBe("MS-2026-S1-A-MATH-BOT-T1");
  });

  it("strips spaces from class name before slicing", () => {
    const a = computeMarksheetId("Sen 1 A", "A", "Biology", "MOT", "Term 2", 2026);
    // "Sen1A" ? "SEN1"
    // "Biology" ? "BIOL"
    // "Term2" ? "TE"
    expect(a).toBe("MS-2026-SEN1-A-BIOL-MOT-TE");
  });

  it("uppercases all segments", () => {
    const id = computeMarksheetId("s1", "a", "physics", "bot", "t1", 2026);
    expect(id).toBe("MS-2026-S1-A-PHYS-BOT-T1");
  });

  it("is consistent with parseMarksheetIdComponents round-trip", () => {
    const id = computeMarksheetId("Senior 1 A", "A", "English Language", "EOT", "Term 1", 2026);
    const parsed = parseMarksheetIdComponents(id);
    expect(parsed.valid).toBe(true);
    expect(parsed.year).toBe("2026");
    expect(parsed.stream).toBe("A");
    expect(parsed.examType).toBe("EOT");
  });
});

// ── computeSheetNumber ────────────────────────────────────────────────────────

describe("computeSheetNumber", () => {
  const id = "MS-2026-SEN1-A-MATH-EOT-TE";
  const date = new Date("2026-06-11");

  it("produces YYYYMMDD-NNN format", () => {
    const sn = computeSheetNumber(id, date);
    expect(sn).toMatch(/^\d{8}-\d{3}$/);
    expect(sn.startsWith("20260611-")).toBe(true);
  });

  it("is deterministic ? same ID and date always gives same result", () => {
    expect(computeSheetNumber(id, date)).toBe(computeSheetNumber(id, date));
  });

  it("different marksheet IDs generally produce different suffixes", () => {
    const id2 = "MS-2026-SEN1-A-ENGL-EOT-TE";
    const sn1 = computeSheetNumber(id, date);
    const sn2 = computeSheetNumber(id2, date);
    // Different IDs should (almost always) have different 3-digit suffixes
    expect(sn1).not.toBe(sn2);
  });

  it("date portion matches the supplied generation date", () => {
    const d = new Date("2025-12-01");
    expect(computeSheetNumber(id, d).startsWith("20251201-")).toBe(true);
  });
});

// ── findSheetNumberInText ─────────────────────────────────────────────────────

describe("findSheetNumberInText", () => {
  it("finds SHEET NO: YYYYMMDD-NNN in OCR text", () => {
    const text = "SCHOOL NAME\nACADEMIC MARKSHEET\nSHEET NO: 20260611-042\nAcademic Year: 2025/2026";
    expect(findSheetNumberInText(text)).toBe("20260611-042");
  });

  it("handles SHEET NO with a dot separator", () => {
    const text = "SHEET NO. 20260611-007";
    expect(findSheetNumberInText(text)).toBe("20260611-007");
  });

  it("handles OCR noise (zero read as O in NO)", () => {
    const text = "SHEET N0 20260611-099";
    expect(findSheetNumberInText(text)).toBe("20260611-099");
  });

  it("returns null when no sheet number present", () => {
    expect(findSheetNumberInText("ACADEMIC MARKSHEET MS-2026-SEN1-A-MATH-EOT-TE")).toBeNull();
  });
});

// ── findMarksheetIdBySheetNumber ──────────────────────────────────────────────

describe("findMarksheetIdBySheetNumber", () => {
  const targetId = "MS-2026-SEN1-A-MATH-EOT-TE";
  const date = new Date("2026-06-11");
  const sheetNumber = computeSheetNumber(targetId, date);

  function prismaMock() {
    return {
      markImportBatch: { findMany: async () => [] },
      schoolClass: {
        findMany: async () => [
          { name: "Senior 1 A", streams: [{ name: "A", code: "A" }] },
        ],
      },
      subject: {
        findMany: async () => [{ name: "Mathematics", code: "MATH" }],
      },
      term: {
        findMany: async () => [
          { name: "Term 1", startsOn: new Date("2026-01-10"), academicYear: { name: "2025/2026" } },
        ],
      },
    };
  }

  it("resolves a marksheet ID from a sheet number via school data cross-product", async () => {
    const found = await findMarksheetIdBySheetNumber(prismaMock() as any, "school-1", sheetNumber);
    expect(found).toBe(targetId);
  });

  it("returns null for an invalid sheet number format", async () => {
    const found = await findMarksheetIdBySheetNumber(prismaMock() as any, "school-1", "INVALID");
    expect(found).toBeNull();
  });
});

// ── findMarksheetIdInText ─────────────────────────────────────────────────────

describe("findMarksheetIdInText", () => {
  it("finds an ID embedded in header OCR text", () => {
    const text = `
SCHOOL CONNECT DEMONSTRATION SCHOOL
ACADEMIC MARKSHEET
Academic Year: 2025/2026    Term: Term 1
Class: Senior 1 A           Stream: A
Subject: English Language   Exam Type: BOT - Beginning of Term
Marksheet ID: MS-2026-SENI-A-ENGL-BOT-TE
Generated: 11 June 2026
`;
    expect(findMarksheetIdInText(text)).toBe("MS-2026-SEN1-A-ENGL-BOT-TE");
  });

  it("is case-insensitive", () => {
    const text = "ms-2026-SEN1-A-MATH-EOT-TE something";
    expect(findMarksheetIdInText(text)).toBe("MS-2026-SEN1-A-MATH-EOT-TE");
  });

  it("returns null when no ID is present", () => {
    expect(findMarksheetIdInText("Hello World 1234")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(findMarksheetIdInText("")).toBeNull();
  });

  it("picks the first ID when multiple are present", () => {
    const text = "MS-2026-S1-A-MATH-BOT-T1 ... MS-2026-S2-B-ENGL-EOT-TE";
    expect(findMarksheetIdInText(text)).toBe("MS-2026-S1-A-MATH-BOT-T1");
  });

  it("handles OCR noise characters around the ID", () => {
    const text = "ID: MS 2026 SENI A ENGL EOT TE.";
    expect(findMarksheetIdInText(text)).toBe("MS-2026-SEN1-A-ENGL-EOT-TE");
  });
});

