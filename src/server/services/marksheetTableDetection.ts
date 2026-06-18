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
  columnBoundaries: ColumnBoundaries;
  writtenMarkCol: { x: number; w: number };
  splitMarkCol: { x: number; w: number };
  /** X positions of internal divider lines within the split mark column (data row area). */
  splitZoneDividers: number[];
  confidence: number;
  geometryConfidence: number;
  colDetectionMethod: "detected" | "fallback";
  warnings: string[];
};

export type ColumnBoundaries = {
  tableLeft: number;
  noRight: number;
  admNoRight: number;
  studentNameRight: number;
  writtenMarkRight: number;
  splitMarkRight: number;
  tableRight: number;
};

// â”€â”€ Constants â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// A row is a horizontal table border if â‰¥35% of its width is dark.
const DARK_THRESHOLD = 100;
const H_LINE_FRAC = 0.35;
// Search only between 18% and 92% of page height.
const SEARCH_TOP_FRAC = 0.18;
const SEARCH_BOT_FRAC = 0.92;
// Dark rows within 8px of each other belong to the same line event.
const GROUP_GAP = 8;

// Vertical line detection constants.
// Search the full marks table grid. Handwriting is localized; real grid lines
// persist through most of the table height.
const VERT_DARK_THRESHOLD = 120;
const VERT_LINE_FRAC = 0.40;
// Column pixels within 4px group into one vertical line event.
const COL_GROUP_GAP = 4;

// Split-zone divider detection constants (data-row search).
const SPLIT_VERT_DARK_THRESHOLD = 140;
const SPLIT_VERT_LINE_FRAC = 0.40;

/**
 * Fixed-pixel crop padding constants (for DETECTED geometry only).
 *
 * CELL_H_PAD   â€“ horizontal inset from the detected column boundary into the cell (px).
 * CELL_V_PAD   â€“ vertical inset from the detected row-line centre into the cell (px).
 *               Must clear the border half-width + JPEG ringing (~8 px each = 14 px total);
 *               15 px gives 1 px of clear margin at 600 dpi.
 * ZONE_DIV_PAD â€“ padding from an internal split-zone divider centre to the zone crop edge.
 *
 * FALLBACK_H_PAD / FALLBACK_V_PAD â€“ used when method="fallback" (no detected borders to clear).
 * MIN_CROP_W / MIN_CROP_H â€“ absolute minimums enforced regardless of row size.
 */
export const CELL_H_PAD = 8;
export const CELL_V_PAD = 15;
export const ZONE_DIV_PAD = 8;

// Fallback pads are small â€” no printed border to clear in estimated geometry.
const FALLBACK_H_PAD = 2;
const FALLBACK_V_PAD = 2;

// Minimum usable crop dimensions before OCR is attempted.
export const MIN_CROP_W = 40;
export const MIN_CROP_H = 18;

/**
 * Minimum row-band height (ORIGINAL image px) for a detected row to be trusted.
 *
 * On high-resolution scans (e.g. 5100Ã—7013) a real marksheet row is ~150â€“200px
 * tall. When the horizontal-line detector locks onto closely-spaced printed
 * borders it can emit rows only ~14â€“18px tall â€” far too short to contain a
 * handwritten mark. Anything below this threshold is treated as border noise and
 * the row band is reconstructed from the overall table-body height instead.
 */
export const MIN_ROW_BAND_H = 40;

// â”€â”€ Fallback geometry â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const CALIBRATED_BOUNDARY_FRACS = {
  noRight: 0.058,
  admNoRight: 0.196,
  studentNameRight: 0.504,
  writtenMarkRight: 0.660,
  splitMarkRight: 0.806,
} as const;

function calibratedBoundaries(tableLeft: number, tableRight: number): ColumnBoundaries {
  const tableWidth = tableRight - tableLeft;
  return {
    tableLeft,
    noRight: tableLeft + Math.round(CALIBRATED_BOUNDARY_FRACS.noRight * tableWidth),
    admNoRight: tableLeft + Math.round(CALIBRATED_BOUNDARY_FRACS.admNoRight * tableWidth),
    studentNameRight: tableLeft + Math.round(CALIBRATED_BOUNDARY_FRACS.studentNameRight * tableWidth),
    writtenMarkRight: tableLeft + Math.round(CALIBRATED_BOUNDARY_FRACS.writtenMarkRight * tableWidth),
    splitMarkRight: tableLeft + Math.round(CALIBRATED_BOUNDARY_FRACS.splitMarkRight * tableWidth),
    tableRight,
  };
}

function columnsFromBoundaries(boundaries: ColumnBoundaries): {
  writtenMarkCol: ColDef;
  splitMarkCol: ColDef;
} {
  return {
    writtenMarkCol: {
      x: boundaries.studentNameRight,
      w: boundaries.writtenMarkRight - boundaries.studentNameRight,
    },
    splitMarkCol: {
      x: boundaries.writtenMarkRight,
      w: boundaries.splitMarkRight - boundaries.writtenMarkRight,
    },
  };
}

function buildFallback(imgW: number, imgH: number, warnings: string[], rosterCount = 26): TableDetectionResult {
  const tableLeft = Math.round(PAGE_MARGIN_LEFT_FRAC * imgW);
  const tableWidth = Math.round(TABLE_WIDTH_FRAC * imgW);
  const tableTop = Math.round(LAYOUT.tableStartFrac * imgH);
  const tableHeaderH = Math.round(LAYOUT.tableHeaderHFrac * imgH);
  const colHeaderBot = tableTop + tableHeaderH;

  // Divide the full estimated body height across all roster rows.
  // Use 95% of page height as the estimated table bottom to leave a small margin.
  const rowCount = Math.max(26, rosterCount);
  const estimatedTableBottom = Math.round(imgH * 0.95);
  const bodyH = Math.max(1, estimatedTableBottom - colHeaderBot);
  // Minimum row height: enough so padding still leaves a crop, but never exceeds body/rowCount.
  const minRowH = MIN_CROP_H + FALLBACK_V_PAD * 2 + 2;
  const dataRowH = Math.max(1, Math.min(minRowH, Math.round(bodyH / rowCount)));

  const dataRows: PixelRect[] = Array.from({ length: rowCount }, (_, i) => ({
    x: tableLeft,
    y: colHeaderBot + i * dataRowH,
    w: tableWidth,
    h: dataRowH,
  }));
  const columnBoundaries = calibratedBoundaries(tableLeft, tableLeft + tableWidth);
  const { writtenMarkCol, splitMarkCol } = columnsFromBoundaries(columnBoundaries);

  return {
    method: "fallback",
    tableLeft,
    tableRight: tableLeft + tableWidth,
    tableTop,
    tableBottom: colHeaderBot + rowCount * dataRowH,
    columnHeaderBottom: colHeaderBot,
    rowLines: [],
    colLines: [],
    dataRows,
    columnBoundaries,
    writtenMarkCol,
    splitMarkCol,
    splitZoneDividers: [],
    confidence: 0,
    geometryConfidence: 0,
    colDetectionMethod: "fallback",
    warnings,
  };
}

// â”€â”€ Horizontal line detection â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Group consecutive "dark rows" (rows where â‰¥35% of pixels are dark) into
 * line events. Returns sorted Y positions (centre of each dark group).
 */
type HorizontalLineEvent = { y: number; start: number; end: number };

function findHorizontalLineEvents(
  pixels: Buffer,
  imgW: number,
  imgH: number,
): HorizontalLineEvent[] {
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

  const lineEvents: HorizontalLineEvent[] = [];
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
        lineEvents.push({
          y: Math.round((groupStart + groupEnd) / 2),
          start: groupStart,
          end: groupEnd,
        });
        groupStart = -1;
        groupEnd = -1;
      }
    }
  }

  return lineEvents;
}

// â”€â”€ Table boundary detection â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Find tableLeft and tableRight using the median of leftmost/rightmost dark
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

  const tableLeft = leftPixels[Math.floor(leftPixels.length * 0.5)] ?? leftPixels[0]!;
  const tableRight = rightPixels[Math.floor(rightPixels.length * 0.5)] ?? rightPixels[rightPixels.length - 1]!;

  return { tableLeft, tableRight };
}

// â”€â”€ Vertical line detection â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Detect vertical column boundary lines within the marks table.
 *
 * Uses the full table height. Printed borders persist across rows; handwriting
 * usually does not satisfy the vertical coverage threshold.
 */
function detectVerticalLines(
  pixels: Buffer,
  imgW: number,
  tableLeft: number,
  tableRight: number,
  tableTop: number,
  tableBottom: number,
): number[] {
  const searchTop = tableTop;
  const searchBot = tableBottom;
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

// â”€â”€ Split-zone divider detection â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Detect the 2 internal vertical divider lines within the split mark column.
 *
 * Unlike column-boundary detection (which searches only the header row to avoid
 * handwriting), these internal dividers ONLY appear in the data rows â€” the header
 * cell is a single merged "Split Mark Entry" cell with no sub-dividers.
 *
 * Returns sorted x positions of internal dividers (excluding outer column borders).
 */
function detectSplitZoneDividers(
  pixels: Buffer,
  imgW: number,
  splitLeft: number,
  splitRight: number,
  dataRowTop: number,
  tableBottom: number,
): number[] {
  const searchHeight = tableBottom - dataRowTop;
  if (searchHeight < 10 || splitRight <= splitLeft) return [];

  const darkCountPerCol = new Int32Array(imgW).fill(0);
  for (let y = dataRowTop; y < tableBottom; y++) {
    for (let x = splitLeft; x <= splitRight; x++) {
      if ((pixels[y * imgW + x] ?? 255) < SPLIT_VERT_DARK_THRESHOLD) {
        darkCountPerCol[x]++;
      }
    }
  }

  const threshold = searchHeight * SPLIT_VERT_LINE_FRAC;
  const isLine: boolean[] = new Array(imgW).fill(false);
  for (let x = splitLeft; x <= splitRight; x++) {
    isLine[x] = darkCountPerCol[x] >= threshold;
  }

  const events: number[] = [];
  let grpStart = -1;
  let grpEnd = -1;

  for (let x = splitLeft; x <= splitRight + 1; x++) {
    const dark = x <= splitRight && isLine[x];
    if (dark) {
      if (grpStart < 0) grpStart = x;
      grpEnd = x;
    } else if (grpStart >= 0) {
      let nextInGap = false;
      for (let gap = x + 1; gap <= Math.min(x + COL_GROUP_GAP, splitRight); gap++) {
        if (isLine[gap]) { nextInGap = true; break; }
      }
      if (!nextInGap) {
        events.push(Math.round((grpStart + grpEnd) / 2));
        grpStart = -1;
        grpEnd = -1;
      }
    }
  }

  // Exclude outer borders (within 10px of split column edges)
  const margin = 10;
  return events
    .filter((x) => x > splitLeft + margin && x < splitRight - margin)
    .sort((a, b) => a - b);
}

// â”€â”€ Column position derivation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

type ColDef = { x: number; w: number };

/**
 * Derive Written Mark and Split Mark column x positions from detected vertical
 * line events.
 *
 * Column order: No | Adm No | Student Name | Written | Split | Remarks
 * The rightmost 3 internal vertical lines are the last 3 inter-column boundaries.
 *
 * Falls back to template fractions when fewer than 3 internal lines are found
 * or when derived widths are unreasonable.
 */
function isReasonableColumnBoundaries(boundaries: ColumnBoundaries): boolean {
  const ordered = [
    boundaries.tableLeft,
    boundaries.noRight,
    boundaries.admNoRight,
    boundaries.studentNameRight,
    boundaries.writtenMarkRight,
    boundaries.splitMarkRight,
    boundaries.tableRight,
  ];
  for (let i = 1; i < ordered.length; i++) {
    if (ordered[i]! <= ordered[i - 1]!) return false;
  }

  const tableWidth = boundaries.tableRight - boundaries.tableLeft;
  const widths = {
    no: (boundaries.noRight - boundaries.tableLeft) / tableWidth,
    adm: (boundaries.admNoRight - boundaries.noRight) / tableWidth,
    student: (boundaries.studentNameRight - boundaries.admNoRight) / tableWidth,
    written: (boundaries.writtenMarkRight - boundaries.studentNameRight) / tableWidth,
    split: (boundaries.splitMarkRight - boundaries.writtenMarkRight) / tableWidth,
    remarks: (boundaries.tableRight - boundaries.splitMarkRight) / tableWidth,
  };

  return (
    widths.no >= 0.025 && widths.no <= 0.10 &&
    widths.adm >= 0.07 && widths.adm <= 0.18 &&
    widths.student >= 0.22 && widths.student <= 0.50 &&
    widths.written >= 0.08 && widths.written <= 0.22 &&
    widths.split >= 0.08 && widths.split <= 0.22 &&
    widths.remarks >= 0.10 && widths.remarks <= 0.28
  );
}

function deriveColumnPositions(
  tableLeft: number,
  tableRight: number,
  colLines: number[],
  warnings: string[],
): {
  columnBoundaries: ColumnBoundaries;
  writtenMarkCol: ColDef;
  splitMarkCol: ColDef;
  detectedSplitDividers: number[];
  colDetectionMethod: "detected" | "fallback";
} {
  const tableWidth = tableRight - tableLeft;
  const margin = Math.max(5, Math.round(tableWidth * 0.01));

  const candidates = colLines
    .filter((x) => x >= tableLeft - margin && x <= tableRight + margin)
    .sort((a, b) => a - b);

  let best: { boundaries: ColumnBoundaries; dividers: number[]; score: number } | null = null;

  for (let i = 0; i <= candidates.length - 4; i++) {
    const cluster = candidates.slice(i, i + 4);
    const gaps = [
      cluster[1]! - cluster[0]!,
      cluster[2]! - cluster[1]!,
      cluster[3]! - cluster[2]!,
    ];
    const meanGap = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
    if (meanGap <= 0) continue;

    const maxDeviation = Math.max(...gaps.map((gap) => Math.abs(gap - meanGap))) / meanGap;
    const splitFrac = (cluster[3]! - cluster[0]!) / tableWidth;
    if (maxDeviation > 0.35 || splitFrac < 0.08 || splitFrac > 0.22) continue;

    const leftLines = candidates.slice(0, i);
    const rightLines = candidates.slice(i + 4);
    if (leftLines.length < 3 || rightLines.length < 1) continue;

    const noRight = leftLines[leftLines.length - 3]!;
    const admNoRight = leftLines[leftLines.length - 2]!;
    const studentNameRight = leftLines[leftLines.length - 1]!;
    const writtenMarkRight = cluster[0]!;
    const splitMarkRight = cluster[3]!;
    const detectedTableLeft = leftLines[0]!;
    const detectedTableRight = rightLines[rightLines.length - 1]!;

    const boundaries: ColumnBoundaries = {
      tableLeft: detectedTableLeft,
      noRight,
      admNoRight,
      studentNameRight,
      writtenMarkRight,
      splitMarkRight,
      tableRight: detectedTableRight,
    };
    if (!isReasonableColumnBoundaries(boundaries)) continue;

    const score = maxDeviation + Math.abs(splitFrac - 0.145);
    if (!best || score < best.score) {
      best = {
        boundaries,
        dividers: [cluster[1]!, cluster[2]!],
        score,
      };
    }
  }

  if (best) {
    const { writtenMarkCol, splitMarkCol } = columnsFromBoundaries(best.boundaries);
    return {
      columnBoundaries: best.boundaries,
      writtenMarkCol,
      splitMarkCol,
      detectedSplitDividers: best.dividers,
      colDetectionMethod: "detected",
    };
  }

  if (candidates.length > 0) {
    warnings.push(
      `Detected ${candidates.length} vertical grid candidate(s), but none matched the marksheet column order; ` +
      `using calibrated template column positions.`,
    );
  } else {
    warnings.push(
      "No vertical grid candidates detected; using calibrated template column positions.",
    );
  }

  const columnBoundaries = calibratedBoundaries(tableLeft, tableRight);
  const { writtenMarkCol, splitMarkCol } = columnsFromBoundaries(columnBoundaries);
  return {
    columnBoundaries,
    writtenMarkCol,
    splitMarkCol,
    detectedSplitDividers: [],
    colDetectionMethod: "fallback",
  };
}

// â”€â”€ Public API â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function detectMarksheetTable(
  buffer: Buffer,
  imgW: number,
  imgH: number,
  rosterCount = 26,
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
    return buildFallback(imgW, imgH, [`Pixel extraction failed: ${err}`], rosterCount);
  }

  // Step 1: find horizontal line events
  const horizontalEvents = findHorizontalLineEvents(pixels, imgW, imgH);
  const lineEvents = horizontalEvents.map((event) => event.y);

  if (lineEvents.length < 3) {
    warnings.push(
      `Only ${lineEvents.length} horizontal line event(s) detected (need â‰¥3). Using fraction-based geometry.`,
    );
    return buildFallback(imgW, imgH, warnings, rosterCount);
  }

  // Step 2: find table left/right
  const { tableLeft, tableRight } = findTableHorizExtent(pixels, imgW, imgH, lineEvents);

  const tableWidth = tableRight - tableLeft;
  if (tableWidth < imgW * 0.4) {
    warnings.push(
      `Detected table width ${tableWidth}px < 40% of image width. Using fraction-based geometry.`,
    );
    return buildFallback(imgW, imgH, warnings, rosterCount);
  }

  const tableTop = horizontalEvents[0]!.y;
  const tableBottom = horizontalEvents[horizontalEvents.length - 1]!.y;

  const columnHeaderBottom = horizontalEvents.length >= 2
    ? horizontalEvents[1]!.end
    : tableTop + Math.round(LAYOUT.tableHeaderHFrac * imgH);

  // Step 3: build data rows from line-event gaps
  const detectedDataRows: PixelRect[] = [];
  for (let i = 1; i < horizontalEvents.length - 1; i++) {
    const rowTop = i === 1 ? horizontalEvents[i]!.end : horizontalEvents[i]!.y;
    const rowBot = horizontalEvents[i + 1]!.y;
    if (rowBot <= rowTop) continue;
    detectedDataRows.push({
      x: tableLeft,
      y: rowTop,
      w: tableWidth,
      h: Math.max(1, rowBot - rowTop),
    });
  }

  const avgH = detectedDataRows.length > 0
    ? Math.round(detectedDataRows.reduce((s, r) => s + r.h, 0) / detectedDataRows.length)
    : Math.max(1, Math.round(LAYOUT.dataRowHFrac * imgH));

  const targetRowCount = Math.max(26, rosterCount);
  const allDataRows: PixelRect[] = [...detectedDataRows];
  const lastRow = detectedDataRows[detectedDataRows.length - 1];
  let extendY = lastRow ? lastRow.y + lastRow.h : columnHeaderBottom;
  for (let extra = detectedDataRows.length; extra < targetRowCount; extra++) {
    allDataRows.push({ x: tableLeft, y: extendY, w: tableWidth, h: avgH });
    extendY += avgH;
  }

  // Step 4: detect vertical table grid lines
  const colLines = detectVerticalLines(
    pixels, imgW, tableLeft, tableRight, tableTop, tableBottom,
  );

  // Step 5: derive column positions
  const {
    columnBoundaries,
    writtenMarkCol,
    splitMarkCol,
    detectedSplitDividers,
    colDetectionMethod,
  } = deriveColumnPositions(
    tableLeft, tableRight, colLines, warnings,
  );

  // Step 6: detect internal split-zone dividers (data rows only)
  // These dividers are NOT in the column header so must be searched separately.
  const dataRowTop = horizontalEvents.length >= 2 ? horizontalEvents[1]!.end : tableTop;
  const splitZoneDividers = detectSplitZoneDividers(
    pixels, imgW,
    splitMarkCol.x, splitMarkCol.x + splitMarkCol.w,
    dataRowTop, tableBottom,
  );
  const finalSplitZoneDividers = splitZoneDividers.length >= 2
    ? splitZoneDividers
    : detectedSplitDividers;

  if (finalSplitZoneDividers.length < 2) {
    warnings.push(
      `Only ${finalSplitZoneDividers.length} split-zone divider(s) detected (need 2); ` +
      `split zones will use equal-width division.`,
    );
  }

  // Step 7: compute confidence
  const rowCountScore = Math.min(1, detectedDataRows.length / 10);
  const heights = detectedDataRows.map((r) => r.h);
  const meanH = heights.reduce((a, b) => a + b, 0) / Math.max(1, heights.length);
  const variance = heights.reduce((a, b) => a + (b - meanH) ** 2, 0) / Math.max(1, heights.length);
  const uniformity = meanH > 0 ? Math.max(0, 1 - Math.sqrt(variance) / meanH) : 0;
  const colBonus = colDetectionMethod === "detected" ? 0.15 : 0;
  const geometryConfidence = Math.min(1, (rowCountScore + uniformity) / 2 + colBonus);

  return {
    method: "detected",
    tableLeft: columnBoundaries.tableLeft,
    tableRight: columnBoundaries.tableRight,
    tableTop,
    tableBottom,
    columnHeaderBottom,
    rowLines: lineEvents,
    colLines,
    dataRows: allDataRows,
    columnBoundaries,
    writtenMarkCol,
    splitMarkCol,
    splitZoneDividers: finalSplitZoneDividers,
    confidence: geometryConfidence,
    geometryConfidence,
    colDetectionMethod,
    warnings,
  };
}

// â”€â”€ Final crop rect helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Build a crop rectangle from absolute left/right/top/bottom cell boundaries,
 * applying fixed-pixel inward padding on each side.
 *
 * All four boundaries are expected to be at the CENTRE of a printed grid line,
 * so padding values must be large enough to clear the border half-width plus
 * JPEG ringing (empirically ~15 px total at 600 dpi).
 *
 * Padding is automatically reduced if the raw cell is smaller than the minimum
 * crop dimensions, so we never produce a crop below MIN_CROP_W Ã— MIN_CROP_H.
 * The crop is never expanded beyond the supplied cell boundaries.
 */
export function finalCropRect(
  x1: number,
  x2: number,
  y1: number,
  y2: number,
  hPad: number,
  vPad: number,
): PixelRect {
  const rawW = x2 - x1;
  const rawH = y2 - y1;
  // Scale padding down if the cell is too narrow/short to meet the minimum after padding.
  const effectiveHPad = rawW - 2 * hPad >= MIN_CROP_W
    ? hPad
    : Math.max(0, Math.floor((rawW - MIN_CROP_W) / 2));
  const effectiveVPad = rawH - 2 * vPad >= MIN_CROP_H
    ? vPad
    : Math.max(0, Math.floor((rawH - MIN_CROP_H) / 2));
  const x = Math.max(0, x1 + effectiveHPad);
  const y = Math.max(0, y1 + effectiveVPad);
  const w = Math.max(1, rawW - 2 * effectiveHPad);
  const h = Math.max(1, rawH - 2 * effectiveVPad);
  return { x, y, w, h };
}

// â”€â”€ Row-band resolution â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export type RowBand = { top: number; bottom: number; height: number; reconstructed: boolean };

/** True when a crop/row band is tall enough (original px) to hold a handwritten mark. */
export function isCropHeightValid(height: number): boolean {
  return height >= MIN_ROW_BAND_H;
}

/**
 * Resolve a usable vertical row band for a data row.
 *
 * When the detected row height is implausibly small (the detector locked onto a
 * printed border line), the band is reconstructed by dividing the table body
 * evenly across the roster â€” giving a realistic ~150â€“200px band on hi-res scans
 * instead of a 14px border sliver. Also handles rowIndex beyond the detected
 * rows by extrapolating within the table body.
 */
export function effectiveRowBand(
  detection: TableDetectionResult,
  rowIndex: number,
  _imgH = 0,
): RowBand {
  const rowCount = Math.max(1, detection.dataRows.length);
  const bodyTop = detection.columnHeaderBottom || detection.tableTop;
  const bodyBottom = detection.tableBottom;
  const reconstructedH = (bodyBottom - bodyTop) / rowCount;
  const row = detection.dataRows[rowIndex];

  if (row && row.h >= MIN_ROW_BAND_H) {
    return { top: row.y, bottom: row.y + row.h, height: row.h, reconstructed: false };
  }

  // Detected row missing or too thin: reconstruct from the table body if that
  // yields a plausible band height.
  if (reconstructedH >= MIN_ROW_BAND_H) {
    const top = Math.round(bodyTop + rowIndex * reconstructedH);
    const height = Math.round(reconstructedH);
    return { top, bottom: top + height, height, reconstructed: true };
  }

  // Neither detected nor reconstructed band clears the minimum (small estimated
  // geometry / unit-test images): use the detected row as-is so downstream
  // adaptive-padding guards apply.
  if (row) {
    return { top: row.y, bottom: row.y + row.h, height: row.h, reconstructed: false };
  }
  const top = Math.round(bodyTop + rowIndex * reconstructedH);
  const height = Math.max(1, Math.round(reconstructedH));
  return { top, bottom: top + height, height, reconstructed: true };
}

/**
 * Crop the INNER portion of a row band (vertical 20%â€“80%) to avoid the printed
 * top/bottom border lines, and inset horizontally to clear vertical column
 * borders. Targets the handwritten-mark area, not the grid.
 */
export function innerRowBandRect(top: number, bottom: number, colX: number, colW: number): PixelRect {
  const height = Math.max(1, bottom - top);
  const innerTop = Math.round(top + height * 0.2);
  const innerH = Math.max(1, Math.round(height * 0.6));
  const xInset = Math.max(2, Math.round(colW * 0.08));
  return {
    x: Math.max(0, Math.round(colX + xInset)),
    y: Math.max(0, innerTop),
    w: Math.max(1, Math.round(colW - 2 * xInset)),
    h: innerH,
  };
}

/**
 * Compute the crop rect for the Written Mark cell of a given row.
 *
 * For detected (or reconstructed) geometry the crop targets the inner 20â€“80% of
 * the row band, avoiding the printed borders that previously produced 14â€“18px
 * border-only crops. For small estimated geometry it falls back to the adaptive
 * finalCropRect padding so minimum-size guards still hold.
 */
export function computeWrittenMarkCropRect(
  detection: TableDetectionResult,
  rowIndex: number,
  imgW = 0,
  imgH = 0,
): PixelRect {
  const wc = detection.writtenMarkCol;
  const band = effectiveRowBand(detection, rowIndex, imgH);

  // Detected (or reconstructed) row band is tall enough: crop its inner region so
  // the printed top/bottom border lines are excluded and only the handwritten
  // mark area remains.
  if (band.height >= MIN_ROW_BAND_H) {
    return innerRowBandRect(band.top, band.bottom, wc.x, wc.w);
  }

  // Band too short for an inner crop (estimated/fallback geometry on small images):
  // keep the existing adaptive-padding behaviour so minimum-size guards still hold.
  const hPad = detection.method === "fallback" ? FALLBACK_H_PAD : CELL_H_PAD;
  const vPad = detection.method === "fallback" ? FALLBACK_V_PAD : CELL_V_PAD;
  return finalCropRect(wc.x, wc.x + wc.w, band.top, band.bottom, hPad, vPad);
}

/**
 * Compute the final padded crop rects for each split-mark sub-zone of a given row.
 *
 * Strategy:
 * 1. Determine the 3 zone x-boundaries from detected splitZoneDividers (preferred)
 *    or equal-width division (fallback).
 * 2. Apply ZONE_DIV_PAD inward from each internal divider (clears the divider line +
 *    JPEG ringing), and CELL_H_PAD from the outer column borders.
 * 3. Apply CELL_V_PAD vertically (same for all zones in the same row).
 */
export function computeSplitZoneRects(
  detection: TableDetectionResult,
  rowIndex: number,
  imgW = 0,
  imgH = 0,
): PixelRect[] {
  const row = detection.dataRows[rowIndex];
  const sc = detection.splitMarkCol;
  const isFallback = detection.method === "fallback";

  if (!row) {
    const zoneW = sc.w / 3;
    const zonePad = isFallback ? FALLBACK_H_PAD : ZONE_DIV_PAD;
    const rowVPad = isFallback ? FALLBACK_V_PAD : CELL_V_PAD;
    return Array.from({ length: 3 }, (_, i) =>
      finalCropRect(
        sc.x + i * zoneW, sc.x + (i + 1) * zoneW,
        Math.round(LAYOUT.tableStartFrac * imgH + LAYOUT.tableHeaderHFrac * imgH + rowIndex * LAYOUT.dataRowHFrac * imgH),
        Math.round(LAYOUT.tableStartFrac * imgH + LAYOUT.tableHeaderHFrac * imgH + (rowIndex + 1) * LAYOUT.dataRowHFrac * imgH),
        zonePad, rowVPad,
      ),
    );
  }

  const splitLeft = sc.x;
  const splitRight = sc.x + sc.w;
  // Use the inner 20â€“80% of the (possibly reconstructed) row band so the printed
  // top/bottom row borders are excluded from the split-zone crops.
  const band = effectiveRowBand(detection, rowIndex, imgH);
  const useInner = band.height >= MIN_ROW_BAND_H;
  const rowTop = useInner ? Math.round(band.top + band.height * 0.2) : band.top;
  const rowBottom = useInner ? Math.round(band.top + band.height * 0.8) : band.bottom;

  // Filter dividers to those within this split column
  const dividers = detection.splitZoneDividers
    .filter((x) => x > splitLeft && x < splitRight)
    .sort((a, b) => a - b);

  // Build 3 zone x-ranges: [left, right) pairs for each zone
  let zones: Array<[number, number, "outer-left" | "outer-right" | "inner", "outer-left" | "outer-right" | "inner"]>;

  if (dividers.length >= 2) {
    // Use detected dividers â€” each internal boundary uses ZONE_DIV_PAD,
    // outer boundaries use CELL_H_PAD.
    zones = [
      [splitLeft, dividers[0]!, "outer-left", "inner"],
      [dividers[0]!, dividers[1]!, "inner", "inner"],
      [dividers[1]!, splitRight, "inner", "outer-right"],
    ];
  } else if (dividers.length === 1) {
    // One detected divider: anchor it, split the remainder equally
    const d0 = dividers[0]!;
    const rightHalf = (splitRight - d0) / 2;
    const midPoint = Math.round(d0 + rightHalf);
    zones = [
      [splitLeft, d0, "outer-left", "inner"],
      [d0, midPoint, "inner", "inner"],
      [midPoint, splitRight, "inner", "outer-right"],
    ];
  } else {
    // No dividers: equal division
    const zoneW = (splitRight - splitLeft) / 3;
    zones = [
      [splitLeft, Math.round(splitLeft + zoneW), "outer-left", "inner"],
      [Math.round(splitLeft + zoneW), Math.round(splitLeft + 2 * zoneW), "inner", "inner"],
      [Math.round(splitLeft + 2 * zoneW), splitRight, "inner", "outer-right"],
    ];
  }

  const outerHPad = isFallback ? FALLBACK_H_PAD : CELL_H_PAD;
  const innerHPad = isFallback ? FALLBACK_H_PAD : ZONE_DIV_PAD;
  const rowVPad  = isFallback ? FALLBACK_V_PAD : CELL_V_PAD;
  const rawH = rowBottom - rowTop;
  const effectiveV = rawH - 2 * rowVPad >= MIN_CROP_H
    ? rowVPad
    : Math.max(0, Math.floor((rawH - MIN_CROP_H) / 2));

  return zones.map(([x1, x2, leftType, rightType]) => {
    const leftPad  = leftType  === "outer-left"  ? outerHPad : innerHPad;
    const rightPad = rightType === "outer-right" ? outerHPad : innerHPad;
    const rawW = x2 - x1;
    const usable = rawW - leftPad - rightPad;
    const effectiveL = usable >= MIN_CROP_W ? leftPad : Math.max(0, Math.floor((rawW - MIN_CROP_W) / 2));
    const effectiveR = usable >= MIN_CROP_W ? rightPad : Math.max(0, Math.floor((rawW - MIN_CROP_W) / 2));
    return {
      x: Math.max(0, x1 + effectiveL),
      y: Math.max(0, rowTop + effectiveV),
      w: Math.max(1, rawW - effectiveL - effectiveR),
      h: Math.max(1, rawH - 2 * effectiveV),
    };
  });
}

/**
 * Compute the full split-cell crop rect (spans all 3 zones) for preview purposes.
 */
export function computeSplitFullRect(
  detection: TableDetectionResult,
  rowIndex: number,
): PixelRect {
  const sc = detection.splitMarkCol;
  const band = effectiveRowBand(detection, rowIndex);
  if (band.height >= MIN_ROW_BAND_H) {
    return innerRowBandRect(band.top, band.bottom, sc.x, sc.w);
  }
  const hPad = detection.method === "fallback" ? FALLBACK_H_PAD : CELL_H_PAD;
  const vPad = detection.method === "fallback" ? FALLBACK_V_PAD : CELL_V_PAD;
  return finalCropRect(sc.x, sc.x + sc.w, band.top, band.bottom, hPad, vPad);
}

// â”€â”€ Fallback crop candidates â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//
// When the primary (computed) crop lands on a row border, a blank cell, or a
// horizontal grid line instead of the handwritten mark, these helpers generate
// alternative crop rectangles. The extraction service scores each candidate and
// sends only the best (border/blank-free) crop to OCR.

export type CropStrategy =
  | "original"
  | "shrink"
  | "shift-down"
  | "shift-up"
  | "center-inner"
  | "zone-left"
  | "zone-right"
  | "ink-band";

export type CropCandidate = { strategy: CropStrategy; rect: PixelRect };

/** Clamp a rect to image bounds, guaranteeing positive width/height. */
function clampRect(rect: PixelRect, imgW: number, imgH: number): PixelRect {
  const x = Math.max(0, Math.min(rect.x, Math.max(0, imgW - 1)));
  const y = Math.max(0, Math.min(rect.y, Math.max(0, imgH - 1)));
  const w = Math.max(1, Math.min(rect.w, imgW - x));
  const h = Math.max(1, Math.min(rect.h, imgH - y));
  return { x, y, w, h };
}

/**
 * Generate fallback crop candidates for a Written Mark cell.
 *
 * Order matters: "original" comes first so it wins ties (a crop is only replaced
 * by a strictly better-scoring candidate). The fallbacks progressively move the
 * crop away from printed borders:
 *   - shrink:       pull in from all four borders
 *   - shift-down:   drop below the top row line
 *   - shift-up:     trim the bottom row line
 *   - center-inner: tight crop on the cell centre (away from every border)
 */
export function generateWrittenCropCandidates(
  base: PixelRect,
  imgW: number,
  imgH: number,
): CropCandidate[] {
  const shrinkX = Math.max(2, Math.round(base.w * 0.12));
  const shrinkY = Math.max(2, Math.round(base.h * 0.18));
  const shiftY = Math.max(2, Math.round(base.h * 0.22));
  const centerX = Math.max(2, Math.round(base.w * 0.2));
  const centerY = Math.max(2, Math.round(base.h * 0.25));

  const raw: CropCandidate[] = [
    { strategy: "original", rect: base },
    {
      strategy: "shrink",
      rect: { x: base.x + shrinkX, y: base.y + shrinkY, w: base.w - 2 * shrinkX, h: base.h - 2 * shrinkY },
    },
    {
      strategy: "shift-down",
      rect: { x: base.x, y: base.y + shiftY, w: base.w, h: base.h - shiftY },
    },
    {
      strategy: "shift-up",
      rect: { x: base.x, y: base.y, w: base.w, h: base.h - shiftY },
    },
    {
      strategy: "center-inner",
      rect: { x: base.x + centerX, y: base.y + centerY, w: base.w - 2 * centerX, h: base.h - 2 * centerY },
    },
  ];

  return raw.map((candidate) => ({
    strategy: candidate.strategy,
    rect: clampRect(candidate.rect, imgW, imgH),
  }));
}

/**
 * Generate fallback crop candidates for a single split-mark zone.
 *
 * Includes the same vertical recrops as the written cell plus left/right
 * half-zone crops, used when a digit sits to one side of the zone or when a
 * divider line contaminates one edge.
 */
export function generateSplitZoneCropCandidates(
  base: PixelRect,
  imgW: number,
  imgH: number,
): CropCandidate[] {
  const written = generateWrittenCropCandidates(base, imgW, imgH);
  const halfW = Math.max(1, Math.round(base.w * 0.55));

  const zoneCandidates: CropCandidate[] = [
    { strategy: "zone-left", rect: { x: base.x, y: base.y, w: halfW, h: base.h } },
    { strategy: "zone-right", rect: { x: base.x + (base.w - halfW), y: base.y, w: halfW, h: base.h } },
  ];

  return [
    ...written,
    ...zoneCandidates.map((candidate) => ({
      strategy: candidate.strategy,
      rect: clampRect(candidate.rect, imgW, imgH),
    })),
  ];
}

/**
 * @deprecated Use computeWrittenMarkCropRect or computeSplitZoneRects instead.
 * Kept for backward compatibility with unit tests.
 */
export function detectedCellRect(
  detection: TableDetectionResult,
  col: "writtenMark" | "splitMark",
  rowIndex: number,
  imgW: number,
  imgH: number,
  inset = 0.15,
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

