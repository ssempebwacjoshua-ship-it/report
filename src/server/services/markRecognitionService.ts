import { createWorker } from "tesseract.js";
import type { Worker } from "tesseract.js";

// Singleton Tesseract worker — initialised once, reused across requests.
// Tesseract language data download happens on first call (~1-2 seconds).
let _worker: Worker | null = null;
let _workerBusy = false;

async function acquireWorker(): Promise<Worker> {
  if (_worker) return _worker;
  _worker = await createWorker("eng", 1, {
    logger: () => {},
  });
  await _worker.setParameters({
    // Whitelist: digits, AB (absent), EX (exempt), spaces
    tessedit_char_whitelist: "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz ",
    // PSM 7 = single text line
    tessedit_pageseg_mode: "7",
  });
  return _worker;
}

export async function terminateOcrWorker(): Promise<void> {
  if (_worker) {
    await _worker.terminate();
    _worker = null;
  }
}

// ── Public types ─────────────────────────────────────────────────────────────

export type RecognizedCell = {
  rawText: string;
  normalizedMark: string;
  confidence: number;
};

// ── Mark normalisation ────────────────────────────────────────────────────────

/**
 * Normalise raw OCR text from a mark cell into a canonical mark string.
 *
 * Rules:
 * - "AB" / "A8" / "AB." → "AB"   (absent)
 * - "EX" → "EX"                  (exempt)
 * - digits 0-100 → numeric string (e.g. "82")
 * - OCR noise around digits: strip non-digit chars, re-parse
 * - Blank / unreadable → ""       (missing — not zero)
 */
export function normalizeMark(rawText: string): string {
  const t = rawText.replace(/\s+/g, "").toUpperCase();
  if (!t) return "";

  // Absent: OCR often reads "8" for "B" → accept A8/AB
  if (t === "AB" || t === "A8" || t === "A B") return "AB";
  // Exempt
  if (t === "EX") return "EX";

  // Try direct numeric parse first (handles "82", "100", "0")
  const direct = Number(t);
  if (!Number.isNaN(direct) && Number.isInteger(direct) && direct >= 0 && direct <= 100) {
    return String(direct);
  }

  // Strip non-numeric characters and retry (handles "82.", "8 2", ".82")
  const stripped = t.replace(/[^0-9]/g, "");
  if (stripped.length > 0 && stripped.length <= 3) {
    const n = Number(stripped);
    if (!Number.isNaN(n) && n >= 0 && n <= 100) return String(n);
  }

  return "";
}

/**
 * Parse the best visible mark from a split-mark cell.
 *
 * The split mark cell may contain up to three sub-columns (partial totals).
 * We prefer the LAST non-empty number (rightmost, which is typically the total).
 */
export function parseSplitCellText(rawText: string): string {
  // Split on whitespace and pipe-like characters
  const tokens = rawText.split(/[\s|/\\]+/).filter(Boolean);
  // Try each token from right to left, return first valid mark
  for (const tok of [...tokens].reverse()) {
    const n = normalizeMark(tok);
    if (n !== "") return n;
  }
  return normalizeMark(rawText);
}

// ── OCR functions ─────────────────────────────────────────────────────────────

/**
 * Run OCR on a written-mark cell buffer.
 * Returns the normalised mark and raw confidence score (0-1).
 */
export async function recognizeWrittenMark(cellBuffer: Buffer): Promise<RecognizedCell> {
  try {
    while (_workerBusy) await new Promise((r) => setTimeout(r, 20));
    _workerBusy = true;
    const worker = await acquireWorker();
    const result = await worker.recognize(cellBuffer);
    _workerBusy = false;

    const rawText = result.data.text.trim();
    const confidence = result.data.confidence / 100;
    const normalizedMark = normalizeMark(rawText);

    return { rawText, normalizedMark, confidence };
  } catch {
    _workerBusy = false;
    return { rawText: "", normalizedMark: "", confidence: 0 };
  }
}

/**
 * Run OCR on a split-mark cell buffer.
 * Handles multi-column sub-totals; returns the dominant total mark.
 */
export async function recognizeSplitMark(cellBuffer: Buffer): Promise<RecognizedCell> {
  try {
    while (_workerBusy) await new Promise((r) => setTimeout(r, 20));
    _workerBusy = true;
    const worker = await acquireWorker();
    const result = await worker.recognize(cellBuffer);
    _workerBusy = false;

    const rawText = result.data.text.trim();
    const confidence = result.data.confidence / 100;
    const normalizedMark = parseSplitCellText(rawText);

    return { rawText, normalizedMark, confidence };
  } catch {
    _workerBusy = false;
    return { rawText: "", normalizedMark: "", confidence: 0 };
  }
}

/**
 * OCR a full-block buffer (e.g., the marksheet header region).
 * Uses PSM 6 (single uniform block) instead of PSM 7 (single line).
 * Returns raw text and confidence; the caller extracts structured fields.
 */
export async function recognizeBlockText(buffer: Buffer): Promise<{ text: string; confidence: number }> {
  try {
    while (_workerBusy) await new Promise((r) => setTimeout(r, 20));
    _workerBusy = true;
    const worker = await acquireWorker();
    // Switch to block mode for multi-line header text
    await worker.setParameters({ tessedit_pageseg_mode: "6" });
    const result = await worker.recognize(buffer);
    // Restore single-line mode for subsequent mark cell reads
    await worker.setParameters({ tessedit_pageseg_mode: "7" });
    _workerBusy = false;
    return { text: result.data.text, confidence: result.data.confidence / 100 };
  } catch {
    _workerBusy = false;
    return { text: "", confidence: 0 };
  }
}
