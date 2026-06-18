// â”€â”€ Public types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// â”€â”€ Mark normalisation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Normalise raw OCR text from a mark cell into a canonical mark string.
 *
 * Rules:
 * - "AB" / "A8" / "AB." â†’ "AB"   (absent)
 * - "EX" â†’ "EX"                  (exempt)
 * - digits 0-100 â†’ numeric string (e.g. "82")
 * - OCR noise around digits: strip non-digit chars, re-parse
 * - Blank / unreadable â†’ ""       (missing â€” not zero)
 */
export function normalizeMark(rawText: string): string {
  const t = rawText.replace(/\s+/g, "").toUpperCase();
  if (!t) return "";

  // Absent: OCR often reads "8" for "B" â†’ accept A8/AB
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

  // Check if individual zone characters spell out AB or EX (e.g. ["A","B",""] â†’ "AB")
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

