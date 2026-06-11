import type { PrismaClient } from "@prisma/client";
import type { ScanImportRow, ScanMarksheetContext } from "../../shared/types/imports";
import {
  COLUMNS,
  cellToPixel,
  dataRowRegion,
  splitRectIntoVerticalZones,
  tableToPixel,
} from "./marksheetGeometryService";
import {
  bufferToDataUrl,
  cropCell,
  cropPreview,
  preprocessScanImage,
} from "./scanPreprocessService";
import {
  recognizeSplitMarkZones,
  recognizeWrittenMark,
} from "./markRecognitionService";
import { validateScanRows } from "./scanImportValidator";

type RosterStudent = { admissionNumber: string; studentName: string };

function acceptedExtractedMark(
  writtenMark: string,
  splitMark: string,
  confidence: number,
): { mark: string; reason: string } {
  if (!writtenMark && !splitMark) {
    return { mark: "", reason: "No confident mark detected. Needs operator entry." };
  }

  if (writtenMark && splitMark && writtenMark === splitMark && confidence >= 0.85) {
    return { mark: writtenMark, reason: "Written and split marks agree with high confidence." };
  }

  if (writtenMark && !splitMark && confidence >= 0.92) {
    return { mark: writtenMark, reason: "Written mark detected with high confidence; split mark was blank." };
  }

  if (splitMark && !writtenMark && confidence >= 0.92) {
    return { mark: splitMark, reason: "Split mark detected with high confidence; written mark was blank." };
  }

  return { mark: "", reason: "Extraction was not confident enough. Needs operator entry." };
}

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

  return enrollments.map((enrollment) => ({
    admissionNumber: enrollment.student.admissionNumber,
    studentName: `${enrollment.student.firstName} ${enrollment.student.lastName}`.trim(),
  }));
}

export type ExtractionResult = {
  parseStatus: "PARSED" | "FAILED";
  message: string;
  rows: ScanImportRow[];
  studentCount: number;
};

export async function extractMarksFromScan(
  prisma: PrismaClient,
  fileBuffer: Buffer,
  mimeType: string,
  schoolId: string,
  context: ScanMarksheetContext,
): Promise<ExtractionResult> {
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
      message: "Scan image has zero dimensions. Upload a valid PNG, JPG, WEBP, or PDF scan.",
      rows: [],
      studentCount: 0,
    };
  }

  let roster: RosterStudent[] = [];
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

  let tableCropDataUrl = "";
  try {
    tableCropDataUrl = bufferToDataUrl(await cropPreview(scan.buffer, tableToPixel(scan.width, scan.height)));
  } catch {
    tableCropDataUrl = "";
  }

  const rawRows: ScanImportRow[] = [];

  for (let index = 0; index < roster.length; index++) {
    const student = roster[index]!;
    const rowFrac = dataRowRegion(index);
    const writtenRect = cellToPixel(COLUMNS.writtenMark, rowFrac, scan.width, scan.height);
    const splitRect = cellToPixel(COLUMNS.splitMark, rowFrac, scan.width, scan.height);
    const splitZoneRects = splitRectIntoVerticalZones(splitRect, 3);

    let writtenResult = { rawText: "", normalizedMark: "", confidence: 0 };
    let splitResult = {
      rawText: "",
      normalizedMark: "",
      confidence: 0,
      zoneRawText: ["", "", ""],
      zoneMarks: ["", "", ""],
      zoneConfidences: [0, 0, 0],
    };
    let writtenCropDataUrl = "";
    let splitCropDataUrl = "";
    let splitDigitCropDataUrls: string[] = [];

    try {
      const writtenCell = await cropCell(scan.buffer, writtenRect);
      writtenCropDataUrl = bufferToDataUrl(await cropPreview(scan.buffer, writtenRect));
      writtenResult = await recognizeWrittenMark(writtenCell);
    } catch {
      writtenResult = { rawText: "", normalizedMark: "", confidence: 0 };
    }

    try {
      splitCropDataUrl = bufferToDataUrl(await cropPreview(scan.buffer, splitRect));
      const splitZoneCells = await Promise.all(splitZoneRects.map((rect) => cropCell(scan.buffer, rect)));
      splitDigitCropDataUrls = await Promise.all(
        splitZoneRects.map(async (rect) => bufferToDataUrl(await cropPreview(scan.buffer, rect))),
      );
      splitResult = await recognizeSplitMarkZones(splitZoneCells);
    } catch {
      splitResult = {
        rawText: "",
        normalizedMark: "",
        confidence: 0,
        zoneRawText: ["", "", ""],
        zoneMarks: ["", "", ""],
        zoneConfidences: [0, 0, 0],
      };
    }

    const confidence = writtenResult.confidence > 0 || splitResult.confidence > 0
      ? Math.min(
          writtenResult.confidence > 0 ? writtenResult.confidence : 1,
          splitResult.confidence > 0 ? splitResult.confidence : 1,
      )
      : 0;
    const extracted = acceptedExtractedMark(
      writtenResult.normalizedMark,
      splitResult.normalizedMark,
      confidence,
    );

    rawRows.push({
      rowNumber: index + 1,
      admissionNumber: student.admissionNumber,
      studentName: student.studentName,
      writtenMark: writtenResult.normalizedMark,
      splitMark: splitResult.normalizedMark,
      extractedMark: extracted.mark,
      suggestedMark: extracted.mark,
      confidence,
      remarks: "",
      writtenMarkRaw: writtenResult.rawText,
      splitMarkRaw: splitResult.rawText,
      splitDigitRaw: splitResult.zoneRawText,
      writtenCropDataUrl,
      splitCropDataUrl,
      splitDigitCropDataUrls,
      tableCropDataUrl: index === 0 ? tableCropDataUrl : undefined,
      debugRawOcr: {
        written: writtenResult.rawText,
        split: splitResult.rawText,
        splitZones: splitResult.zoneRawText,
      },
      debugCropImages: {
        written: writtenCropDataUrl,
        split: splitCropDataUrl,
        splitZones: splitDigitCropDataUrls,
      },
      statusReason: extracted.reason,
      status: "PARSED",
      validationErrors: [],
      operatorCorrection: "",
    });
  }

  const validatedRows = validateScanRows(rawRows, context, roster);
  const countByStatus = validatedRows.reduce<Record<string, number>>((acc, row) => {
    acc[row.status] = (acc[row.status] ?? 0) + 1;
    return acc;
  }, {});

  const parts: string[] = [];
  if (countByStatus["VALID"]) parts.push(`${countByStatus["VALID"]} valid`);
  if (countByStatus["NEEDS_REVIEW"]) parts.push(`${countByStatus["NEEDS_REVIEW"]} need review`);
  if (countByStatus["MISSING"]) parts.push(`${countByStatus["MISSING"]} missing`);
  if (countByStatus["INVALID"]) parts.push(`${countByStatus["INVALID"]} invalid`);

  return {
    parseStatus: "PARSED",
    message:
      `Scan processed. Review suggested marks before validation. ` +
      `Extracted ${roster.length} roster rows: ${parts.join(", ") || "all blank (no marks visible)"}.`,
    rows: validatedRows,
    studentCount: roster.length,
  };
}
