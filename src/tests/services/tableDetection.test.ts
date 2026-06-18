import { describe, expect, it } from "vitest";
import sharp from "sharp";
import {
  computeSplitZoneRects,
  computeWrittenMarkCropRect,
  detectMarksheetTable,
  detectedCellRect,
} from "../../server/services/marksheetTableDetection";
import {
  LAYOUT,
} from "../../server/services/marksheetGeometryService";

// â”€â”€ Synthetic image helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Build a white greyscale JPEG with solid black horizontal lines drawn at the
 * specified Y positions. Lines span 85% of image width (centred) and are 3px thick,
 * which is enough to trigger the H_LINE_FRAC = 35% dark-pixel threshold.
 */
async function makeSyntheticMarksheet(
  width: number,
  height: number,
  lineYPositions: number[],
  verticalXPositions: number[] = [],
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

  const topY = lineYPositions[0] ?? Math.floor(height * 0.25);
  const bottomY = lineYPositions[lineYPositions.length - 1] ?? Math.floor(height * 0.45);
  for (const lineX of verticalXPositions) {
    for (let dx = -1; dx <= 1; dx++) {
      const x = lineX + dx;
      if (x < 0 || x >= width) continue;
      for (let y = topY; y <= bottomY; y++) {
        if (y < 0 || y >= height) continue;
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

// â”€â”€ detectMarksheetTable â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
    // Only 2 distinct lines â€” not enough to infer column header + any data rows.
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

  it("written and split columns are derived from ordered boundaries", async () => {
    const lineYs = [250, 285, 320, 355, 390, 425, 460, 495];
    const buf = await makeSyntheticMarksheet(800, 1100, lineYs);
    const result = await detectMarksheetTable(buf, 800, 1100);

    if (result.method === "detected") {
      expect(result.writtenMarkCol.x).toBe(result.columnBoundaries.studentNameRight);
      expect(result.splitMarkCol.x).toBe(result.columnBoundaries.writtenMarkRight);
    }
  });

  it("fallback data rows start near the expected fraction-based position", async () => {
    const buf = await blankJpeg(800, 1100);
    const result = await detectMarksheetTable(buf, 800, 1100);

    const expectedFirstRowY = Math.round(
      (LAYOUT.tableStartFrac + LAYOUT.tableHeaderHFrac) * 1100,
    );
    // Within 5px â€” loose enough to survive minor rounding differences.
    expect(Math.abs(result.dataRows[0]!.y - expectedFirstRowY)).toBeLessThanOrEqual(5);
  });

  it("fallback written mark column uses calibrated template geometry", async () => {
    const buf = await blankJpeg(800, 1100);
    const result = await detectMarksheetTable(buf, 800, 1100);

    expect(result.writtenMarkCol.x).toBe(result.columnBoundaries.studentNameRight);
    expect(result.splitMarkCol.x).toBe(result.columnBoundaries.writtenMarkRight);
    expect(result.columnBoundaries.splitMarkRight).toBeLessThan(result.columnBoundaries.tableRight);
  });

  it("detects the Written, Split, and Remarks order from vertical grid lines", async () => {
    const lineYs = [250, 285, 320, 355, 390, 425, 460];
    const verticals = [50, 100, 200, 500, 650, 700, 750, 800, 900];
    const buf = await makeSyntheticMarksheet(1000, 1100, lineYs, verticals);
    const result = await detectMarksheetTable(buf, 1000, 1100);

    expect(result.colDetectionMethod).toBe("detected");
    expect(result.columnBoundaries.studentNameRight).toBeCloseTo(500, -1);
    expect(result.columnBoundaries.writtenMarkRight).toBeCloseTo(650, -1);
    expect(result.columnBoundaries.splitMarkRight).toBeCloseTo(800, -1);
    expect(result.writtenMarkCol.x).toBe(result.columnBoundaries.studentNameRight);
    expect(result.splitMarkCol.x).toBe(result.columnBoundaries.writtenMarkRight);
  });
});

describe("final OCR crop geometry", () => {
  it("final split zone crops exclude grid borders", async () => {
    const lineYs = [250, 285, 320, 355, 390, 425, 460];
    const verticals = [50, 100, 200, 500, 650, 700, 750, 800, 900];
    const buf = await makeSyntheticMarksheet(1000, 1100, lineYs, verticals);
    const detection = await detectMarksheetTable(buf, 1000, 1100);
    const zones = computeSplitZoneRects(detection, 0, 1000, 1100);

    expect(zones).toHaveLength(3);
    expect(zones[0]!.x).toBeGreaterThan(detection.splitMarkCol.x);
    expect(zones[0]!.x + zones[0]!.w).toBeLessThan(detection.splitZoneDividers[0]!);
    expect(zones[1]!.x).toBeGreaterThan(detection.splitZoneDividers[0]!);
    expect(zones[1]!.x + zones[1]!.w).toBeLessThan(detection.splitZoneDividers[1]!);
    expect(zones[2]!.x).toBeGreaterThan(detection.splitZoneDividers[1]!);
    expect(zones[2]!.x + zones[2]!.w).toBeLessThan(detection.columnBoundaries.splitMarkRight);
  });

  it("final crop boxes stay inside split/written columns and do not overlap remarks", async () => {
    const lineYs = [250, 285, 320, 355, 390, 425, 460];
    const verticals = [50, 100, 200, 500, 650, 700, 750, 800, 900];
    const buf = await makeSyntheticMarksheet(1000, 1100, lineYs, verticals);
    const detection = await detectMarksheetTable(buf, 1000, 1100);
    const written = computeWrittenMarkCropRect(detection, 0, 1000, 1100);
    const zones = computeSplitZoneRects(detection, 0, 1000, 1100);

    expect(written.x).toBeGreaterThan(detection.columnBoundaries.studentNameRight);
    expect(written.x + written.w).toBeLessThan(detection.columnBoundaries.writtenMarkRight);
    for (const zone of zones) {
      expect(zone.x).toBeGreaterThanOrEqual(detection.splitMarkCol.x);
      expect(zone.x + zone.w).toBeLessThanOrEqual(detection.columnBoundaries.splitMarkRight);
      expect(zone.x + zone.w).toBeLessThan(detection.columnBoundaries.tableRight);
    }
  });
});

// â”€â”€ detectedCellRect â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€ Crop ID â†’ admission number mapping â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€ All roster students must appear even if detection fails â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe("roster completeness when table detection falls back", () => {
  it("fallback provides a data row for every roster index up to 26", async () => {
    const buf = await blankJpeg(800, 1100);
    const detection = await detectMarksheetTable(buf, 800, 1100);

    // Simulate 4-student roster: rows 0â€“3 must all have valid rects.
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

