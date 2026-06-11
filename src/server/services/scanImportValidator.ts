import type { ScanImportRow, ScanMarksheetContext } from "../../shared/types/imports";

const VALID_EXAM_TYPES = new Set(["BOT", "MOT", "EOT"]);

function norm(v: string): string {
  return v.trim().toLowerCase();
}

function parseMark(v: string): string {
  const t = v.trim().toUpperCase();
  if (t === "AB" || t === "EX") return t;
  if (t === "") return "";
  const n = Number(t);
  if (!Number.isNaN(n) && n >= 0 && n <= 100) return String(n);
  return "INVALID";
}

function resolveSuggestedMark(
  written: string,
  split: string,
): { suggested: string; conflict: boolean } {
  const w = parseMark(written);
  const s = parseMark(split);

  // Both blank → missing mark (not an error)
  if (w === "" && s === "") return { suggested: "", conflict: false };

  // One side is blank — use the other
  if (w === "") return { suggested: s === "INVALID" ? "" : s, conflict: false };
  if (s === "") return { suggested: w === "INVALID" ? "" : w, conflict: false };

  // Both present and agree
  if (w === s) return { suggested: w === "INVALID" ? "" : w, conflict: false };

  // Both present and disagree → needs review
  return { suggested: "", conflict: true };
}

export type KnownStudent = { admissionNumber: string };

export function validateScanRows(
  rows: ScanImportRow[],
  context: ScanMarksheetContext,
  knownStudents: KnownStudent[],
): ScanImportRow[] {
  const studentSet = new Set(knownStudents.map((s) => norm(s.admissionNumber)));
  const examType = context.examType.trim().toUpperCase();
  const examTypeValid = VALID_EXAM_TYPES.has(examType);

  return rows.map((row): ScanImportRow => {
    const errors: string[] = [];

    if (!examTypeValid) {
      errors.push(`Exam type must be BOT, MOT, or EOT. Got: ${context.examType}`);
    }

    if (!row.admissionNumber.trim()) {
      errors.push("Admission number is missing.");
    } else if (!studentSet.has(norm(row.admissionNumber))) {
      errors.push(
        `Admission number ${row.admissionNumber} is not enrolled in ${context.className} ${context.streamName}.`,
      );
    }

    const { suggested, conflict } = resolveSuggestedMark(row.writtenMark, row.splitMark);
    const finalMark = row.operatorCorrection.trim() || suggested;

    if (finalMark && finalMark !== "" && parseMark(finalMark) === "INVALID") {
      errors.push(`Mark "${finalMark}" is not valid. Use 0–100, AB, or EX.`);
    }

    // Operator correction resolves both mark conflicts and low-confidence flags
    const operatorResolved = row.operatorCorrection.trim() !== "";

    let status: ScanImportRow["status"];
    if (errors.length > 0) {
      status = "INVALID";
    } else if (!operatorResolved && (conflict || row.confidence < 0.7)) {
      status = "NEEDS_REVIEW";
    } else if (finalMark !== "") {
      status = "VALID";
    } else {
      status = "PARSED";
    }

    return {
      ...row,
      suggestedMark: suggested,
      status,
      validationErrors: errors,
    };
  });
}

export { resolveSuggestedMark as _resolveSuggestedMark };
