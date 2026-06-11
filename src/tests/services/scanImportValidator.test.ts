import { describe, expect, it } from "vitest";
import { validateScanRows, type KnownStudent } from "../../server/services/scanImportValidator";
import type { ScanImportRow, ScanMarksheetContext } from "../../shared/types/imports";

const context: ScanMarksheetContext = {
  marksheetId: "MS-2026-S1A-A-MATH-BOT-T1",
  className: "Senior 1 A",
  streamName: "A",
  subjectName: "Mathematics",
  termName: "Term 1",
  examType: "BOT",
  academicYear: "2026",
};

const students: KnownStudent[] = [
  { admissionNumber: "S1A-001" },
  { admissionNumber: "S1A-002" },
  { admissionNumber: "S1A-003" },
];

function makeRow(overrides: Partial<ScanImportRow> = {}): ScanImportRow {
  return {
    rowNumber: 1,
    admissionNumber: "S1A-001",
    studentName: "Kampala Ssempebwa",
    writtenMark: "75",
    splitMark: "75",
    suggestedMark: "",
    confidence: 0.95,
    remarks: "",
    status: "PARSED",
    validationErrors: [],
    operatorCorrection: "",
    ...overrides,
  };
}

describe("validateScanRows", () => {
  it("marks a clean row as VALID", () => {
    const [result] = validateScanRows([makeRow()], context, students);
    expect(result.status).toBe("VALID");
    expect(result.validationErrors).toHaveLength(0);
    expect(result.suggestedMark).toBe("75");
  });

  it("written mark and split mark mismatch → NEEDS_REVIEW", () => {
    const [result] = validateScanRows(
      [makeRow({ writtenMark: "70", splitMark: "75" })],
      context,
      students,
    );
    expect(result.status).toBe("NEEDS_REVIEW");
    expect(result.suggestedMark).toBe("");
  });

  it("low confidence → NEEDS_REVIEW", () => {
    const [result] = validateScanRows(
      [makeRow({ confidence: 0.5 })],
      context,
      students,
    );
    expect(result.status).toBe("NEEDS_REVIEW");
  });

  it("blank written mark and blank split mark → PARSED (missing, not zero)", () => {
    const [result] = validateScanRows(
      [makeRow({ writtenMark: "", splitMark: "" })],
      context,
      students,
    );
    // Blank means missing — not an error, not zero
    expect(result.validationErrors).toHaveLength(0);
    expect(result.suggestedMark).toBe("");
    expect(result.status).toBe("MISSING");
  });

  it("blank written mark but valid split mark → uses split as suggestion", () => {
    const [result] = validateScanRows(
      [makeRow({ writtenMark: "", splitMark: "68" })],
      context,
      students,
    );
    expect(result.suggestedMark).toBe("68");
    expect(result.status).toBe("VALID");
  });

  it("valid written mark, blank split mark → uses written as suggestion", () => {
    const [result] = validateScanRows(
      [makeRow({ writtenMark: "88", splitMark: "" })],
      context,
      students,
    );
    expect(result.suggestedMark).toBe("88");
    expect(result.status).toBe("VALID");
  });

  it("unknown admission number → INVALID", () => {
    const [result] = validateScanRows(
      [makeRow({ admissionNumber: "S1A-UNKNOWN" })],
      context,
      students,
    );
    expect(result.status).toBe("INVALID");
    expect(result.validationErrors.some((e) => e.includes("not enrolled"))).toBe(true);
  });

  it("missing admission number → INVALID", () => {
    const [result] = validateScanRows(
      [makeRow({ admissionNumber: "" })],
      context,
      students,
    );
    expect(result.status).toBe("INVALID");
    expect(result.validationErrors.some((e) => e.includes("missing"))).toBe(true);
  });

  it("AB mark is valid", () => {
    const [result] = validateScanRows(
      [makeRow({ writtenMark: "AB", splitMark: "AB" })],
      context,
      students,
    );
    expect(result.suggestedMark).toBe("AB");
    expect(result.validationErrors).toHaveLength(0);
    expect(result.status).toBe("VALID");
  });

  it("EX mark is valid", () => {
    const [result] = validateScanRows(
      [makeRow({ writtenMark: "EX", splitMark: "" })],
      context,
      students,
    );
    expect(result.suggestedMark).toBe("EX");
    expect(result.validationErrors).toHaveLength(0);
  });

  it("mark above 100 → INVALID after operator correction", () => {
    const [result] = validateScanRows(
      [makeRow({ writtenMark: "105", splitMark: "105", operatorCorrection: "105" })],
      context,
      students,
    );
    expect(result.validationErrors.some((e) => e.includes("not valid"))).toBe(true);
    expect(result.status).toBe("INVALID");
  });

  it("operator correction overrides suggested mark for validation", () => {
    const [result] = validateScanRows(
      [makeRow({ writtenMark: "70", splitMark: "75", operatorCorrection: "72" })],
      context,
      students,
    );
    // Conflict between written/split, but operator provided correction → VALID
    expect(result.validationErrors).toHaveLength(0);
    expect(result.status).toBe("VALID");
  });

  it("invalid exam type context → all rows INVALID", () => {
    const badContext = { ...context, examType: "MIDYEAR" };
    const [result] = validateScanRows([makeRow()], badContext, students);
    expect(result.status).toBe("INVALID");
    expect(result.validationErrors.some((e) => e.includes("BOT, MOT, or EOT"))).toBe(true);
  });

  it("never silently drops rows — returns one result per input row", () => {
    const rows = [
      makeRow({ rowNumber: 1 }),
      makeRow({ rowNumber: 2, admissionNumber: "S1A-002" }),
      makeRow({ rowNumber: 3, admissionNumber: "UNKNOWN" }),
    ];
    const results = validateScanRows(rows, context, students);
    expect(results).toHaveLength(3);
  });
});
