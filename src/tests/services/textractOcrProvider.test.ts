import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createTextractOcrProvider,
  detectCropText,
  normalizeTextractResponse,
  textractRegion,
  type TextractDetectFn,
} from "../../server/services/textractOcrProvider";
import { resolveOcrProviderWithMeta } from "../../server/services/ocrProvider";
import { parseSplitZoneTexts } from "../../server/services/markRecognitionService";
import { validateScanRows, type KnownStudent } from "../../server/services/scanImportValidator";
import type { ScanImportRow, ScanMarksheetContext } from "../../shared/types/imports";

const originalProvider = process.env.OCR_PROVIDER;
const originalRegion = process.env.AWS_REGION;
const originalKeyId = process.env.AWS_ACCESS_KEY_ID;
const originalSecret = process.env.AWS_SECRET_ACCESS_KEY;
const originalGoogleCreds = process.env.GOOGLE_APPLICATION_CREDENTIALS;

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

afterEach(() => {
  restoreEnv("OCR_PROVIDER", originalProvider);
  restoreEnv("AWS_REGION", originalRegion);
  restoreEnv("AWS_ACCESS_KEY_ID", originalKeyId);
  restoreEnv("AWS_SECRET_ACCESS_KEY", originalSecret);
  restoreEnv("GOOGLE_APPLICATION_CREDENTIALS", originalGoogleCreds);
  vi.restoreAllMocks();
});

// ── Provider selection ────────────────────────────────────────────────────────

describe("Textract provider selection", () => {
  it("selects textract when OCR_PROVIDER=textract and credentials exist", async () => {
    process.env.OCR_PROVIDER = "textract";
    process.env.AWS_REGION = "eu-west-1";
    process.env.AWS_ACCESS_KEY_ID = "AKIA_TEST";
    process.env.AWS_SECRET_ACCESS_KEY = "secret_test";

    const resolution = await resolveOcrProviderWithMeta();

    expect(resolution.configuredProvider).toBe("textract");
    expect(resolution.activeProvider).toBe("textract");
    expect(resolution.providerReachable).toBe(true);
    expect(resolution.providerUrl).toBe("https://textract.eu-west-1.amazonaws.com");
    expect(resolution.fallbackReason).toBe("");
  });

  it("falls back to manual with a clear reason when AWS credentials are missing", async () => {
    process.env.OCR_PROVIDER = "textract";
    delete process.env.AWS_ACCESS_KEY_ID;
    delete process.env.AWS_SECRET_ACCESS_KEY;

    const resolution = await resolveOcrProviderWithMeta();

    expect(resolution.configuredProvider).toBe("textract");
    expect(resolution.activeProvider).toBe("manual");
    expect(resolution.fallbackReason).toBe("AWS Textract credentials missing. Manual entry mode.");
  });

  it("defaults the region to eu-west-1 when AWS_REGION is unset", () => {
    delete process.env.AWS_REGION;
    expect(textractRegion()).toBe("eu-west-1");
  });
});

// ── Response normalization ────────────────────────────────────────────────────

describe("Textract response normalization", () => {
  it("maps a DetectDocumentText response to the shared crop result shape", async () => {
    const fakeDetect: TextractDetectFn = async () => ({
      Blocks: [
        { BlockType: "PAGE" },
        { BlockType: "LINE", Text: "7", Confidence: 96.4 },
        { BlockType: "WORD", Text: "7", Confidence: 96.4 },
      ],
    });

    const provider = createTextractOcrProvider({ detectText: fakeDetect });
    const results = await provider.recognizeCrops([
      { cropId: "row-01-S1A-001-split-1-final", buffer: Buffer.from("img") },
    ]);

    expect(results).toEqual([
      { cropId: "row-01-S1A-001-split-1-final", text: "7", confidence: 0.964 },
    ]);
  });

  it("normalizes Textract 0-100 confidence to 0-1", () => {
    const annotation = normalizeTextractResponse({
      Blocks: [
        { BlockType: "LINE", Text: "76", Confidence: 88 },
        { BlockType: "LINE", Text: "", Confidence: 50 }, // blank line ignored
      ],
    });

    expect(annotation.text).toBe("76");
    expect(annotation.confidence).toBeCloseTo(0.88, 5);
    expect(annotation.confidenceSource).toBe("textract");
  });

  it("applies a default confidence when lines carry no confidence", () => {
    const annotation = normalizeTextractResponse({
      Blocks: [{ BlockType: "LINE", Text: "82" }],
    });

    expect(annotation.text).toBe("82");
    expect(annotation.confidence).toBeGreaterThan(0.5);
    expect(annotation.confidenceSource).toBe("textract/no-confidence");
  });

  it("returns blank text for an empty crop (no LINE blocks)", () => {
    const annotation = normalizeTextractResponse({ Blocks: [{ BlockType: "PAGE" }] });

    expect(annotation.text).toBe("");
    expect(annotation.confidence).toBe(0);
  });

  it("returns empty results for every crop when the API call throws", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const failingDetect: TextractDetectFn = async () => {
      throw new Error("UnrecognizedClientException: The security token is invalid");
    };

    const provider = createTextractOcrProvider({ detectText: failingDetect });
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

  it("detectCropText surfaces credential/API errors instead of throwing", async () => {
    const failingDetect: TextractDetectFn = async () => {
      throw new Error("Could not load credentials from any providers");
    };

    const annotation = await detectCropText(Buffer.from("img"), failingDetect);

    expect(annotation.text).toBe("");
    expect(annotation.error).toContain("credentials");
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

describe("Textract results in the existing parser/operator workflow", () => {
  it("combines Textract split-zone texts into a valid mark (blank third zone ok)", () => {
    expect(parseSplitZoneTexts(["7", "6", ""])).toBe("76");
    expect(parseSplitZoneTexts(["8", "2", ""])).toBe("82");
    expect(parseSplitZoneTexts(["9", "4", ""])).toBe("94");
    expect(parseSplitZoneTexts(["2", "6", ""])).toBe("26");
  });

  it("sends disagreement between written and split marks to Needs Review", () => {
    const [result] = validateScanRows(
      [row({ writtenMark: "94", splitMark: "44", extractedMark: undefined as unknown as string })],
      context,
      roster,
    );

    expect(result.status).toBe("NEEDS_REVIEW");
  });

  it("operator correction overrides the Textract suggestion", () => {
    const [result] = validateScanRows(
      [row({ writtenMark: "26", splitMark: "26", extractedMark: "26", operatorCorrection: "62" })],
      context,
      roster,
    );

    expect(result.status).toBe("VALID");
    expect(result.statusReason).toBe("Operator mark accepted.");
    expect(result.operatorCorrection).toBe("62");
  });

  it("OCR suggestion alone never auto-fills the operator mark (no auto-commit)", () => {
    const [result] = validateScanRows(
      [row({ writtenMark: "26", splitMark: "26", extractedMark: "26" })],
      context,
      roster,
    );

    expect(result.extractedMark).toBe("26");
    expect(result.operatorCorrection).toBe("");
  });
});
