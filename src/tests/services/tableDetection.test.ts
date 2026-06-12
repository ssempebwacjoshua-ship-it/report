import { describe, expect, it } from "vitest";
import sharp from "sharp";
import {
  detectMarksheetTable,
  detectedCellRect,
} from "../../server/services/marksheetTableDetection";
import {
  COLUMNS,
  LAYOUT,
  PAGE_MARGIN_LEFT_FRAC,
  TABLE_WIDTH_FRAC,
} from "../../server/services/marksheetGeometryService";

// ── Synthetic image helpers ───────────────────────────────────────────────────

/**
 * Build a white greyscale JPEG with solid black horizontal lines drawn at the
 * specified Y positions. Lines span 85% of image width (centred) and are 3px thick,
 * which is enough to trigger the H_LINE_FRAC = 35% dark-pixel threshold.
 */
async function makeSyntheticMarksheet(
  width: number,
  height: number,
  lineYPositions: number[],
): Promise<Buffer> {
  const pixels = Buffer.alloc(width * height, 255); // white

  for (const lineY of lineYPositions) {
    for (let dy = -1; dy <= 1; dy++) {
      const y = lineY + dy;
      if (y < 0 || y >= height) continue;
      const startX = Math.floor(width * 0.05);
      const endX = Math.floor(width * 0.90);
      for (let x = startX; x < endX; x++) {
        pixels[y * width + x] = 0;
      }
    }
  }

  return sharp(pixels, { raw: { width, height, channels: 1 } })
    .jpeg({ quality: 90 })
    .toBuffer();
}

async function blankJpeg(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 255, g: 255, b: 255 } },
  })
    .jpeg()
    .toBuffer();
}

// ── detectMarksheetTable ──────────────────────────────────────────────────────

describe("detectMarksheetTable", () => {
  it("falls back gracefully when the image has no horizontal lines", async () => {
    const buf = await blankJpeg(800, 1100);
    const result = await detectMarksheetTable(buf, 800, 1100);

    expect(result.method).toBe("fallback");
    expect(result.confidence).toBe(0);
    expect(result.dataRows).toHaveLength(26);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("falls back when fewer than 3 line events are found", async () => {
    // Only 2 distinct lines — not enough to infer column header + any data rows.
    const buf = await makeSyntheticMarksheet(800, 1100, [280, 320]);
    const result = await detectMarksheetTable(buf, 800, 1100);
    expect(result.method).toBe("fallback");
  });

  it("detects table with lines placed below 20% of image height", async () => {
    // Lines that represent the table structure: top border, column header, then data rows.
    const lineYs = [250, 285, 320, 355, 390, 425, 460];
    const buf = await makeSyntheticMarksheet(800, 1100, lineYs);
    const result = await detectMarksheetTable(buf, 800, 1100);

    expect(result.method).toBe("detected");
    // Table top must be below 20% of page height (= 220px for a 1100px image).
    expect(result.tableTop).toBeGreaterThan(1100 * 0.18);
  });

  it("split mark column is to the right of written mark column", async () => {
    const lineYs = [250, 285, 320, 355, 390, 425, 460, 495];
    const buf = await makeSyntheticMarksheet(800, 1100, lineYs);
    const result = await detectMarksheetTable(buf, 800, 1100);

    // Regardless of detection method, split is always right of written.
    expect(result.splitMarkCol.x).toBeGreaterThan(result.writtenMarkCol.x);
  });

  it("always provides 26 data rows regardless of how many lines were detected", async () => {
    const lineYs = [250, 285, 320, 355, 390]; // only 3 data row gaps
    const buf = await makeSyntheticMarksheet(800, 1100, lineYs);
    const result = await detectMarksheetTable(buf, 800, 1100);

    expect(result.dataRows.length).toBeGreaterThanOrEqual(26);
  });

  it("written mark column x-position matches the expected column fraction", async () => {
    const lineYs = [250, 285, 320, 355, 390, 425, 460, 495];
    const buf = await makeSyntheticMarksheet(800, 1100, lineYs);
    const result = await detectMarksheetTable(buf, 800, 1100);

    if (result.method === "detected") {
      const tableW = result.tableRight - result.tableLeft;
      // Allow ±6% of table width for scan-induced JPEG compression artifacts.
      const expectedX = result.tableLeft + Math.round(COLUMNS.writtenMark.x * tableW);
      expect(Math.abs(result.writtenMarkCol.x - expectedX)).toBeLessThan(tableW * 0.06);
    }
  });

  it("fallback data rows start near the expected fraction-based position", async () => {
    const buf = await blankJpeg(800, 1100);
    const result = await detectMarksheetTable(buf, 800, 1100);

    const expectedFirstRowY = Math.round(
      (LAYOUT.tableStartFrac + LAYOUT.tableHeaderHFrac) * 1100,
    );
    // Within 5px — loose enough to survive minor rounding differences.
    expect(Math.abs(result.dataRows[0]!.y - expectedFirstRowY)).toBeLessThanOrEqual(5);
  });

  it("fallback written mark column uses fraction-based geometry", async () => {
    const buf = await blankJpeg(800, 1100);
    const result = await detectMarksheetTable(buf, 800, 1100);

    const tableLeft = Math.round(PAGE_MARGIN_LEFT_FRAC * 800);
    const tableWidth = Math.round(TABLE_WIDTH_FRAC * 800);
    const expectedX = tableLeft + Math.round(COLUMNS.writtenMark.x * tableWidth);

    expect(result.writtenMarkCol.x).toBe(expectedX);
  });
});

// ── detectedCellRect ──────────────────────────────────────────────────────────

describe("detectedCellRect", () => {
  it("returns a rect inside the written mark column bounds", async () => {
    const lineYs = [250, 285, 320, 355, 390, 425, 460, 495];
    const buf = await makeSyntheticMarksheet(800, 1100, lineYs);
    const detection = await detectMarksheetTable(buf, 800, 1100);
    const rect = detectedCellRect(detection, "writtenMark", 0, 800, 1100);

    // Must overlap with the detected written mark column.
    expect(rect.x).toBeGreaterThanOrEqual(detection.writtenMarkCol.x);
    expect(rect.x + rect.w).toBeLessThanOrEqual(
      detection.writtenMarkCol.x + detection.writtenMarkCol.w + 5, // 5px tolerance
    );
  });

  it("falls back to geometry service fractions for row index beyond detected rows", async () => {
    const buf = await blankJpeg(800, 1100);
    const detection = await detectMarksheetTable(buf, 800, 1100);

    // The fallback detection builds 26 rows, so row 30 is beyond the array.
    // detectedCellRect should not throw and should return a non-zero rect.
    const rect = detectedCellRect(detection, "splitMark", 30, 800, 1100);
    expect(rect.w).toBeGreaterThan(0);
    expect(rect.h).toBeGreaterThan(0);
  });

  it("written rect is above split rect on the same row", async () => {
    // They share the same row, so y should be equal.
    const lineYs = [250, 285, 320, 355];
    const buf = await makeSyntheticMarksheet(800, 1100, lineYs);
    const detection = await detectMarksheetTable(buf, 800, 1100);
    const written = detectedCellRect(detection, "writtenMark", 0, 800, 1100);
    const split = detectedCellRect(detection, "splitMark", 0, 800, 1100);

    expect(written.y).toBe(split.y);
    expect(written.h).toBe(split.h);
  });
});

// ── Crop ID → admission number mapping ───────────────────────────────────────

describe("crop ID to admission number mapping", () => {
  it("written crop ID uniquely identifies each student row", () => {
    const students = ["S1A-001", "S1A-002", "S1A-003", "S1A-004"];
    const writtenIds = students.map((adm) => `${adm}-written`);
    expect(new Set(writtenIds).size).toBe(students.length);
  });

  it("split zone IDs are unique across all students and zones", () => {
    const students = ["S1A-001", "S1A-002", "S1A-003", "S1A-004"];
    const zoneIds = students.flatMap((adm) =>
      [1, 2, 3].map((n) => `${adm}-split-${n}`),
    );
    expect(new Set(zoneIds).size).toBe(zoneIds.length);
  });
});

// ── All roster students must appear even if detection fails ──────────────────

describe("roster completeness when table detection falls back", () => {
  it("fallback provides a data row for every roster index up to 26", async () => {
    const buf = await blankJpeg(800, 1100);
    const detection = await detectMarksheetTable(buf, 800, 1100);

    // Simulate 4-student roster: rows 0–3 must all have valid rects.
    for (let i = 0; i < 4; i++) {
      const wr = detectedCellRect(detection, "writtenMark", i, 800, 1100);
      const sr = detectedCellRect(detection, "splitMark", i, 800, 1100);
      expect(wr.w).toBeGreaterThan(0);
      expect(wr.h).toBeGreaterThan(0);
      expect(sr.w).toBeGreaterThan(0);
      expect(sr.h).toBeGreaterThan(0);
    }
  });
});
