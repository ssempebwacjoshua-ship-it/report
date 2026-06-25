import type { ScanImportRow, ScanMarksheetContext } from "../../shared/types/imports";
import { validateScoreEntry } from "./scoreValidationService";

const VALID_EXAM_TYPES = new Set(["BOT", "MOT", "EOT"]);

function norm(v: string): string {
  return v.trim().toLowerCase();
}

export function parseScanMark(v: string): string {
  const result = validateScoreEntry(v, { allowAbsent: true, allowExempt: true, allowBlank: true });
  if (!result.valid) return "INVALID";
  if (result.kind === "blank") return "";
  if (result.kind === "code") return result.code;
  if (result.kind === "numeric") return result.normalized;
  return "INVALID";
}

function resolveSuggestedMark(
  written: string,
  split: string,
): { suggested: string; conflict: boolean } {
  const w = parseScanMark(written);
  const s = parseScanMark(split);

  // Both blank means the mark is still missing, not necessarily wrong.
  if (w === "" && s === "") return { suggested: "", conflict: false };

  if (w === "") return { suggested: s === "INVALID" ? "" : s, conflict: false };
  if (s === "") return { suggested: w === "INVALID" ? "" : w, conflict: false };
  if (w === s) return { suggested: w === "INVALID" ? "" : w, conflict: false };

  return { suggested: "", conflict: true };
}

export type KnownStudent = { admissionNumber: string };

function getAcceptedExtractedMark(row: ScanImportRow, fallbackSuggested: string): string {
  const candidate = Object.prototype.hasOwnProperty.call(row, "extractedMark")
    ? (row.extractedMark ?? "")
    : (row.suggestedMark || fallbackSuggested);
  const extracted = parseScanMark(candidate);
  if (extracted === "INVALID") return "";
  return extracted;
}

export function validateScanRows(
  rows: ScanImportRow[],
  context: ScanMarksheetContext,
  knownStudents: KnownStudent[],
  options: { minimumConfidenceForSuggestion?: number } = {},
): ScanImportRow[] {
  const studentSet = new Set(knownStudents.map((s) => norm(s.admissionNumber)));
  const examType = context.examType.trim().toUpperCase();
  const examTypeValid = VALID_EXAM_TYPES.has(examType);
  const minimumConfidence = options.minimumConfidenceForSuggestion ?? 0.7;

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
    const extracted = getAcceptedExtractedMark(row, suggested);
    const operatorMark = row.operatorCorrection.trim();
    const finalMark = operatorMark || extracted;

    if (finalMark !== "") {
      const scoreCheck = validateScoreEntry(finalMark, { allowAbsent: true, allowExempt: true });
      if (!scoreCheck.valid) {
        errors.push(scoreCheck.error);
      }
    }

    const operatorResolved = operatorMark !== "";

    let status: ScanImportRow["status"];
    let statusReason = "";
    if (errors.length > 0) {
      status = "INVALID";
      statusReason = errors[0] ?? "Invalid row.";
    } else if (!operatorResolved && conflict) {
      status = "NEEDS_REVIEW";
      statusReason = "Written and split mark OCR disagree. Enter the operator mark.";
    } else if (finalMark !== "") {
      status = !operatorResolved && row.confidence < minimumConfidence ? "NEEDS_REVIEW" : "VALID";
      statusReason = status === "VALID"
        ? (operatorResolved ? "Operator mark accepted." : "Confident extracted mark accepted.")
        : "Extraction confidence is low. Confirm or enter the operator mark.";
    } else {
      status = "MISSING";
      statusReason = row.statusReason || "Needs entry.";
    }

    return {
      ...row,
      suggestedMark: extracted,
      extractedMark: extracted,
      status,
      statusReason,
      validationErrors: errors,
    };
  });
}

export { resolveSuggestedMark as _resolveSuggestedMark };
