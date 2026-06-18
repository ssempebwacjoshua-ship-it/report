import { describe, expect, it } from "vitest";
import {
  COLUMNS,
  LAYOUT,
  PAGE_MARGIN_LEFT_FRAC,
  cellToPixel,
  dataRowRegion,
  splitRectIntoVerticalZones,
} from "../../server/services/marksheetGeometryService";

const A4_W = 1240; // 150 DPI A4 width in pixels
const A4_H = 1754; // 150 DPI A4 height in pixels

describe("Column layout fractions", () => {
  it("all column x+w values sum to ≤ 1 (no overflow)", () => {
    for (const col of Object.values(COLUMNS)) {
      expect(col.x + col.w).toBeLessThanOrEqual(1.001); // tiny float tolerance
      expect(col.x).toBeGreaterThanOrEqual(0);
    }
  });

  it("written mark column starts after ~61% of table width", () => {
    // x ≈ 453/733 ≈ 0.618
    expect(COLUMNS.writtenMark.x).toBeCloseTo(0.618, 2);
  });

  it("split mark column starts after written mark", () => {
    expect(COLUMNS.splitMark.x).toBeGreaterThan(COLUMNS.writtenMark.x);
  });

  it("columns are ordered left to right", () => {
    const cols = [
      COLUMNS.number,
      COLUMNS.admNumber,
      COLUMNS.studentName,
      COLUMNS.writtenMark,
      COLUMNS.splitMark,
      COLUMNS.remarks,
    ];
    for (let i = 1; i < cols.length; i++) {
      expect(cols[i]!.x).toBeGreaterThan(cols[i - 1]!.x);
    }
  });
});

describe("Page layout fractions", () => {
  it("table starts below header", () => {
    expect(LAYOUT.tableStartFrac).toBeGreaterThan(LAYOUT.marginTopFrac + LAYOUT.headerHFrac * 0.8);
  });

  it("first row starts below table header row", () => {
    const row0 = dataRowRegion(0);
    expect(row0.yFrac).toBeGreaterThan(LAYOUT.tableStartFrac);
  });

  it("rows are spaced correctly ? each row starts after the previous", () => {
    for (let i = 0; i < 5; i++) {
      const row = dataRowRegion(i);
      const next = dataRowRegion(i + 1);
      expect(next.yFrac).toBeCloseTo(row.yFrac + LAYOUT.dataRowHFrac, 6);
    }
  });

  it("26 rows fit within the page (no overflow)", () => {
    const lastRow = dataRowRegion(25);
    expect(lastRow.yFrac + lastRow.hFrac).toBeLessThan(1.0);
  });
});

describe("cellToPixel", () => {
  it("returns integer coordinates", () => {
    const rowFrac = dataRowRegion(0);
    const rect = cellToPixel(COLUMNS.writtenMark, rowFrac, A4_W, A4_H);
    expect(Number.isInteger(rect.x)).toBe(true);
    expect(Number.isInteger(rect.y)).toBe(true);
    expect(Number.isInteger(rect.w)).toBe(true);
    expect(Number.isInteger(rect.h)).toBe(true);
  });

  it("rect is within image bounds", () => {
    const rowFrac = dataRowRegion(0);
    const rect = cellToPixel(COLUMNS.writtenMark, rowFrac, A4_W, A4_H);
    expect(rect.x).toBeGreaterThanOrEqual(0);
    expect(rect.y).toBeGreaterThanOrEqual(0);
    expect(rect.x + rect.w).toBeLessThanOrEqual(A4_W);
    expect(rect.y + rect.h).toBeLessThanOrEqual(A4_H);
  });

  it("written mark column is placed in the right-half of the page", () => {
    const rowFrac = dataRowRegion(0);
    const rect = cellToPixel(COLUMNS.writtenMark, rowFrac, A4_W, A4_H);
    expect(rect.x).toBeGreaterThan(A4_W / 2);
  });

  it("split mark column is to the right of written mark column", () => {
    const rowFrac = dataRowRegion(0);
    const written = cellToPixel(COLUMNS.writtenMark, rowFrac, A4_W, A4_H);
    const split   = cellToPixel(COLUMNS.splitMark,   rowFrac, A4_W, A4_H);
    expect(split.x).toBeGreaterThan(written.x);
  });

  it("dimensions are positive and non-trivial", () => {
    const rowFrac = dataRowRegion(0);
    const rect = cellToPixel(COLUMNS.writtenMark, rowFrac, A4_W, A4_H);
    expect(rect.w).toBeGreaterThan(10);
    expect(rect.h).toBeGreaterThan(2);
  });

  it("page margin is applied ? number column does not start at pixel 0", () => {
    const rowFrac = dataRowRegion(0);
    const rect = cellToPixel(COLUMNS.number, rowFrac, A4_W, A4_H);
    const minExpected = Math.round(PAGE_MARGIN_LEFT_FRAC * A4_W * 0.5);
    expect(rect.x).toBeGreaterThanOrEqual(minExpected);
  });

  it("A4 300 DPI: rect still within bounds", () => {
    const w = 2480, h = 3508;
    const rowFrac = dataRowRegion(10);
    const rect = cellToPixel(COLUMNS.splitMark, rowFrac, w, h);
    expect(rect.x + rect.w).toBeLessThanOrEqual(w);
    expect(rect.y + rect.h).toBeLessThanOrEqual(h);
  });

  it("splits the split mark cell into exactly three vertical zones", () => {
    const rowFrac = dataRowRegion(0);
    const rect = cellToPixel(COLUMNS.splitMark, rowFrac, A4_W, A4_H);
    const zones = splitRectIntoVerticalZones(rect, 3);
    expect(zones).toHaveLength(3);
    expect(zones[0]!.x).toBe(rect.x);
    expect(zones[2]!.x + zones[2]!.w).toBe(rect.x + rect.w);
    expect(zones.reduce((sum, zone) => sum + zone.w, 0)).toBe(rect.w);
  });
});

