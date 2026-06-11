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

const roster: KnownStudent[] = [
  { admissionNumber: "S1A-001" },
  { admissionNumber: "S1A-002" },
  { admissionNumber: "S1A-003" },
  { admissionNumber: "S1A-004" },
];

function row(overrides: Partial<ScanImportRow>): ScanImportRow {
  return {
    rowNumber: 1,
    admissionNumber: "S1A-001",
    studentName: "Kampala Ssempebwa",
    writtenMark: "",
    splitMark: "",
    extractedMark: "",
    suggestedMark: "",
    confidence: 0.2,
    remarks: "",
    status: "PARSED",
    validationErrors: [],
    operatorCorrection: "",
    ...overrides,
  };
}

describe("scan operator-assisted workflow", () => {
  it("poor OCR does not create a fake extracted mark", () => {
    const [result] = validateScanRows(
      [row({ writtenMark: "82", splitMark: "82", extractedMark: "", confidence: 0.35 })],
      context,
      roster,
    );

    expect(result.suggestedMark).toBe("");
    expect(result.status).toBe("MISSING");
    expect(result.statusReason).toBe("Needs entry.");
  });

  it("operator mark overrides blank extraction during dry-run validation", () => {
    const [result] = validateScanRows(
      [row({ operatorCorrection: "82" })],
      context,
      roster,
    );

    expect(result.status).toBe("VALID");
    expect(result.validationErrors).toHaveLength(0);
  });

  it("blank operator mark remains missing, not zero", () => {
    const [result] = validateScanRows([row({ operatorCorrection: "" })], context, roster);

    expect(result.status).toBe("MISSING");
    expect(result.suggestedMark).toBe("");
  });

  it("AB and EX operator marks are accepted by validation", () => {
    const [absent] = validateScanRows([row({ operatorCorrection: "AB" })], context, roster);
    const [exempt] = validateScanRows([row({ operatorCorrection: "EX" })], context, roster);

    expect(absent.status).toBe("VALID");
    expect(exempt.status).toBe("VALID");
  });

  it("keeps all roster rows available for operator entry", () => {
    const rows = validateScanRows(
      roster.map((student, index) =>
        row({
          rowNumber: index + 1,
          admissionNumber: student.admissionNumber,
          studentName: `Student ${index + 1}`,
        }),
      ),
      context,
      roster,
    );

    expect(rows).toHaveLength(4);
    expect(rows.map((item) => item.admissionNumber)).toEqual(["S1A-001", "S1A-002", "S1A-003", "S1A-004"]);
  });
});
