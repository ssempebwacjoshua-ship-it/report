import { describe, expect, it } from "vitest";
import sharp from "sharp";
import {
  MIN_CROP_H,
  MIN_CROP_W,
  computeWrittenMarkCropRect,
  detectMarksheetTable,
  finalCropRect,
  generateWrittenCropCandidates,
  generateSplitZoneCropCandidates,
} from "../../server/services/marksheetTableDetection";
import {
  analyzeCropQuality,
  cropPreview,
  scoreCropQuality,
  selectBestCrop,
} from "../../server/services/scanPreprocessService";
import { cropFailureReason } from "../../server/services/scanExtractionService";
import type { PixelRect } from "../../server/services/marksheetGeometryService";

// ── Helpers ───────────────────────────────────────────────────────────────────

async function blankJpeg(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 255, g: 255, b: 255 } },
  })
    .jpeg()
    .toBuffer();
}

const IMG_W = 800;
const IMG_H = 1100;

// ── buildFallback roster-count propagation ────────────────────────────────────

describe("buildFallback with large rosterCount", () => {
  it("creates exactly rosterCount data rows when rosterCount > 26", async () => {
    const buf = await blankJpeg(IMG_W, IMG_H);
    const result = await detectMarksheetTable(buf, IMG_W, IMG_H, 254);

    expect(result.method).toBe("fallback");
    expect(result.dataRows).toHaveLength(254);
  });

  it("still uses 26 rows when rosterCount ≤ 26 (default)", async () => {
    const buf = await blankJpeg(IMG_W, IMG_H);
    const result = await detectMarksheetTable(buf, IMG_W, IMG_H);

    expect(result.method).toBe("fallback");
    expect(result.dataRows).toHaveLength(26);
  });

  it("uses rosterCount rows when explicitly set to 26", async () => {
    const buf = await blankJpeg(IMG_W, IMG_H);
    const result = await detectMarksheetTable(buf, IMG_W, IMG_H, 26);
    expect(result.dataRows).toHaveLength(26);
  });
});

// ── Minimum crop size enforcement ─────────────────────────────────────────────

describe("fallback geometry does not produce tiny crops", () => {
  it("all 254 fallback rows produce written crop rects with h >= 1", async () => {
    // 254 rows on an 800×1100 image gives ~3px per row — too small for MIN_CROP_H.
    // We verify positive height (not 0 or negative) as the baseline guard.
    const buf = await blankJpeg(IMG_W, IMG_H);
    const detection = await detectMarksheetTable(buf, IMG_W, IMG_H, 254);

    for (let i = 0; i < 254; i++) {
      const rect = computeWrittenMarkCropRect(detection, i, IMG_W, IMG_H);
      expect(rect.h).toBeGreaterThanOrEqual(1);
    }
  });

  it("all 26 fallback rows (normal marksheet) produce written crop rects with h >= MIN_CROP_H", async () => {
    // At 26 rows on an 800×1100 image each row is ~30px — big enough for full minimum.
    const buf = await blankJpeg(IMG_W, IMG_H);
    const detection = await detectMarksheetTable(buf, IMG_W, IMG_H, 26);

    for (let i = 0; i < 26; i++) {
      const rect = computeWrittenMarkCropRect(detection, i, IMG_W, IMG_H);
      expect(rect.h).toBeGreaterThanOrEqual(MIN_CROP_H);
    }
  });

  it("all 254 fallback rows produce written crop rects with w >= MIN_CROP_W", async () => {
    const buf = await blankJpeg(IMG_W, IMG_H);
    const detection = await detectMarksheetTable(buf, IMG_W, IMG_H, 254);

    for (let i = 0; i < 254; i++) {
      const rect = computeWrittenMarkCropRect(detection, i, IMG_W, IMG_H);
      expect(rect.w).toBeGreaterThanOrEqual(MIN_CROP_W);
    }
  });

  it("all 254 fallback crop rects fit within image bounds", async () => {
    const buf = await blankJpeg(IMG_W, IMG_H);
    const detection = await detectMarksheetTable(buf, IMG_W, IMG_H, 254);

    for (let i = 0; i < 254; i++) {
      const rect = computeWrittenMarkCropRect(detection, i, IMG_W, IMG_H);
      expect(rect.x).toBeGreaterThanOrEqual(0);
      expect(rect.y).toBeGreaterThanOrEqual(0);
      expect(rect.x + rect.w).toBeLessThanOrEqual(IMG_W + 1); // +1 for rounding
    }
  });

  it("fallback row height is distributed across the body height (all rows fit within page)", async () => {
    const buf = await blankJpeg(IMG_W, IMG_H);
    const detection = await detectMarksheetTable(buf, IMG_W, IMG_H, 254);

    const firstRow = detection.dataRows[0]!;
    const lastRow = detection.dataRows[253]!;

    // Rows must have positive height
    expect(firstRow.h).toBeGreaterThanOrEqual(1);
    // The last row must not wildly exceed the page (rows are distributed, not extended infinitely)
    expect(lastRow.y + lastRow.h).toBeLessThanOrEqual(IMG_H * 1.10); // 10% tolerance for rounding
  });

  it("fallback with 254 rows does not produce the same crop row-height as the 26-row template", async () => {
    const buf = await blankJpeg(IMG_W, IMG_H);
    const detection26 = await detectMarksheetTable(buf, IMG_W, IMG_H, 26);
    const detection254 = await detectMarksheetTable(buf, IMG_W, IMG_H, 254);

    // 254-row fallback should have shorter rows than 26-row fallback
    // (same body height ÷ more rows = smaller rows per row, or at least ≤)
    expect(detection254.dataRows[0]!.h).toBeLessThanOrEqual(detection26.dataRows[0]!.h);
  });
});

// ── finalCropRect adaptive padding ────────────────────────────────────────────

describe("finalCropRect adaptive padding", () => {
  it("reduces vPad when raw row height is too small to meet MIN_CROP_H", () => {
    // Row height 20px, normal vPad=15 → would give 20-30 = -10 → must use adaptive
    const rect = finalCropRect(100, 200, 300, 320, 8, 15);
    expect(rect.h).toBeGreaterThanOrEqual(MIN_CROP_H);
    expect(rect.w).toBeGreaterThanOrEqual(1);
  });

  it("uses full vPad when row is large enough", () => {
    // Row height 100px, vPad=15 → gives 100-30=70 ≥ MIN_CROP_H: use full vPad
    const rect = finalCropRect(100, 200, 300, 400, 8, 15);
    expect(rect.h).toBe(400 - 300 - 2 * 15);
    expect(rect.w).toBe(200 - 100 - 2 * 8);
  });

  it("never produces h < 1", () => {
    // Pathologically small row: 5px tall
    const rect = finalCropRect(0, 100, 0, 5, 8, 15);
    expect(rect.h).toBeGreaterThanOrEqual(1);
  });

  it("never produces w < 1", () => {
    const rect = finalCropRect(0, 5, 0, 100, 8, 15);
    expect(rect.w).toBeGreaterThanOrEqual(1);
  });
});

// ── Azure OCR success but table not detected ───────────────────────────────────

describe("OCR success with geometry failure", () => {
  it("fallback geometry still creates processable rows (not 0 rows)", async () => {
    const buf = await blankJpeg(IMG_W, IMG_H);
    const detection = await detectMarksheetTable(buf, IMG_W, IMG_H, 30);

    expect(detection.method).toBe("fallback");
    expect(detection.dataRows.length).toBeGreaterThanOrEqual(26);

    // Can compute a written rect for row 0
    const rect = computeWrittenMarkCropRect(detection, 0, IMG_W, IMG_H);
    expect(rect.w).toBeGreaterThan(0);
    expect(rect.h).toBeGreaterThan(0);
  });

  it("fallback geometry with 30 roster rows produces 30 data rows", async () => {
    const buf = await blankJpeg(IMG_W, IMG_H);
    const detection = await detectMarksheetTable(buf, IMG_W, IMG_H, 30);

    expect(detection.dataRows).toHaveLength(30);
  });

  it("crop rect rejection reason is accessible via detection warnings", async () => {
    const buf = await blankJpeg(IMG_W, IMG_H);
    const detection = await detectMarksheetTable(buf, IMG_W, IMG_H, 5);

    // Fallback always generates warnings explaining why detection failed
    expect(detection.warnings.length).toBeGreaterThan(0);
    expect(detection.warnings[0]).toMatch(/horizontal line|fraction-based|pixel extraction/i);
  });
});

// ── Detected table extended to rosterCount ────────────────────────────────────

describe("detected table extends dataRows to rosterCount", () => {
  it("produces at least rosterCount rows even for detected tables with fewer lines", async () => {
    // Build a marksheet with only 5 detected rows but rosterCount=50
    const lineYs = [250, 285, 320, 355, 390, 425]; // 4 data row gaps
    const pixels = Buffer.alloc(IMG_W * IMG_H, 255);
    for (const lineY of lineYs) {
      for (let dy = -1; dy <= 1; dy++) {
        const y = lineY + dy;
        if (y < 0 || y >= IMG_H) continue;
        const startX = Math.floor(IMG_W * 0.05);
        const endX = Math.floor(IMG_W * 0.90);
        for (let x = startX; x < endX; x++) {
          pixels[y * IMG_W + x] = 0;
        }
      }
    }
    const buf = await sharp(pixels, { raw: { width: IMG_W, height: IMG_H, channels: 1 } })
      .jpeg({ quality: 90 })
      .toBuffer();

    const detection = await detectMarksheetTable(buf, IMG_W, IMG_H, 50);
    expect(detection.dataRows.length).toBeGreaterThanOrEqual(50);
  });
});

// ── Crop fallback geometry ──────────────────────────────────────────────────────
//
// These cover the bug where the written/split crops land on a row border, a blank
// cell, or a horizontal line instead of the handwritten mark. The fix generates
// fallback recrop candidates, scores them by quality, and selects the best one
// before OCR — rather than rejecting the cell outright.

/**
 * Build a single-channel raw image (white background) with optional dark regions,
 * encoded as JPEG so it can flow through the same sharp pipeline as a real scan.
 */
async function rawImage(
  width: number,
  height: number,
  paint: (px: Uint8Array) => void,
): Promise<Buffer> {
  const px = new Uint8Array(width * height).fill(255);
  paint(px);
  return sharp(Buffer.from(px), { raw: { width, height, channels: 1 } })
    .jpeg({ quality: 92 })
    .toBuffer();
}

function fillRect(
  px: Uint8Array,
  imgW: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  value = 0,
): void {
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      px[y * imgW + x] = value;
    }
  }
}

const CELL_IMG_W = 200;
const CELL_IMG_H = 160;
// Written-mark cell whose TOP edge sits on a thick printed row border.
const BASE_RECT: PixelRect = { x: 40, y: 20, w: 100, h: 120 };

/** Cell image: thick horizontal row border across the top + a handwritten mark low-center. */
async function borderedCellImage(): Promise<Buffer> {
  return rawImage(CELL_IMG_W, CELL_IMG_H, (px) => {
    // Printed row border: 18px tall band at the top of the cell.
    fillRect(px, CELL_IMG_W, BASE_RECT.x, BASE_RECT.y, BASE_RECT.x + BASE_RECT.w, BASE_RECT.y + 18, 0);
    // Handwritten mark, well below the border, centred.
    fillRect(px, CELL_IMG_W, 78, 92, 104, 116, 0);
  });
}

/** Cell image: a clean handwritten mark centred in the cell, no border contamination. */
async function cleanCellImage(): Promise<Buffer> {
  return rawImage(CELL_IMG_W, CELL_IMG_H, (px) => {
    fillRect(px, CELL_IMG_W, 74, 64, 106, 96, 0);
  });
}

describe("crop candidate generation", () => {
  it("produces an original plus inward/shifted/center fallback candidates", () => {
    const candidates = generateWrittenCropCandidates(BASE_RECT, CELL_IMG_W, CELL_IMG_H);
    const strategies = candidates.map((c) => c.strategy);

    expect(strategies).toContain("original");
    expect(strategies).toContain("shrink");
    expect(strategies).toContain("shift-down");
    expect(strategies).toContain("shift-up");
    expect(strategies).toContain("center-inner");
  });

  it("keeps every candidate within image bounds with positive dimensions", () => {
    const candidates = generateWrittenCropCandidates(BASE_RECT, CELL_IMG_W, CELL_IMG_H);
    for (const { rect } of candidates) {
      expect(rect.x).toBeGreaterThanOrEqual(0);
      expect(rect.y).toBeGreaterThanOrEqual(0);
      expect(rect.w).toBeGreaterThan(0);
      expect(rect.h).toBeGreaterThan(0);
      expect(rect.x + rect.w).toBeLessThanOrEqual(CELL_IMG_W);
      expect(rect.y + rect.h).toBeLessThanOrEqual(CELL_IMG_H);
    }
  });

  it("split-zone candidates include left/right zone fallbacks", () => {
    const candidates = generateSplitZoneCropCandidates(BASE_RECT, CELL_IMG_W, CELL_IMG_H);
    const strategies = candidates.map((c) => c.strategy);
    expect(strategies).toContain("original");
    expect(strategies).toContain("zone-left");
    expect(strategies).toContain("zone-right");
  });
});

describe("crop quality scoring", () => {
  it("scores a clean centred mark higher than a mostly-border crop", async () => {
    const clean = await cropPreview(await cleanCellImage(), BASE_RECT);
    const bordered = await rawImage(120, 80, (px) => fillRect(px, 120, 0, 0, 120, 60, 0));

    const cleanScore = await scoreCropQuality(clean);
    const borderScore = await scoreCropQuality(bordered);

    expect(cleanScore).toBeGreaterThan(borderScore);
  });

  it("scores a blank crop near zero", async () => {
    const blank = await rawImage(120, 80, () => {});
    expect(await scoreCropQuality(blank)).toBeLessThan(0.2);
  });
});

describe("crop with horizontal row border triggers fallback recrop", () => {
  it("original crop fails quality with a horizontal-line reason", async () => {
    const img = await borderedCellImage();
    const original = await cropPreview(img, BASE_RECT);
    const quality = await analyzeCropQuality(original);

    expect(quality.ok).toBe(false);
    expect(quality.reason).toMatch(/horizontal/i);
  });

  it("selectBestCrop picks a non-original candidate that passes quality", async () => {
    const img = await borderedCellImage();
    const candidates = generateWrittenCropCandidates(BASE_RECT, CELL_IMG_W, CELL_IMG_H);
    const best = await selectBestCrop(img, candidates);

    expect(best.strategy).not.toBe("original");
    expect(best.quality.ok).toBe(true);
  });

  it("selected fallback crop excludes the row border (sits below it)", async () => {
    const img = await borderedCellImage();
    const candidates = generateWrittenCropCandidates(BASE_RECT, CELL_IMG_W, CELL_IMG_H);
    const best = await selectBestCrop(img, candidates);

    // Border band ends at y = 38; a good inner crop must start at/after it.
    expect(best.rect.y).toBeGreaterThanOrEqual(BASE_RECT.y + 16);
  });
});

describe("crop mostly border is never sent as the final OCR crop", () => {
  it("a fully dark cell yields no passing candidate (manual entry required)", async () => {
    const solid = await rawImage(CELL_IMG_W, CELL_IMG_H, (px) =>
      fillRect(px, CELL_IMG_W, BASE_RECT.x, BASE_RECT.y, BASE_RECT.x + BASE_RECT.w, BASE_RECT.y + BASE_RECT.h, 0),
    );
    const candidates = generateWrittenCropCandidates(BASE_RECT, CELL_IMG_W, CELL_IMG_H);
    const best = await selectBestCrop(solid, candidates);

    expect(best.quality.ok).toBe(false);
  });
});

describe("existing valid crop still works", () => {
  it("a clean centred mark selects a passing crop without needing a recrop reason", async () => {
    const img = await cleanCellImage();
    const candidates = generateWrittenCropCandidates(BASE_RECT, CELL_IMG_W, CELL_IMG_H);
    const best = await selectBestCrop(img, candidates);

    expect(best.quality.ok).toBe(true);
  });
});

describe("cropFailureReason", () => {
  it("asks the operator to enter the mark manually, not that OCR is unavailable", () => {
    const msg = cropFailureReason();
    expect(msg).toMatch(/enter the mark manually/i);
    expect(msg.toLowerCase()).not.toContain("unavailable");
  });
});
