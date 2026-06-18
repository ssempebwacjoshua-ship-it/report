import { describe, expect, it } from "vitest";
import {
  validateAndMatchGeminiRows,
  classifyMark,
  type ExpectedStudent,
} from "../../server/services/geminiMarksImportService";
import type { GeminiExtractedMarkRow } from "../../server/services/geminiOcrService";

const STUDENTS: ExpectedStudent[] = [
  { studentId: "db-1", admissionNumber: "SC2026-00001", studentName: "Alice Nantongo" },
  { studentId: "db-2", admissionNumber: "SC2026-00094", studentName: "Faith Mukulu" },
  { studentId: "db-3", admissionNumber: "SC2026-00003", studentName: "Brian Okello" },
];

function row(overrides: Partial<GeminiExtractedMarkRow> = {}): GeminiExtractedMarkRow {
  return {
    studentId: "SC2026-00001",
    studentName: "Alice Nantongo",
    mark: "82",
    confidenceScore: 1,
    needsReview: false,
    ...overrides,
  };
}

describe("classifyMark", () => {
  it("flags empty as missing", () => {
    expect(classifyMark("").issue).toBe("Missing mark");
    expect(classifyMark("   ").issue).toBe("Missing mark");
  });
  it("flags non-numeric as invalid", () => {
    expect(classifyMark("AB").issue).toBe("Invalid mark");
  });
  it("flags out of range", () => {
    expect(classifyMark("101").issue).toBe("Mark outside valid range");
    expect(classifyMark("-1").issue).toBe("Mark outside valid range");
  });
  it("accepts boundary 0 and 100", () => {
    expect(classifyMark("0").issue).toBeNull();
    expect(classifyMark("100").issue).toBeNull();
  });
});

describe("validateAndMatchGeminiRows â€” mark validation", () => {
  it("empty mark becomes REVIEW_REQUIRED with 'Missing mark'", () => {
    const { rows } = validateAndMatchGeminiRows([row({ mark: "" })], STUDENTS);
    expect(rows[0]!.status).toBe("REVIEW_REQUIRED");
    expect(rows[0]!.issues).toContain("Missing mark");
  });

  it("acceptance: studentId SC2026-00094 / Faith Mukulu with empty mark and high Gemini confidence is REVIEW_REQUIRED 'Missing mark'", () => {
    const faith = row({
      studentId: "SC2026-00094",
      studentName: "Faith Mukulu",
      mark: "",
      confidenceScore: 1,
      needsReview: false, // Gemini wrongly said no review â€” backend must override
    });
    const { rows, summary } = validateAndMatchGeminiRows([faith], STUDENTS);
    expect(rows[0]!.status).toBe("REVIEW_REQUIRED");
    expect(rows[0]!.issues).toContain("Missing mark");
    expect(summary.missingMarkRows).toBe(1);
  });

  it("non-numeric mark becomes REVIEW_REQUIRED 'Invalid mark'", () => {
    const { rows } = validateAndMatchGeminiRows([row({ mark: "fortyfive" })], STUDENTS);
    expect(rows[0]!.status).toBe("REVIEW_REQUIRED");
    expect(rows[0]!.issues).toContain("Invalid mark");
  });

  it("mark 0 is valid â†’ READY", () => {
    const { rows } = validateAndMatchGeminiRows([row({ mark: "0" })], STUDENTS);
    expect(rows[0]!.status).toBe("READY");
  });

  it("mark 100 is valid â†’ READY", () => {
    const { rows } = validateAndMatchGeminiRows([row({ mark: "100" })], STUDENTS);
    expect(rows[0]!.status).toBe("READY");
  });

  it("mark 101 becomes REVIEW_REQUIRED", () => {
    const { rows } = validateAndMatchGeminiRows([row({ mark: "101" })], STUDENTS);
    expect(rows[0]!.status).toBe("REVIEW_REQUIRED");
    expect(rows[0]!.issues).toContain("Mark outside valid range");
  });

  it("mark -1 becomes REVIEW_REQUIRED", () => {
    const { rows } = validateAndMatchGeminiRows([row({ mark: "-1" })], STUDENTS);
    expect(rows[0]!.status).toBe("REVIEW_REQUIRED");
    expect(rows[0]!.issues).toContain("Mark outside valid range");
  });
});

describe("validateAndMatchGeminiRows â€” student matching", () => {
  it("matches by studentId and surfaces matchedStudentId/Name separately", () => {
    const { rows } = validateAndMatchGeminiRows([row()], STUDENTS);
    expect(rows[0]!.matchedStudentId).toBe("db-1");
    expect(rows[0]!.matchedStudentName).toBe("Alice Nantongo");
    expect(rows[0]!.extractedStudentId).toBe("SC2026-00001");
    expect(rows[0]!.status).toBe("READY");
  });

  it("unknown studentId becomes REVIEW_REQUIRED or BLOCKED and is unmatched", () => {
    const { rows, summary } = validateAndMatchGeminiRows(
      [row({ studentId: "SC2026-99999", studentName: "Ghost Student" })],
      STUDENTS,
    );
    expect(["REVIEW_REQUIRED", "BLOCKED"]).toContain(rows[0]!.status);
    expect(rows[0]!.matchedStudentId).toBeNull();
    expect(summary.unmatchedStudentRows).toBe(1);
  });

  it("duplicate studentId becomes REVIEW_REQUIRED for both rows", () => {
    const { rows, summary } = validateAndMatchGeminiRows(
      [row({ mark: "70" }), row({ mark: "65" })],
      STUDENTS,
    );
    expect(rows[0]!.issues).toContain("Duplicate student ID in scan");
    expect(rows[1]!.issues).toContain("Duplicate student ID in scan");
    expect(rows[0]!.status).toBe("REVIEW_REQUIRED");
    expect(summary.duplicateStudentRows).toBe(2);
  });

  it("name mismatch with valid studentId is REVIEW_REQUIRED but still matched (not blocked)", () => {
    const { rows } = validateAndMatchGeminiRows(
      [row({ studentId: "SC2026-00001", studentName: "Wrong Name" })],
      STUDENTS,
    );
    expect(rows[0]!.status).toBe("REVIEW_REQUIRED");
    expect(rows[0]!.issues).toContain("Name mismatch with enrolled student");
    expect(rows[0]!.matchedStudentId).toBe("db-1");
  });

  it("fuzzy name match (no ID match) is REVIEW_REQUIRED and matched", () => {
    const { rows } = validateAndMatchGeminiRows(
      [row({ studentId: "", studentName: "Brian Okello" })],
      STUDENTS,
    );
    expect(rows[0]!.matchedStudentId).toBe("db-3");
    expect(rows[0]!.status).toBe("REVIEW_REQUIRED");
  });
});

describe("validateAndMatchGeminiRows â€” summary", () => {
  it("computes a complete summary", () => {
    const { summary } = validateAndMatchGeminiRows(
      [
        row({ studentId: "SC2026-00001", studentName: "Alice Nantongo", mark: "82" }), // ready
        row({ studentId: "SC2026-00094", studentName: "Faith Mukulu", mark: "" }), // missing
        row({ studentId: "SC2026-00003", studentName: "Brian Okello", mark: "150" }), // range
        row({ studentId: "SC2026-77777", studentName: "Nobody Here", mark: "50" }), // unmatched
      ],
      STUDENTS,
    );
    expect(summary.totalRows).toBe(4);
    expect(summary.readyRows).toBe(1);
    expect(summary.missingMarkRows).toBe(1);
    expect(summary.invalidMarkRows).toBe(1);
    expect(summary.unmatchedStudentRows).toBe(1);
    expect(summary.readyRows + summary.reviewRows + summary.blockedRows).toBe(summary.totalRows);
  });
});

