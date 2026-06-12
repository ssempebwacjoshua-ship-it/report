import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  extractMarksheetIdCandidatesFromOcrText,
  saveMarksheetIdLookupDebug,
  type MarksheetIdDetectionResult,
} from "../../server/services/marksheetIdDetectionService";

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
      rawHeaderText: "Marksheet ID: MS-2026-SENI-A-MATH-EOT-TE",
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
      lookupResult: { matchedMarksheetId: string };
    };

    expect(debug.rawOcrHeaderText).toContain("SENI");
    expect(debug.normalizedCandidates).toContain("MS-2026-SEN1-A-MATH-EOT-TE");
    expect(debug.selectedCandidate.normalizedRecognizedId).toBe("MS-2026-SEN1-A-MATH-EOT-TE");
    expect(debug.lookupResult.matchedMarksheetId).toBe("MS-2026-SEN1-A-MATH-EOT-TE");
  });
});
