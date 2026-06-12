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
  geometryConfidence: number;
  colDetectionMethod: "detected" | "fallback";
  warnings: string[];
};

// ── Constants ──────────────────────────────────────────────────────────────────

// A row is a horizontal table border if ≥35% of its width is dark.
const DARK_THRESHOLD = 100;
const H_LINE_FRAC = 0.35;
// Search only between 18% and 92% of page height.
const SEARCH_TOP_FRAC = 0.18;
const SEARCH_BOT_FRAC = 0.92;
// Dark rows within 8px of each other belong to the same line event.
const GROUP_GAP = 8;

// Vertical line detection constants.
// A column pixel is a border if it is dark across ≥35% of the searched height.
const VERT_DARK_THRESHOLD = 140;
const VERT_LINE_FRAC = 0.35;
// Column pixels within 4px group into one vertical line event.
const COL_GROUP_GAP = 4;

// ── Fallback geometry ──────────────────────────────────────────────────────────

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
    geometryConfidence: 0,
    colDetectionMethod: "fallback",
    warnings,
  };
}

// ── Horizontal line detection ──────────────────────────────────────────────────

/**
 * Group consecutive "dark rows" (rows where ≥35% of pixels are dark) into
 * line events. Returns sorted Y positions (centre of each dark group).
 */
function findHorizontalLineEvents(
  pixels: Buffer,
  imgW: number,
  imgH: number,
): number[] {
  const searchTop = Math.floor(imgH * SEARCH_TOP_FRAC);
  const searchBot = Math.floor(imgH * SEARCH_BOT_FRAC);
  const lineThreshold = Math.floor(imgW * H_LINE_FRAC);

  const isLineRow: boolean[] = new Array(imgH).fill(false);
  for (let y = searchTop; y < searchBot; y++) {
    let count = 0;
    for (let x = 0; x < imgW; x++) {
      if ((pixels[y * imgW + x] ?? 255) < DARK_THRESHOLD) count++;
    }
    isLineRow[y] = count >= lineThreshold;
  }

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

  return lineEvents;
}

// ── Table boundary detection ───────────────────────────────────────────────────

/**
 * Find tableLeft and tableRight using the MEDIAN of leftmost/rightmost dark
 * pixels across all line rows (not min/max, which is fragile against artifacts).
 */
function findTableHorizExtent(
  pixels: Buffer,
  imgW: number,
  imgH: number,
  lineEvents: number[],
): { tableLeft: number; tableRight: number } {
  const leftPixels: number[] = [];
  const rightPixels: number[] = [];

  // Re-derive line rows using the same logic
  const searchTop = Math.floor(imgH * SEARCH_TOP_FRAC);
  const searchBot = Math.floor(imgH * SEARCH_BOT_FRAC);
  const lineThreshold = Math.floor(imgW * H_LINE_FRAC);

  for (let y = searchTop; y < searchBot; y++) {
    let count = 0;
    for (let x = 0; x < imgW; x++) {
      if ((pixels[y * imgW + x] ?? 255) < DARK_THRESHOLD) count++;
    }
    if (count < lineThreshold) continue;

    for (let x = 0; x < imgW; x++) {
      if ((pixels[y * imgW + x] ?? 255) < DARK_THRESHOLD) { leftPixels.push(x); break; }
    }
    for (let x = imgW - 1; x >= 0; x--) {
      if ((pixels[y * imgW + x] ?? 255) < DARK_THRESHOLD) { rightPixels.push(x); break; }
    }
  }

  if (leftPixels.length === 0) {
    return { tableLeft: 0, tableRight: imgW - 1 };
  }

  leftPixels.sort((a, b) => a - b);
  rightPixels.sort((a, b) => a - b);

  // Use 15th percentile for left (handles occasional left-edge artifacts)
  // Use 85th percentile for right
  const tableLeft = leftPixels[Math.floor(leftPixels.length * 0.15)] ?? leftPixels[0]!;
  const tableRight = rightPixels[Math.floor(rightPixels.length * 0.85)] ?? rightPixels[rightPixels.length - 1]!;

  return { tableLeft, tableRight };
}

// ── Vertical line detection ────────────────────────────────────────────────────

/**
 * Detect vertical column boundary lines within the marks table.
 *
 * Searches the top 20% of the table height (column header + a few data rows)
 * where handwriting is absent or minimal. Uses a lower dark threshold than
 * horizontal detection to catch lighter printed borders.
 */
function detectVerticalLines(
  pixels: Buffer,
  imgW: number,
  tableLeft: number,
  tableRight: number,
  tableTop: number,
  tableBottom: number,
): number[] {
  const tableH = tableBottom - tableTop;
  // Search top 20% of table — column headers + first few data rows
  const searchTop = tableTop;
  const searchBot = Math.min(tableBottom, tableTop + Math.round(tableH * 0.20));
  const rowsSearched = searchBot - searchTop;

  if (rowsSearched < 3) return [];

  const darkCountPerCol = new Int32Array(imgW).fill(0);
  for (let y = searchTop; y < searchBot; y++) {
    for (let x = tableLeft; x <= tableRight; x++) {
      if ((pixels[y * imgW + x] ?? 255) < VERT_DARK_THRESHOLD) {
        darkCountPerCol[x]++;
      }
    }
  }

  const vertThreshold = rowsSearched * VERT_LINE_FRAC;
  const isVertLine: boolean[] = new Array(imgW).fill(false);
  for (let x = tableLeft; x <= tableRight; x++) {
    isVertLine[x] = darkCountPerCol[x] >= vertThreshold;
  }

  // Group consecutive vertical line pixels into single events
  const colEvents: number[] = [];
  let grpStart = -1;
  let grpEnd = -1;

  for (let x = tableLeft; x <= tableRight + 1; x++) {
    const dark = x <= tableRight && isVertLine[x];
    if (dark) {
      if (grpStart < 0) grpStart = x;
      grpEnd = x;
    } else if (grpStart >= 0) {
      let nextInGap = false;
      for (let gap = x + 1; gap <= Math.min(x + COL_GROUP_GAP, tableRight); gap++) {
        if (isVertLine[gap]) { nextInGap = true; break; }
      }
      if (!nextInGap) {
        colEvents.push(Math.round((grpStart + grpEnd) / 2));
        grpStart = -1;
        grpEnd = -1;
      }
    }
  }

  return colEvents;
}

// ── Column position derivation ─────────────────────────────────────────────────

type ColDef = { x: number; w: number };

/**
 * Derive Written Mark and Split Mark column x positions from detected vertical
 * line events.
 *
 * Column order (left → right): No | Adm No | Student Name | Written | Split | Remarks
 * The rightmost 3 internal vertical lines (not touching outer table edges) are:
 *   [Name|Written boundary, Written|Split boundary, Split|Remarks boundary]
 *
 * Falls back to fraction-based positions when fewer than 3 internal lines found
 * or when the derived widths are unreasonable.
 */
function deriveColumnPositions(
  tableLeft: number,
  tableRight: number,
  colLines: number[],
  warnings: string[],
): { writtenMarkCol: ColDef; splitMarkCol: ColDef; colDetectionMethod: "detected" | "fallback" } {
  const tableWidth = tableRight - tableLeft;
  const margin = Math.max(5, Math.round(tableWidth * 0.02));

  // Filter out the outer table border lines
  const internalLines = colLines.filter(
    (x) => x > tableLeft + margin && x < tableRight - margin,
  ).sort((a, b) => a - b);

  if (internalLines.length >= 3) {
    // Rightmost 3 lines: [Name|Written, Written|Split, Split|Remarks]
    const last3 = internalLines.slice(-3);
    const writtenLeft = last3[0]!;
    const splitLeft = last3[1]!;
    const splitRight = last3[2]!;

    const writtenWidth = splitLeft - writtenLeft;
    const splitWidth = splitRight - splitLeft;
    const writtenFrac = writtenWidth / tableWidth;
    const splitFrac = splitWidth / tableWidth;

    // Sanity check: Written ≈5–20% of table, Split ≈5–20%
    if (writtenFrac >= 0.04 && writtenFrac <= 0.22 && splitFrac >= 0.04 && splitFrac <= 0.22) {
      return {
        writtenMarkCol: { x: writtenLeft, w: writtenWidth },
        splitMarkCol: { x: splitLeft, w: splitWidth },
        colDetectionMethod: "detected",
      };
    }

    warnings.push(
      `Detected column widths out of range (Written: ${(writtenFrac * 100).toFixed(1)}%, ` +
      `Split: ${(splitFrac * 100).toFixed(1)}%); using fraction-based positions.`,
    );
  } else {
    warnings.push(
      `Only ${internalLines.length} internal vertical line(s) detected (need ≥3); ` +
      `using fraction-based column positions.`,
    );
  }

  return {
    writtenMarkCol: {
      x: tableLeft + Math.round(COLUMNS.writtenMark.x * tableWidth),
      w: Math.round(COLUMNS.writtenMark.w * tableWidth),
    },
    splitMarkCol: {
      x: tableLeft + Math.round(COLUMNS.splitMark.x * tableWidth),
      w: Math.round(COLUMNS.splitMark.w * tableWidth),
    },
    colDetectionMethod: "fallback",
  };
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Detect the marks table from a scanned marksheet using horizontal and vertical
 * projection.
 *
 * Horizontal: count dark pixels per row → find line events → derive table bounds.
 * Vertical: count dark pixels per column in header area → find column boundaries.
 *
 * Falls back to fraction-based geometry when detection is insufficient.
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

  // Step 1: find horizontal line events
  const lineEvents = findHorizontalLineEvents(pixels, imgW, imgH);

  if (lineEvents.length < 3) {
    warnings.push(
      `Only ${lineEvents.length} horizontal line event(s) detected (need ≥3). Using fraction-based geometry.`,
    );
    return buildFallback(imgW, imgH, warnings);
  }

  // Step 2: find table left/right using percentile (robust to dark artifacts)
  const { tableLeft, tableRight } = findTableHorizExtent(pixels, imgW, imgH, lineEvents);

  const tableWidth = tableRight - tableLeft;
  if (tableWidth < imgW * 0.4) {
    warnings.push(
      `Detected table width ${tableWidth}px < 40% of image width. Using fraction-based geometry.`,
    );
    return buildFallback(imgW, imgH, warnings);
  }

  const tableTop = lineEvents[0]!;
  const tableBottom = lineEvents[lineEvents.length - 1]!;

  const columnHeaderBottom = lineEvents.length >= 2
    ? Math.round((lineEvents[0]! + lineEvents[1]!) / 2)
    : tableTop + Math.round(LAYOUT.tableHeaderHFrac * imgH);

  // Step 3: build data rows from gaps between consecutive line events
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

  // Extend to 26 rows using average detected row height (or fallback)
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

  // Step 4: detect vertical column lines
  const colLines = detectVerticalLines(
    pixels, imgW, tableLeft, tableRight, tableTop, tableBottom,
  );

  // Step 5: derive column positions
  const { writtenMarkCol, splitMarkCol, colDetectionMethod } = deriveColumnPositions(
    tableLeft, tableRight, colLines, warnings,
  );

  // Step 6: compute confidence score
  const rowCountScore = Math.min(1, detectedDataRows.length / 10);
  const heights = detectedDataRows.map((r) => r.h);
  const meanH = heights.reduce((a, b) => a + b, 0) / Math.max(1, heights.length);
  const variance = heights.reduce((a, b) => a + (b - meanH) ** 2, 0) / Math.max(1, heights.length);
  const uniformity = meanH > 0 ? Math.max(0, 1 - Math.sqrt(variance) / meanH) : 0;
  const colBonus = colDetectionMethod === "detected" ? 0.15 : 0;
  const geometryConfidence = Math.min(1, (rowCountScore + uniformity) / 2 + colBonus);

  return {
    method: "detected",
    tableLeft,
    tableRight,
    tableTop,
    tableBottom,
    columnHeaderBottom,
    rowLines: lineEvents,
    colLines,
    dataRows: allDataRows,
    writtenMarkCol,
    splitMarkCol,
    confidence: geometryConfidence,
    geometryConfidence,
    colDetectionMethod,
    warnings,
  };
}

/**
 * Return the pixel rect for a specific column and data row using detected geometry.
 * Falls back to geometry service fractions for rows beyond the detected range.
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
