import sharp from "sharp";
import {
  COLUMNS,
  LAYOUT,
  PAGE_MARGIN_LEFT_FRAC,
  TABLE_WIDTH_FRAC,
  cellToPixel,
  dataRowRegion,
  type PixelRect,
} from "./marksheetGeometryService";

export type TableDetectionResult = {
  method: "detected" | "fallback";
  tableLeft: number;
  tableRight: number;
  tableTop: number;
  tableBottom: number;
  columnHeaderBottom: number;
  rowLines: number[];
  colLines: number[];
  dataRows: PixelRect[];
  writtenMarkCol: { x: number; w: number };
  splitMarkCol: { x: number; w: number };
  confidence: number;
  warnings: string[];
};

// A row is a table border line if ≥35% of its width is dark.
const DARK_THRESHOLD = 100;
const H_LINE_FRAC = 0.35;
// Search only between 18% and 92% of page height (skip header/footer).
const SEARCH_TOP_FRAC = 0.18;
const SEARCH_BOT_FRAC = 0.92;
// Dark rows within 8px of each other belong to the same line event.
const GROUP_GAP = 8;

function buildFallback(imgW: number, imgH: number, warnings: string[]): TableDetectionResult {
  const tableLeft = Math.round(PAGE_MARGIN_LEFT_FRAC * imgW);
  const tableWidth = Math.round(TABLE_WIDTH_FRAC * imgW);
  const tableTop = Math.round(LAYOUT.tableStartFrac * imgH);
  const tableHeaderH = Math.round(LAYOUT.tableHeaderHFrac * imgH);
  const dataRowH = Math.max(1, Math.round(LAYOUT.dataRowHFrac * imgH));
  const colHeaderBot = tableTop + tableHeaderH;

  const dataRows: PixelRect[] = Array.from({ length: 26 }, (_, i) => ({
    x: tableLeft,
    y: colHeaderBot + i * dataRowH,
    w: tableWidth,
    h: dataRowH,
  }));

  return {
    method: "fallback",
    tableLeft,
    tableRight: tableLeft + tableWidth,
    tableTop,
    tableBottom: colHeaderBot + 26 * dataRowH,
    columnHeaderBottom: colHeaderBot,
    rowLines: [],
    colLines: [],
    dataRows,
    writtenMarkCol: {
      x: tableLeft + Math.round(COLUMNS.writtenMark.x * tableWidth),
      w: Math.round(COLUMNS.writtenMark.w * tableWidth),
    },
    splitMarkCol: {
      x: tableLeft + Math.round(COLUMNS.splitMark.x * tableWidth),
      w: Math.round(COLUMNS.splitMark.w * tableWidth),
    },
    confidence: 0,
    warnings,
  };
}

/**
 * Detect the marks table from a scanned marksheet using horizontal projection.
 *
 * Algorithm:
 *  1. Count dark pixels per row in the search region (18%–92% of height).
 *  2. Rows where ≥35% of pixels are dark are candidate table-border rows.
 *  3. Group nearby candidate rows (within 8px) into line events.
 *  4. Derive table left/right from the horizontal extent of all line rows.
 *  5. Build data row rects from gaps between consecutive line events.
 *  6. Extend to 26 rows using detected or fallback row height.
 *
 * Falls back to fraction-based geometry if fewer than 3 line events are found
 * or the detected table is too narrow (< 40% of image width).
 */
export async function detectMarksheetTable(
  buffer: Buffer,
  imgW: number,
  imgH: number,
): Promise<TableDetectionResult> {
  const warnings: string[] = [];

  let pixels: Buffer;
  try {
    const result = await sharp(buffer)
      .greyscale()
      .raw()
      .toBuffer({ resolveWithObject: true });
    pixels = result.data;
  } catch (err) {
    return buildFallback(imgW, imgH, [`Pixel extraction failed: ${err}`]);
  }

  const searchTop = Math.floor(imgH * SEARCH_TOP_FRAC);
  const searchBot = Math.floor(imgH * SEARCH_BOT_FRAC);
  const lineThreshold = Math.floor(imgW * H_LINE_FRAC);

  // Mark rows that have enough dark pixels to be a table border.
  const isLineRow: boolean[] = new Array(imgH).fill(false);
  for (let y = searchTop; y < searchBot; y++) {
    let count = 0;
    for (let x = 0; x < imgW; x++) {
      if ((pixels[y * imgW + x] ?? 255) < DARK_THRESHOLD) count++;
    }
    isLineRow[y] = count >= lineThreshold;
  }

  // Group consecutive line rows into single line events (centre Y).
  const lineEvents: number[] = [];
  let groupStart = -1;
  let groupEnd = -1;
  for (let y = searchTop; y <= searchBot; y++) {
    const dark = y < searchBot && isLineRow[y];
    if (dark) {
      if (groupStart < 0) groupStart = y;
      groupEnd = y;
    } else if (groupStart >= 0) {
      let nextInGap = false;
      for (let gap = y + 1; gap <= Math.min(y + GROUP_GAP, searchBot - 1); gap++) {
        if (isLineRow[gap]) { nextInGap = true; break; }
      }
      if (!nextInGap) {
        lineEvents.push(Math.round((groupStart + groupEnd) / 2));
        groupStart = -1;
        groupEnd = -1;
      }
    }
  }

  if (lineEvents.length < 3) {
    warnings.push(
      `Only ${lineEvents.length} horizontal line event(s) detected (need ≥3). ` +
      `Using fraction-based geometry.`,
    );
    return buildFallback(imgW, imgH, warnings);
  }

  // Determine table horizontal extent from leftmost/rightmost dark pixel in line rows.
  let tableLeft = imgW;
  let tableRight = 0;
  for (let y = searchTop; y < searchBot; y++) {
    if (!isLineRow[y]) continue;
    for (let x = 0; x < imgW; x++) {
      if ((pixels[y * imgW + x] ?? 255) < DARK_THRESHOLD) {
        if (x < tableLeft) tableLeft = x;
        break;
      }
    }
    for (let x = imgW - 1; x >= 0; x--) {
      if ((pixels[y * imgW + x] ?? 255) < DARK_THRESHOLD) {
        if (x > tableRight) tableRight = x;
        break;
      }
    }
  }

  const tableWidth = tableRight - tableLeft;
  if (tableWidth < imgW * 0.4) {
    warnings.push(
      `Detected table width ${tableWidth}px < 40% of image width ${imgW}px. ` +
      `Using fraction-based geometry.`,
    );
    return buildFallback(imgW, imgH, warnings);
  }

  const tableTop = lineEvents[0]!;
  const tableBottom = lineEvents[lineEvents.length - 1]!;

  // Column header runs from the top border to the midpoint before the first data row.
  const columnHeaderBottom = lineEvents.length >= 2
    ? Math.round((lineEvents[0]! + lineEvents[1]!) / 2)
    : tableTop + Math.round(LAYOUT.tableHeaderHFrac * imgH);

  // Data rows are the gaps between consecutive line events (skip first = column header).
  const detectedDataRows: PixelRect[] = [];
  for (let i = 1; i < lineEvents.length - 1; i++) {
    const rowTop = lineEvents[i]!;
    const rowBot = lineEvents[i + 1]!;
    detectedDataRows.push({
      x: tableLeft,
      y: rowTop,
      w: tableWidth,
      h: Math.max(1, rowBot - rowTop),
    });
  }

  // Extend to 26 rows using the average detected row height (or fallback height).
  const avgH = detectedDataRows.length > 0
    ? Math.round(detectedDataRows.reduce((s, r) => s + r.h, 0) / detectedDataRows.length)
    : Math.max(1, Math.round(LAYOUT.dataRowHFrac * imgH));

  const allDataRows: PixelRect[] = [...detectedDataRows];
  const lastRow = detectedDataRows[detectedDataRows.length - 1];
  let extendY = lastRow ? lastRow.y + lastRow.h : columnHeaderBottom;
  for (let extra = detectedDataRows.length; extra < 26; extra++) {
    allDataRows.push({ x: tableLeft, y: extendY, w: tableWidth, h: avgH });
    extendY += avgH;
  }

  // Column x positions are the fixed column fractions applied to the detected table width.
  const writtenMarkCol = {
    x: tableLeft + Math.round(COLUMNS.writtenMark.x * tableWidth),
    w: Math.round(COLUMNS.writtenMark.w * tableWidth),
  };
  const splitMarkCol = {
    x: tableLeft + Math.round(COLUMNS.splitMark.x * tableWidth),
    w: Math.round(COLUMNS.splitMark.w * tableWidth),
  };

  // Confidence = mean of row count score (how many rows we detected) and row height uniformity.
  const rowCountScore = Math.min(1, detectedDataRows.length / 10);
  const heights = detectedDataRows.map((r) => r.h);
  const meanH = heights.reduce((a, b) => a + b, 0) / Math.max(1, heights.length);
  const variance = heights.reduce((a, b) => a + (b - meanH) ** 2, 0) / Math.max(1, heights.length);
  const uniformity = meanH > 0 ? Math.max(0, 1 - Math.sqrt(variance) / meanH) : 0;
  const confidence = (rowCountScore + uniformity) / 2;

  return {
    method: "detected",
    tableLeft,
    tableRight,
    tableTop,
    tableBottom,
    columnHeaderBottom,
    rowLines: lineEvents,
    colLines: [],
    dataRows: allDataRows,
    writtenMarkCol,
    splitMarkCol,
    confidence,
    warnings,
  };
}

/**
 * Return the pixel rect for a specific column and data row using detected geometry.
 * Falls back to geometry service fractions when rowIndex is beyond detected rows.
 */
export function detectedCellRect(
  detection: TableDetectionResult,
  col: "writtenMark" | "splitMark",
  rowIndex: number,
  imgW: number,
  imgH: number,
  inset = 0.08,
): PixelRect {
  const row = detection.dataRows[rowIndex];
  const colDef = col === "writtenMark" ? detection.writtenMarkCol : detection.splitMarkCol;

  if (!row) {
    return cellToPixel(
      col === "writtenMark" ? COLUMNS.writtenMark : COLUMNS.splitMark,
      dataRowRegion(rowIndex),
      imgW,
      imgH,
      inset,
    );
  }

  return {
    x: Math.max(0, Math.round(colDef.x + inset * colDef.w)),
    y: Math.max(0, Math.round(row.y + inset * row.h)),
    w: Math.max(1, Math.round(colDef.w * (1 - 2 * inset))),
    h: Math.max(1, Math.round(row.h * (1 - 2 * inset))),
  };
}
