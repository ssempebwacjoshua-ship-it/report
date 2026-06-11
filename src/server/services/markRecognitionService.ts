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
  return _worker;
}

async function recognizeWithParameters(
  buffer: Buffer,
  params: Record<string, string>,
): Promise<{ text: string; confidence: number }> {
  try {
    while (_workerBusy) await new Promise((r) => setTimeout(r, 20));
    _workerBusy = true;
    const worker = await acquireWorker();
    await worker.setParameters(params);
    const result = await worker.recognize(buffer);
    _workerBusy = false;
    return { text: result.data.text.trim(), confidence: result.data.confidence / 100 };
  } catch {
    _workerBusy = false;
    return { text: "", confidence: 0 };
  }
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

export type RecognizedSplitZones = RecognizedCell & {
  zoneRawText: string[];
  zoneMarks: string[];
  zoneConfidences: number[];
};

const MARK_OCR_PARAMS = {
  tessedit_char_whitelist: "0123456789ABEX",
  tessedit_pageseg_mode: "7",
};

const SINGLE_ZONE_OCR_PARAMS = {
  tessedit_char_whitelist: "0123456789ABEX",
  tessedit_pageseg_mode: "10",
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

export function parseSplitZoneTexts(zoneTexts: string[]): string {
  const zoneMarks = zoneTexts.map((text) => normalizeMark(text));
  const nonEmpty = zoneMarks.filter(Boolean);

  if (nonEmpty.includes("AB")) return "AB";
  if (nonEmpty.includes("EX")) return "EX";

  // Check if individual zone characters spell out AB or EX (e.g. ["A","B",""] → "AB")
  const joinedLetters = zoneTexts
    .join("")
    .replace(/\s+/g, "")
    .toUpperCase()
    .replace(/[^ABEX0-9]/g, "");
  if (joinedLetters === "AB" || joinedLetters === "A8") return "AB";
  if (joinedLetters === "EX") return "EX";

  if (nonEmpty.length === 0) return "";

  const digitParts = zoneTexts
    .map((text) => text.replace(/[^0-9]/g, ""))
    .filter(Boolean);
  const joinedDigits = digitParts.join("");
  if (joinedDigits.length > 0 && joinedDigits.length <= 3) {
    const mark = normalizeMark(joinedDigits);
    if (mark) return mark;
  }

  return parseSplitCellText(zoneTexts.join(" "));
}

// ── OCR functions ─────────────────────────────────────────────────────────────

/**
 * Run OCR on a written-mark cell buffer.
 * Returns the normalised mark and raw confidence score (0-1).
 */
export async function recognizeWrittenMark(cellBuffer: Buffer): Promise<RecognizedCell> {
  const result = await recognizeWithParameters(cellBuffer, MARK_OCR_PARAMS);
  return {
    rawText: result.text,
    normalizedMark: normalizeMark(result.text),
    confidence: result.confidence,
  };
}

/**
 * Run OCR on a split-mark cell buffer.
 * Handles multi-column sub-totals; returns the dominant total mark.
 */
export async function recognizeSplitMark(cellBuffer: Buffer): Promise<RecognizedCell> {
  const result = await recognizeWithParameters(cellBuffer, MARK_OCR_PARAMS);
  return {
    rawText: result.text,
    normalizedMark: parseSplitCellText(result.text),
    confidence: result.confidence,
  };
}

export async function recognizeSplitMarkZones(zoneBuffers: Buffer[]): Promise<RecognizedSplitZones> {
  const zoneResults: RecognizedCell[] = [];

  for (const buffer of zoneBuffers) {
    const result = await recognizeWithParameters(buffer, SINGLE_ZONE_OCR_PARAMS);
    zoneResults.push({
      rawText: result.text,
      normalizedMark: normalizeMark(result.text),
      confidence: result.confidence,
    });
  }

  const zoneRawText = zoneResults.map((result) => result.rawText);
  const zoneMarks = zoneResults.map((result) => result.normalizedMark);
  const nonBlankConfidences = zoneResults
    .filter((result) => result.rawText.trim() || result.normalizedMark)
    .map((result) => result.confidence);

  return {
    rawText: zoneRawText.join(" | "),
    normalizedMark: parseSplitZoneTexts(zoneRawText),
    confidence: nonBlankConfidences.length > 0 ? Math.min(...nonBlankConfidences) : 0,
    zoneRawText,
    zoneMarks,
    zoneConfidences: zoneResults.map((result) => result.confidence),
  };
}

/**
 * OCR a full-block buffer (e.g., the marksheet header region).
 * Uses PSM 6 (single uniform block) instead of PSM 7 (single line).
 * Returns raw text and confidence; the caller extracts structured fields.
 */
export async function recognizeBlockText(buffer: Buffer): Promise<{ text: string; confidence: number }> {
  const result = await recognizeWithParameters(buffer, {
    tessedit_char_whitelist: "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_: ",
    tessedit_pageseg_mode: "6",
  });
  return { text: result.text, confidence: result.confidence };
}
