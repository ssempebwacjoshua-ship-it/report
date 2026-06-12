import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  extractMarksheetIdCandidatesFromOcrText,
  saveMarksheetIdLookupDebug,
  type MarksheetIdDetectionResult,
} from "../../server/services/marksheetIdDetectionService";
import { findSheetNumberInText } from "../../server/services/marksheetContextService";

describe("marksheetIdDetectionService — sheet number OCR", () => {
  it("extracts SHEET NO from header OCR text", () => {
    const text = "UGHS SCHOOL\nACADEMIC MARKSHEET\nSHEET NO: 20260611-042\nAcademic Year: 2025/2026";
    expect(findSheetNumberInText(text)).toBe("20260611-042");
  });

  it("extracts SHEET NO when OCR reads zero as O", () => {
    const text = "SHEET N0 20260611-007";
    expect(findSheetNumberInText(text)).toBe("20260611-007");
  });

  it("returns null when no SHEET NO present in scan text", () => {
    expect(findSheetNumberInText("ACADEMIC MARKSHEET MS-2026-SEN1-A-MATH-EOT-TE")).toBeNull();
  });
});

describe("marksheetIdDetectionService", () => {
  it("extracts Marksheet ID from header OCR text", () => {
    const candidates = extractMarksheetIdCandidatesFromOcrText(
      "Marksheet ID: MS-2026-SENI-A-MATH-EOT-TE Generated: today",
      "header",
      0.91,
    );

    expect(candidates[0]).toMatchObject({
      source: "header",
      normalizedRecognizedId: "MS-2026-SEN1-A-MATH-EOT-TE",
    });
  });

  it("extracts Marksheet ID from footer OCR text", () => {
    const candidates = extractMarksheetIdCandidatesFromOcrText(
      "Valid entries 0-100  MS 2026 SENI A MATH EOT TE  12 June 2026",
      "footer",
      0.88,
    );

    expect(candidates[0]).toMatchObject({
      source: "footer",
      normalizedRecognizedId: "MS-2026-SEN1-A-MATH-EOT-TE",
    });
  });

  it("writes debug JSON with raw and normalized values", async () => {
    const result: MarksheetIdDetectionResult = {
      rawHeaderText: "Marksheet ID: MS-2026-SENI-A-MATH-EOT-TE SHEET NO: 20260611-042",
      rawFooterText: "",
      candidates: [{
        source: "header",
        rawRecognizedId: "MS-2026-SENI-A-MATH-EOT-TE",
        normalizedRecognizedId: "MS-2026-SEN1-A-MATH-EOT-TE",
        confidence: 0.92,
        method: "ocr",
      }],
      selectedCandidate: {
        source: "header",
        rawRecognizedId: "MS-2026-SENI-A-MATH-EOT-TE",
        normalizedRecognizedId: "MS-2026-SEN1-A-MATH-EOT-TE",
        confidence: 0.92,
        method: "ocr",
      },
      rawRecognizedId: "MS-2026-SENI-A-MATH-EOT-TE",
      normalizedRecognizedId: "MS-2026-SEN1-A-MATH-EOT-TE",
      recognizedSheetNumber: "20260611-042",
      confidence: 0.92,
      matchSource: "header",
      failureReason: "",
      debug: {
        headerCropPath: "tmp/ocr-debug/latest/marksheet-id-header-crop.jpg",
        footerCropPath: "tmp/ocr-debug/latest/marksheet-id-footer-crop.jpg",
        debugJsonPath: "tmp/ocr-debug/latest/marksheet-id-detection.json",
      },
    };

    await saveMarksheetIdLookupDebug(result, {
      contextSource: "recognized-id",
      matchedMarksheetId: "MS-2026-SEN1-A-MATH-EOT-TE",
      resolved: true,
      warning: "",
    });

    const debugPath = path.join(process.cwd(), "tmp", "ocr-debug", "latest", "marksheet-id-detection.json");
    const debug = JSON.parse(await fs.readFile(debugPath, "utf8")) as {
      rawOcrHeaderText: string;
      normalizedCandidates: string[];
      selectedCandidate: { normalizedRecognizedId: string };
      recognizedSheetNumber: string;
      recognizedInternalMarksheetId: string;
      matchedMarksheet: string;
      contextSource: string;
      lookupResult: { matchedMarksheetId: string };
    };

    expect(debug.rawOcrHeaderText).toContain("SENI");
    expect(debug.normalizedCandidates).toContain("MS-2026-SEN1-A-MATH-EOT-TE");
    expect(debug.selectedCandidate.normalizedRecognizedId).toBe("MS-2026-SEN1-A-MATH-EOT-TE");
    expect(debug.recognizedSheetNumber).toBe("20260611-042");
    expect(debug.recognizedInternalMarksheetId).toBe("MS-2026-SEN1-A-MATH-EOT-TE");
    expect(debug.matchedMarksheet).toBe("MS-2026-SEN1-A-MATH-EOT-TE");
    expect(debug.contextSource).toBe("recognized-id");
    expect(debug.lookupResult.matchedMarksheetId).toBe("MS-2026-SEN1-A-MATH-EOT-TE");
  });
});
