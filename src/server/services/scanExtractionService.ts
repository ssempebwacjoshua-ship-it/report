import type { PrismaClient } from "@prisma/client";
import type { ScanImportRow, ScanMarksheetContext } from "../../shared/types/imports";
import { COLUMNS, cellToPixel, dataRowRegion } from "./marksheetGeometryService";
import { preprocessScanImage, cropCell } from "./scanPreprocessService";
import { recognizeWrittenMark, recognizeSplitMark } from "./markRecognitionService";
import { validateScanRows } from "./scanImportValidator";

// ── Roster lookup ─────────────────────────────────────────────────────────────

type RosterStudent = { admissionNumber: string; studentName: string };

async function loadRoster(
  prisma: PrismaClient,
  schoolId: string,
  context: ScanMarksheetContext,
): Promise<RosterStudent[]> {
  const enrollments = await prisma.classEnrollment.findMany({
    where: {
      isActive: true,
      status: "ACTIVE",
      student: { schoolId },
      class: {
        schoolId,
        name: { contains: context.className.trim(), mode: "insensitive" },
      },
      stream: {
        name: { contains: context.streamName.trim(), mode: "insensitive" },
      },
    },
    include: { student: true },
    orderBy: { student: { admissionNumber: "asc" } },
  });

  return enrollments.map((e) => ({
    admissionNumber: e.student.admissionNumber,
    studentName: `${e.student.firstName} ${e.student.lastName}`.trim(),
  }));
}

// ── Main extraction ───────────────────────────────────────────────────────────

export type ExtractionResult = {
  parseStatus: "PARSED" | "FAILED";
  message: string;
  rows: ScanImportRow[];
  studentCount: number;
};

/**
 * Extract marks from a scanned marksheet image.
 *
 * Strategy (template-based, not generic OCR):
 *   1. Load the enrolled roster for this class/stream from the database.
 *   2. Preprocess the image with Sharp (greyscale, normalise, sharpen).
 *   3. For each roster student at row index i, calculate the cell coordinates
 *      from the fixed A4 template geometry.
 *   4. OCR each mark cell (written + split) and normalise the result.
 *   5. Run the existing `validateScanRows` pipeline to assign VALID/NEEDS_REVIEW/INVALID.
 *
 * Never auto-commits — returns rows in PARSED/NEEDS_REVIEW/VALID/INVALID state
 * for mandatory operator review.
 */
export async function extractMarksFromScan(
  prisma: PrismaClient,
  fileBuffer: Buffer,
  mimeType: string,
  schoolId: string,
  context: ScanMarksheetContext,
): Promise<ExtractionResult> {
  // 1. Preprocess image
  let scan: { buffer: Buffer; width: number; height: number };
  try {
    scan = await preprocessScanImage(fileBuffer, mimeType);
  } catch (err) {
    return {
      parseStatus: "FAILED",
      message: err instanceof Error ? err.message : "Image preprocessing failed.",
      rows: [],
      studentCount: 0,
    };
  }

  if (scan.width === 0 || scan.height === 0) {
    return {
      parseStatus: "FAILED",
      message: "Scan image has zero dimensions. Upload a valid PNG or JPG.",
      rows: [],
      studentCount: 0,
    };
  }

  // 2. Load roster
  let roster: RosterStudent[];
  try {
    roster = await loadRoster(prisma, schoolId, context);
  } catch (err) {
    return {
      parseStatus: "FAILED",
      message: `Roster lookup failed: ${err instanceof Error ? err.message : String(err)}`,
      rows: [],
      studentCount: 0,
    };
  }

  if (roster.length === 0) {
    return {
      parseStatus: "FAILED",
      message:
        `No active students found for class "${context.className}" stream "${context.streamName}". ` +
        "Check the class and stream names match the school's enrollment records.",
      rows: [],
      studentCount: 0,
    };
  }

  // 3. Extract mark cells for each roster student
  const rawRows: ScanImportRow[] = [];

  for (let i = 0; i < roster.length; i++) {
    const student = roster[i]!;
    const rowFrac = dataRowRegion(i);

    const writtenRect = cellToPixel(COLUMNS.writtenMark, rowFrac, scan.width, scan.height);
    const splitRect   = cellToPixel(COLUMNS.splitMark,   rowFrac, scan.width, scan.height);

    let writtenResult = { rawText: "", normalizedMark: "", confidence: 0 };
    let splitResult   = { rawText: "", normalizedMark: "", confidence: 0 };

    try {
      const writtenCell = await cropCell(scan.buffer, writtenRect);
      writtenResult = await recognizeWrittenMark(writtenCell);
    } catch {
      // Cell crop or OCR failed — leave blank (treated as missing, not zero)
    }

    try {
      const splitCell = await cropCell(scan.buffer, splitRect);
      splitResult = await recognizeSplitMark(splitCell);
    } catch {
      // Cell crop or OCR failed — leave blank
    }

    // Use the lower of the two confidence scores for conservative gating
    const confidence = writtenResult.confidence > 0 || splitResult.confidence > 0
      ? Math.min(
          writtenResult.confidence > 0 ? writtenResult.confidence : 1,
          splitResult.confidence  > 0 ? splitResult.confidence  : 1,
        )
      : 0;

    rawRows.push({
      rowNumber: i + 1,
      admissionNumber: student.admissionNumber,
      studentName: student.studentName,
      writtenMark: writtenResult.normalizedMark,
      splitMark: splitResult.normalizedMark,
      suggestedMark: "",
      confidence,
      remarks: "",
      status: "PARSED",
      validationErrors: [],
      operatorCorrection: "",
    });
  }

  // 4. Run validation (assigns VALID / NEEDS_REVIEW / INVALID per row)
  const validatedRows = validateScanRows(rawRows, context, roster);

  const countByStatus = validatedRows.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});

  const parts: string[] = [];
  if (countByStatus["VALID"])        parts.push(`${countByStatus["VALID"]} valid`);
  if (countByStatus["NEEDS_REVIEW"]) parts.push(`${countByStatus["NEEDS_REVIEW"]} need review`);
  if (countByStatus["INVALID"])      parts.push(`${countByStatus["INVALID"]} invalid`);

  return {
    parseStatus: "PARSED",
    message: `Extracted ${roster.length} rows: ${parts.join(", ") || "all blank (no marks visible)"}.`,
    rows: validatedRows,
    studentCount: roster.length,
  };
}
