import { describe, expect, it } from "vitest";
import {
  validateMarksheetRows,
  type GeminiExtractedMarkRow,
} from "../../server/services/geminiOcrService";

function makeRow(
  mark: string,
  overrides: Partial<GeminiExtractedMarkRow> = {},
): GeminiExtractedMarkRow {
  return {
    studentId: "SC2026-0001",
    studentName: "Test Student",
    mark,
    confidenceScore: 1,
    needsReview: false,
    ...overrides,
  };
}

describe("validateMarksheetRows — mark field validation", () => {
  it("empty mark forces needsReview true with reason 'Missing mark'", () => {
    const { rows } = validateMarksheetRows([makeRow("")]);
    expect(rows[0]!.needsReview).toBe(true);
    expect(rows[0]!.reason).toBe("Missing mark");
  });

  it("whitespace-only mark is treated as empty", () => {
    const { rows } = validateMarksheetRows([makeRow("   ")]);
    expect(rows[0]!.needsReview).toBe(true);
    expect(rows[0]!.reason).toBe("Missing mark");
  });

  it("non-numeric mark forces needsReview true with reason 'Invalid mark'", () => {
    const { rows } = validateMarksheetRows([makeRow("FortyFive")]);
    expect(rows[0]!.needsReview).toBe(true);
    expect(rows[0]!.reason).toBe("Invalid mark");
  });

  it("mark 101 forces needsReview true with reason 'Mark outside valid range'", () => {
    const { rows } = validateMarksheetRows([makeRow("101")]);
    expect(rows[0]!.needsReview).toBe(true);
    expect(rows[0]!.reason).toBe("Mark outside valid range");
  });

  it("mark -1 forces needsReview true with reason 'Mark outside valid range'", () => {
    const { rows } = validateMarksheetRows([makeRow("-1")]);
    expect(rows[0]!.needsReview).toBe(true);
    expect(rows[0]!.reason).toBe("Mark outside valid range");
  });

  it("mark 0 is valid (boundary)", () => {
    const { rows } = validateMarksheetRows([makeRow("0")]);
    expect(rows[0]!.needsReview).toBe(false);
  });

  it("mark 100 is valid (boundary)", () => {
    const { rows } = validateMarksheetRows([makeRow("100")]);
    expect(rows[0]!.needsReview).toBe(false);
  });

  it("mark 30 stays valid with no modification", () => {
    const { rows } = validateMarksheetRows([makeRow("30")]);
    expect(rows[0]!.needsReview).toBe(false);
    expect(rows[0]!.mark).toBe("30");
    expect(rows[0]!.confidenceScore).toBe(1);
  });

  it("overrides confidenceScore to 0 when mark is invalid", () => {
    const { rows } = validateMarksheetRows([makeRow("", { confidenceScore: 1, needsReview: false })]);
    expect(rows[0]!.confidenceScore).toBe(0);
  });

  it("trims surrounding whitespace from mark before checking", () => {
    const { rows } = validateMarksheetRows([makeRow("  30  ")]);
    expect(rows[0]!.needsReview).toBe(false);
    expect(rows[0]!.mark).toBe("30");
  });

  it("preserves Gemini needsReview and reason when mark is valid but Gemini flagged another issue", () => {
    const { rows } = validateMarksheetRows([
      makeRow("45", { needsReview: true, reason: "Name unclear", confidenceScore: 0.4 }),
    ]);
    expect(rows[0]!.needsReview).toBe(true);
    expect(rows[0]!.reason).toBe("Name unclear");
    expect(rows[0]!.confidenceScore).toBe(0.4);
  });
});

describe("validateMarksheetRows — summary totals", () => {
  it("counts totalRows correctly", () => {
    const { summary } = validateMarksheetRows([makeRow("30"), makeRow("45"), makeRow("")]);
    expect(summary.totalRows).toBe(3);
  });

  it("counts missingMarkRows for empty marks only", () => {
    const { summary } = validateMarksheetRows([makeRow("30"), makeRow(""), makeRow("")]);
    expect(summary.missingMarkRows).toBe(2);
  });

  it("counts invalidMarkRows for non-numeric and out-of-range marks", () => {
    const { summary } = validateMarksheetRows([
      makeRow("FortyFive"),
      makeRow("101"),
      makeRow("30"),
    ]);
    expect(summary.invalidMarkRows).toBe(2);
  });

  it("counts reviewRows as all rows where needsReview is true (our flags + Gemini flags)", () => {
    const { summary } = validateMarksheetRows([
      makeRow("30"),
      makeRow(""),
      makeRow("45", { needsReview: true, reason: "Name unclear" }),
    ]);
    expect(summary.reviewRows).toBe(2);
    expect(summary.validRows).toBe(1);
  });

  it("returns validRows + reviewRows === totalRows", () => {
    const rows = [makeRow("30"), makeRow(""), makeRow("FortyFive"), makeRow("101"), makeRow("0")];
    const { summary } = validateMarksheetRows(rows);
    expect(summary.validRows + summary.reviewRows).toBe(summary.totalRows);
  });
});
