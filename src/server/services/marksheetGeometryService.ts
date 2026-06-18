// Template geometry for the School Connect A4 handwritten marksheet.
//
// Based on PrintableMarksheet.tsx + index.css print rules:
//   @page { size: A4 portrait; margin: 8mm; }
//   Table cols (px): No(32) Adm(78) Name(~343) Written(88) Split(82) Remarks(110) = 733 total
//   Print row height: 20px; table font-size: 8px
//
// All column fractions are relative to the usable content width (194 mm = 733 px at 96 dpi).
// All vertical fractions are relative to the full scanned page height.

const TABLE_WIDTH_PX = 733;

/** Horizontal margin as fraction of page width (8mm / 210mm). */
export const PAGE_MARGIN_LEFT_FRAC = 8 / 210;
/** Usable content width as fraction of page width (194mm / 210mm). */
export const TABLE_WIDTH_FRAC = 194 / 210;

/** Column definitions â€” x and w are fractions of usable TABLE width. */
export const COLUMNS = {
  number:      { x:   0 / TABLE_WIDTH_PX, w:  32 / TABLE_WIDTH_PX },
  admNumber:   { x:  32 / TABLE_WIDTH_PX, w:  78 / TABLE_WIDTH_PX },
  studentName: { x: 110 / TABLE_WIDTH_PX, w: 343 / TABLE_WIDTH_PX },
  writtenMark: { x: 453 / TABLE_WIDTH_PX, w:  88 / TABLE_WIDTH_PX },
  splitMark:   { x: 541 / TABLE_WIDTH_PX, w:  82 / TABLE_WIDTH_PX },
  remarks:     { x: 623 / TABLE_WIDTH_PX, w: 110 / TABLE_WIDTH_PX },
} as const;

/**
 * Vertical layout as fractions of the full A4 page height (297mm).
 *
 * Header block (~193 px at 96 dpi out of ~1122 px total page):
 *   - School name title row (~18 px)
 *   - "ACADEMIC MARKSHEET" row (~15 px)
 *   - Meta grid 8 items Ã— ~12.7 px + padding = ~59 px
 *   - Signature section 3 rows Ã— ~22 px + padding = ~70 px
 *   - Box padding/margin = ~13 px
 *   Total â‰ˆ 175 px â†’ ~15.6% of 1122 px
 *
 * We use slightly conservative estimates to account for real-world scan variation.
 */
export const LAYOUT = {
  /** Y where usable content starts â€” top margin (8mm/297mm). */
  marginTopFrac: 8 / 297,
  /** Approximate header block height as fraction of page. */
  headerHFrac: 0.195,
  /** Table starts just after header (margin + header). */
  tableStartFrac: 8 / 297 + 0.195,
  /** Table column-labels row height as fraction of page. */
  tableHeaderHFrac: 0.024,
  /** Each student data row height as fraction of page (20 px / 1122 px). */
  dataRowHFrac: 20 / 1122,
} as const;

export type PixelRect = { x: number; y: number; w: number; h: number };

/**
 * Convert a column + row (in fractional page coordinates) to absolute pixel coords.
 *
 * @param col      Column from COLUMNS
 * @param rowFrac  { yFrac, hFrac } for this row (page-relative)
 * @param imgW     Scanned image width in pixels
 * @param imgH     Scanned image height in pixels
 * @param inset    Fractional inset applied on each side to avoid cell borders (default 8%)
 */
export function cellToPixel(
  col: { x: number; w: number },
  rowFrac: { yFrac: number; hFrac: number },
  imgW: number,
  imgH: number,
  inset = 0.15,
): PixelRect {
  const tableLeft = PAGE_MARGIN_LEFT_FRAC * imgW;
  const tableWidth = TABLE_WIDTH_FRAC * imgW;

  const rawX = tableLeft + col.x * tableWidth;
  const rawW = col.w * tableWidth;
  const rawY = rowFrac.yFrac * imgH;
  const rawH = rowFrac.hFrac * imgH;

  const x = Math.max(0, Math.round(rawX + inset * rawW));
  const y = Math.max(0, Math.round(rawY + inset * rawH));
  const w = Math.max(1, Math.round(rawW * (1 - 2 * inset)));
  const h = Math.max(1, Math.round(rawH * (1 - 2 * inset)));

  const clampedW = Math.min(w, imgW - x);
  const clampedH = Math.min(h, imgH - y);

  return { x, y, w: Math.max(1, clampedW), h: Math.max(1, clampedH) };
}

/**
 * Return the fractional Y region for student row `index` (0-indexed).
 * Row 0 is the first student row (below the table column-label header).
 */
export function dataRowRegion(index: number): { yFrac: number; hFrac: number } {
  return {
    yFrac: LAYOUT.tableStartFrac + LAYOUT.tableHeaderHFrac + index * LAYOUT.dataRowHFrac,
    hFrac: LAYOUT.dataRowHFrac,
  };
}

export function splitRectIntoVerticalZones(rect: PixelRect, zones = 3): PixelRect[] {
  const safeZones = Math.max(1, Math.floor(zones));
  const baseWidth = rect.w / safeZones;

  return Array.from({ length: safeZones }, (_, index) => {
    const left = Math.round(rect.x + index * baseWidth);
    const right = index === safeZones - 1
      ? rect.x + rect.w
      : Math.round(rect.x + (index + 1) * baseWidth);
    return {
      x: left,
      y: rect.y,
      w: Math.max(1, right - left),
      h: rect.h,
    };
  });
}

export function tableToPixel(imgW: number, imgH: number): PixelRect {
  return {
    x: Math.max(0, Math.round(PAGE_MARGIN_LEFT_FRAC * imgW)),
    y: Math.max(0, Math.round(LAYOUT.tableStartFrac * imgH)),
    w: Math.max(1, Math.round(TABLE_WIDTH_FRAC * imgW)),
    h: Math.max(1, Math.round((LAYOUT.tableHeaderHFrac + LAYOUT.dataRowHFrac * 26) * imgH)),
  };
}

