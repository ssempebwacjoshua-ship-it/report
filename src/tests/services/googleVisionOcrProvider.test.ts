import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  annotateCropBuffer,
  createGoogleVisionOcrProvider,
  normalizeVisionResponse,
  type VisionBatchFn,
} from "../../server/services/googleVisionOcrProvider";
import { resolveOcrProviderWithMeta } from "../../server/services/ocrProvider";
import { parseSplitZoneTexts } from "../../server/services/markRecognitionService";
import { validateScanRows, type KnownStudent } from "../../server/services/scanImportValidator";
import type { ScanImportRow, ScanMarksheetContext } from "../../shared/types/imports";

const originalProvider = process.env.OCR_PROVIDER;
const originalCreds = process.env.GOOGLE_APPLICATION_CREDENTIALS;
const originalFeature = process.env.GOOGLE_VISION_FEATURE;

let tempDir: string | null = null;

function makeFakeCredsFile(): string {
  tempDir = mkdtempSync(join(tmpdir(), "gv-creds-"));
  const file = join(tempDir, "service-account.json");
  writeFileSync(file, JSON.stringify({ type: "service_account", project_id: "test" }));
  return file;
}

afterEach(() => {
  process.env.OCR_PROVIDER = originalProvider;
  if (originalCreds === undefined) delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
  else process.env.GOOGLE_APPLICATION_CREDENTIALS = originalCreds;
  if (originalFeature === undefined) delete process.env.GOOGLE_VISION_FEATURE;
  else process.env.GOOGLE_VISION_FEATURE = originalFeature;
  if (tempDir) {
    rmSync(tempDir, { recursive: true, force: true });
    tempDir = null;
  }
  vi.restoreAllMocks();
});

// ── Provider selection ────────────────────────────────────────────────────────

describe("Google Vision provider selection", () => {
  it("selects googlevision when OCR_PROVIDER=googlevision and credentials exist", async () => {
    process.env.OCR_PROVIDER = "googlevision";
    process.env.GOOGLE_APPLICATION_CREDENTIALS = makeFakeCredsFile();

    const resolution = await resolveOcrProviderWithMeta();

    expect(resolution.configuredProvider).toBe("googlevision");
    expect(resolution.activeProvider).toBe("googlevision");
    expect(resolution.providerReachable).toBe(true);
    expect(resolution.fallbackReason).toBe("");
  });

  it("falls back to manual with a clear reason when credentials are missing", async () => {
    process.env.OCR_PROVIDER = "googlevision";
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS;

    const resolution = await resolveOcrProviderWithMeta();

    expect(resolution.configuredProvider).toBe("googlevision");
    expect(resolution.activeProvider).toBe("manual");
    expect(resolution.fallbackReason).toBe("Google Vision credentials missing. Manual entry mode.");
  });

  it("falls back to manual when the credentials file does not exist", async () => {
    process.env.OCR_PROVIDER = "googlevision";
    process.env.GOOGLE_APPLICATION_CREDENTIALS = "C:\\does\\not\\exist\\sa.json";

    const resolution = await resolveOcrProviderWithMeta();

    expect(resolution.activeProvider).toBe("manual");
    expect(resolution.fallbackReason).toContain("credentials missing");
  });
});

// ── Response normalization ────────────────────────────────────────────────────

describe("Google Vision response normalization", () => {
  it("maps a DOCUMENT_TEXT_DETECTION response to the shared crop result shape", async () => {
    const fakeBatch: VisionBatchFn = async () => [
      {
        fullTextAnnotation: {
          text: "7\n",
          pages: [
            {
              blocks: [
                { paragraphs: [{ words: [{ confidence: 0.92 }] }] },
              ],
            },
          ],
        },
      },
    ];

    const provider = createGoogleVisionOcrProvider({ batchAnnotate: fakeBatch });
    const results = await provider.recognizeCrops([
      { cropId: "row-01-S1A-001-split-1-final", buffer: Buffer.from("img") },
    ]);

    expect(results).toEqual([
      { cropId: "row-01-S1A-001-split-1-final", text: "7", confidence: 0.92 },
    ]);
  });

  it("applies a default confidence when the API returns none", () => {
    const annotation = normalizeVisionResponse({ fullTextAnnotation: { text: "76\n" } });

    expect(annotation.text).toBe("76");
    expect(annotation.confidence).toBeGreaterThan(0.5);
    expect(annotation.confidenceSource).toBe("googlevision/no-confidence");
  });

  it("uses textAnnotations when fullTextAnnotation is absent", () => {
    const annotation = normalizeVisionResponse({
      textAnnotations: [{ description: "82\n" }],
    });

    expect(annotation.text).toBe("82");
  });

  it("returns a safe error annotation when the API reports a per-image error", () => {
    const annotation = normalizeVisionResponse({
      error: { message: "Permission denied on project" },
    });

    expect(annotation.text).toBe("");
    expect(annotation.confidence).toBe(0);
    expect(annotation.error).toContain("Permission denied");
  });

  it("returns empty results for every crop when the batch call throws", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const failingBatch: VisionBatchFn = async () => {
      throw new Error("UNAVAILABLE: network unreachable");
    };

    const provider = createGoogleVisionOcrProvider({ batchAnnotate: failingBatch });
    const results = await provider.recognizeCrops([
      { cropId: "S1A-001-written", buffer: Buffer.from("a") },
      { cropId: "S1A-001-split-1", buffer: Buffer.from("b") },
    ]);

    expect(results).toHaveLength(2);
    for (const result of results) {
      expect(result.text).toBe("");
      expect(result.confidence).toBe(0);
    }
    expect(consoleSpy).toHaveBeenCalled();
  });

  it("annotateCropBuffer surfaces credential/API errors instead of throwing", async () => {
    const failingBatch: VisionBatchFn = async () => {
      throw new Error("Could not load the default credentials");
    };

    const annotation = await annotateCropBuffer(Buffer.from("img"), failingBatch);

    expect(annotation.text).toBe("");
    expect(annotation.error).toContain("default credentials");
  });
});

// ── Split zones + operator workflow (parser rules unchanged) ─────────────────

const context: ScanMarksheetContext = {
  marksheetId: "MS-2026-S1A-A-MATH-BOT-T1",
  className: "Senior 1 A",
  streamName: "A",
  subjectName: "Mathematics",
  termName: "Term 1",
  examType: "BOT",
  academicYear: "2026",
};

const roster: KnownStudent[] = [{ admissionNumber: "S1A-001" }];

function row(overrides: Partial<ScanImportRow>): ScanImportRow {
  return {
    rowNumber: 1,
    admissionNumber: "S1A-001",
    studentName: "Kampala Ssempebwa",
    writtenMark: "",
    splitMark: "",
    extractedMark: "",
    suggestedMark: "",
    confidence: 0.9,
    remarks: "",
    status: "PARSED",
    validationErrors: [],
    operatorCorrection: "",
    ...overrides,
  };
}

describe("Google Vision results in the existing parser/operator workflow", () => {
  it("combines Google split-zone texts into a valid mark (blank third zone ok)", () => {
    // Vision often appends newlines per crop — zones are normalized upstream
    expect(parseSplitZoneTexts(["7", "6", ""])).toBe("76");
    expect(parseSplitZoneTexts(["8", "2", ""])).toBe("82");
    expect(parseSplitZoneTexts(["9", "4", ""])).toBe("94");
    expect(parseSplitZoneTexts(["2", "6", ""])).toBe("26");
  });

  it("sends disagreement between written and split marks to Needs Review", () => {
    const [result] = validateScanRows(
      [row({ writtenMark: "76", splitMark: "16", extractedMark: undefined as unknown as string })],
      context,
      roster,
    );

    expect(result.status).toBe("NEEDS_REVIEW");
  });

  it("operator correction overrides the Google suggestion", () => {
    const [result] = validateScanRows(
      [row({ writtenMark: "76", splitMark: "76", extractedMark: "76", operatorCorrection: "82" })],
      context,
      roster,
    );

    expect(result.status).toBe("VALID");
    expect(result.statusReason).toBe("Operator mark accepted.");
    expect(result.operatorCorrection).toBe("82");
  });

  it("OCR suggestion alone never auto-fills the operator mark (no auto-commit)", () => {
    const [result] = validateScanRows(
      [row({ writtenMark: "76", splitMark: "76", extractedMark: "76" })],
      context,
      roster,
    );

    // Suggestion is surfaced, but the operator field remains untouched —
    // commit endpoints act on operator-resolved rows only.
    expect(result.extractedMark).toBe("76");
    expect(result.operatorCorrection).toBe("");
  });
});
