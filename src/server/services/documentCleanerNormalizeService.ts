import type { CellCorrection, DocumentRow, UncertainCell } from "../../shared/types/documentCleaner";

// ── Column header detection ───────────────────────────────────────────────────

const TABLE_KEYWORDS = new Set([
  "NO", "NAME", "SUBJECT", "LEVEL", "MARK", "MARKS", "TEACHER", "STUDENT",
  "ADM", "CLASS", "SCORE", "GRADE", "REMARKS", "SPLIT", "WRITTEN", "ENTRY",
]);

function wordsContainKeyword(text: string): boolean {
  const words = text.toUpperCase().replace(/[^A-Z\s]/g, " ").split(/\s+/).filter(Boolean);
  return words.some((w) => TABLE_KEYWORDS.has(w));
}

// True only when the text (stripped of punctuation) is exactly one TABLE_KEYWORD word.
// Used as a strict trigger for Strategy 2 so preamble phrases like "School Name"
// (which contain "NAME" but aren't column headers) don't start a false header run.
function isDirectKeyword(text: string): boolean {
  const cleaned = text.trim().toUpperCase().replace(/[^A-Z]/g, "");
  return TABLE_KEYWORDS.has(cleaned);
}

// Used by delimiter detection (body lines) — no "/" splitting
function splitLineIntoSegments(line: string): string[] {
  if ((line.match(/,/g)?.length ?? 0) >= 2) return line.split(",").map((s) => s.trim()).filter(Boolean);
  if ((line.match(/\t/g)?.length ?? 0) >= 1) return line.split("\t").map((s) => s.trim()).filter(Boolean);
  return line.split(/\s{2,}/).map((s) => s.trim()).filter(Boolean);
}

// Used by column header detection — also tries "/" as delimiter (Azure Layout OCR uses it)
function splitLineIntoSegmentsAll(line: string): string[] {
  const trimmed = line.trim();
  if ((trimmed.match(/,/g)?.length ?? 0) >= 2) return trimmed.split(",").map((s) => s.trim()).filter(Boolean);
  if ((trimmed.match(/\t/g)?.length ?? 0) >= 1) return trimmed.split("\t").map((s) => s.trim()).filter(Boolean);
  if ((trimmed.match(/\//g)?.length ?? 0) >= 1) {
    const parts = trimmed.split("/").map((s) => s.trim()).filter(Boolean);
    if (parts.length >= 2) return parts;
  }
  const spaceParts = trimmed.split(/\s{2,}/).map((s) => s.trim()).filter(Boolean);
  if (spaceParts.length >= 2) return spaceParts;
  return trimmed ? [trimmed] : [];
}

/**
 * Scans up to the first 20 lines for a column header row using three strategies:
 *
 * Strategy 1 — single line with ≥3 segments containing a keyword
 *   "NO  TEACHER'S NAME  Subject  Level" → 4 segments → header
 *
 * Strategy 3 — single line with exactly 2 segments where both are keywords
 *   "NO  NAME" → 2 keyword segments → header
 *
 * Strategy 2 — consecutive keyword lines combined into one header
 *   "NO" (1 segment, keyword) + "Teachers Name / Subject" (2 segments after "/" split)
 *   → combined ["NO", "Teachers Name", "Subject"] → header at last consumed line
 *
 * Returns { idx: -1, columns: [] } when no header is found.
 */
export function findTableColumnHeader(lines: string[]): { idx: number; columns: string[] } {
  const limit = Math.min(lines.length, 20);
  for (let i = 0; i < limit; i++) {
    const line = lines[i]!.trim();
    const segs = splitLineIntoSegmentsAll(line);

    // Strategy 1: single line, ≥3 segments, at least one has a keyword
    if (segs.length >= 3 && segs.some((s) => wordsContainKeyword(s))) {
      return { idx: i, columns: segs };
    }

    // Strategy 3: two segments where both contain keywords
    if (segs.length === 2 && segs.every((s) => wordsContainKeyword(s))) {
      return { idx: i, columns: segs };
    }

    // Strategy 2: line is a single standalone keyword (e.g. "NO", "SUBJECT", "LEVEL")
    // Only trigger on a direct keyword word so preamble phrases like "School Name"
    // don't incorrectly start a header collection run.
    if (segs.length === 1 && isDirectKeyword(segs[0]!)) {
      const collectedSegs: string[] = [...segs];
      let j = i + 1;
      while (j < limit) {
        const nextLine = lines[j]!.trim();
        const nextSegs = splitLineIntoSegmentsAll(nextLine);
        if (nextSegs.length >= 1 && nextSegs.some((s) => wordsContainKeyword(s))) {
          collectedSegs.push(...nextSegs);
          j++;
        } else {
          break;
        }
      }
      if (collectedSegs.length >= 2) {
        return { idx: j - 1, columns: collectedSegs };
      }
    }
  }
  return { idx: -1, columns: [] };
}

// ── Structured table cells (Azure raw.tables) ─────────────────────────────────

export type TableCell = {
  rowIndex: number;
  columnIndex: number;
  content: string;
  kind?: string;
};

/**
 * Normalises a raw Azure OCR column header to a clean display name.
 * Applies title-casing and fixes missing possessives ("Teachers" → "Teacher's").
 */
function normalizeColumnHeader(raw: string): string {
  return raw
    .trim()
    .replace(/\bTeachers\b/i, "Teacher's")
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Returns true when a cell value contains non-printable-ASCII characters
 * that suggest OCR misread (e.g. "À la001", `“ Level`).
 */
function hasOcrNoise(text: string): boolean {
  return text.trim().length > 0 && /[^\x20-\x7E]/.test(text);
}

/** Strips trailing period/whitespace from pure row-number cells (e.g. "1." → "1"). */
function normalizeNumberCell(text: string): string {
  const m = text.trim().match(/^(\d+)\s*\.?\s*$/);
  return m ? m[1]! : text;
}

/**
 * Reconstructs columns and rows from Azure Layout's raw table cells,
 * which carry rowIndex/columnIndex so interleaved OCR order doesn't matter.
 *
 * - Header detection (priority order):
 *     1. Rows where any cell has kind === "columnHeader" (Azure Form Recognizer v3)
 *     2. First row within the first 4 where ≥2 cells contain table keywords
 *     3. No header — all rows returned as data
 * - Fully empty rows are dropped.
 * - Column headers are normalized to title-case.
 * - Cells with non-ASCII OCR noise are marked as uncertainCells.
 */
export function normalizeFromTableCells(cells: TableCell[]): {
  columns: string[];
  rows: DocumentRow[];
  uncertainCells: UncertainCell[];
} {
  if (cells.length === 0) return { columns: [], rows: [], uncertainCells: [] };

  const maxRow = Math.max(...cells.map((c) => c.rowIndex));
  const maxCol = Math.max(...cells.map((c) => c.columnIndex));
  const colCount = maxCol + 1;

  // Build 2D grid
  const grid: string[][] = Array.from({ length: maxRow + 1 }, () =>
    Array<string>(colCount).fill(""),
  );
  for (const cell of cells) {
    if (cell.rowIndex <= maxRow && cell.columnIndex <= maxCol) {
      grid[cell.rowIndex]![cell.columnIndex] = cell.content.trim();
    }
  }

  // Detect header row
  let headerRowIdx = -1;
  const kindHeaderRows = new Set(
    cells.filter((c) => c.kind === "columnHeader").map((c) => c.rowIndex),
  );
  if (kindHeaderRows.size > 0) {
    headerRowIdx = Math.min(...kindHeaderRows);
  } else {
    for (let r = 0; r <= Math.min(maxRow, 3); r++) {
      const keywordCount = grid[r]!.filter((c) => wordsContainKeyword(c)).length;
      if (keywordCount >= 2) { headerRowIdx = r; break; }
    }
  }

  if (headerRowIdx === -1) {
    const dataRows = grid.filter((rowCells) => rowCells.some((c) => c.length > 0));
    const rows: DocumentRow[] = dataRows.map((rowCells) => ({ cells: rowCells, confidence: 0.7 }));
    return { columns: [], rows, uncertainCells: [] };
  }

  // Normalize column headers (title-case, fix possessives)
  const columns = grid[headerRowIdx]!.map(normalizeColumnHeader);

  // Build data rows: skip header, drop fully-empty rows
  const uncertainCells: UncertainCell[] = [];
  const rows: DocumentRow[] = [];

  const dataGrid = grid.filter((_, r) => r > headerRowIdx);
  for (const rawCells of dataGrid) {
    // Drop rows where every cell is empty
    if (rawCells.every((c) => c.length === 0)) continue;

    const normalizedCells = rawCells
      .slice(0, colCount)
      .map((c) => normalizeNumberCell(c));

    while (normalizedCells.length < colCount) normalizedCells.push("");

    const rowIdx = rows.length;
    for (let ci = 0; ci < normalizedCells.length; ci++) {
      if (hasOcrNoise(normalizedCells[ci]!)) {
        uncertainCells.push({
          rowIndex: rowIdx,
          columnIndex: ci,
          reason: "OCR noise detected — please verify",
        });
      }
    }

    rows.push({ cells: normalizedCells, confidence: 0.9 });
  }

  return { columns, rows, uncertainCells };
}

// ── Marksheet schema detection & repair ──────────────────────────────────────

const ADM_NO_RE = /^SC\d{4}-\d{4,5}$/i;

function isAdmNo(text: string): boolean {
  return ADM_NO_RE.test(text.trim());
}

function isLikelyName(text: string): boolean {
  const t = text.trim();
  return t.length >= 2 && /^[A-Za-z]/.test(t) && /[A-Za-z]{2,}/.test(t) && !/^\d+$/.test(t) && !isAdmNo(t);
}

function isNumericMark(text: string): boolean {
  return /^\d{1,3}$/.test(text.trim());
}

/**
 * Returns true when the columns indicate a student marksheet schema:
 * must have an Adm No column, a marks column, and a name column, with ≥ 4 cols.
 * Also accepts data-driven detection: ≥ 2 cells in the first 5 rows match the
 * admission number pattern (for when column headers are vague).
 */
export function detectMarksheetSchema(columns: string[], rows?: DocumentRow[]): boolean {
  if (columns.length < 4) return false;
  const hasAdmCol = columns.some((c) => /adm/i.test(c));
  const hasMarkCol = columns.some((c) => /mark|score/i.test(c));
  const hasNameCol = columns.some((c) => /\bname\b/i.test(c));
  if (hasAdmCol && hasMarkCol && hasNameCol) return true;
  if (rows && rows.length > 0) {
    const admMatches = rows
      .slice(0, 5)
      .flatMap((r) => r.cells)
      .filter((c) => isAdmNo(c));
    if (admMatches.length >= 2) return true;
  }
  return false;
}

function tryRepairNameMarkSwap(
  rawCells: string[],
  colCount: number,
  rowIdx: number,
): { cells: string[]; corrections: CellCorrection[] } | null {
  // Schema positions after Adm No: 2=Student Name, 3=Written Mark
  if (rawCells.length < 4) return null;
  if (!isAdmNo(rawCells[1] ?? "")) return null;
  const atNamePos = rawCells[2] ?? "";
  const atMarkPos = rawCells[3] ?? "";
  if (!isNumericMark(atNamePos) || !isLikelyName(atMarkPos)) return null;
  const cells = [...rawCells];
  while (cells.length < colCount) cells.push("");
  cells[2] = atMarkPos;
  cells[3] = atNamePos;
  return {
    cells: cells.slice(0, colCount),
    corrections: [
      {
        rowIndex: rowIdx, columnIndex: 2,
        raw: atNamePos, value: atMarkPos,
        status: "corrected",
        reason: `Student name "${atMarkPos}" was in Written Mark column; moved to Student Name`,
      },
      {
        rowIndex: rowIdx, columnIndex: 3,
        raw: atMarkPos, value: atNamePos,
        status: "corrected",
        reason: `Written mark "${atNamePos}" was in Student Name column; moved to Written Mark`,
      },
    ],
  };
}

function validateMarksheetCells(
  rawCells: string[],
  colCount: number,
  rowIdx: number,
): { cells: string[]; corrections: CellCorrection[] } {
  const cells = rawCells.slice(0, colCount);
  while (cells.length < colCount) cells.push("");
  const corrections: CellCorrection[] = [];
  const admNoCell = cells[1] ?? "";
  if (admNoCell && !isAdmNo(admNoCell)) {
    corrections.push({
      rowIndex: rowIdx, columnIndex: 1,
      raw: admNoCell, value: admNoCell,
      status: "uncertain",
      reason: `"${admNoCell}" doesn't match admission number format SC####-#####`,
    });
  }
  const nameCell = cells[2] ?? "";
  if (nameCell && /^\d+$/.test(nameCell)) {
    corrections.push({
      rowIndex: rowIdx, columnIndex: 2,
      raw: nameCell, value: nameCell,
      status: "invalid",
      reason: `Student name "${nameCell}" is numeric; expected a name`,
    });
  }
  const markCell = cells[3] ?? "";
  if (markCell && /[a-zA-Z]/.test(markCell)) {
    corrections.push({
      rowIndex: rowIdx, columnIndex: 3,
      raw: markCell, value: markCell,
      status: "invalid",
      reason: `Written mark "${markCell}" contains letters; expected a numeric score`,
    });
  }
  return { cells, corrections };
}

/**
 * Repairs rows from a marksheet table using schema-aware structural analysis.
 *
 * For each row:
 * 1. Finds the admission number (SC####-####) as an anchor.
 * 2. If it's at column 1 (expected): checks for name/mark swap and validates.
 * 3. If it's shifted right (e.g., col 2): removes the noise cells before it,
 *    shifts the Adm No to col 1, and pads Remarks with "".
 * 4. If absent: runs type validation only (flags invalid marks, uncertain Adm Nos).
 *
 * Returns per-cell CellCorrection metadata so the UI can highlight corrected
 * (yellow) and invalid (red) cells. Does NOT silently save corrections —
 * all changes are surfaced for user review.
 */
export function repairMarksheetRows(
  columns: string[],
  rows: DocumentRow[],
  existingUncertain: UncertainCell[],
): { rows: DocumentRow[]; uncertainCells: UncertainCell[]; cellCorrections: CellCorrection[] } {
  const colCount = columns.length;
  const allCorrections: CellCorrection[] = [];

  const repairedRows: DocumentRow[] = rows.map((row, rowIdx) => {
    const rawCells = [...row.cells];
    const admNoIdx = rawCells.findIndex((c) => isAdmNo(c));
    let cells: string[];
    let rowCorrections: CellCorrection[] = [];

    if (admNoIdx === -1) {
      ({ cells, corrections: rowCorrections } = validateMarksheetCells(rawCells, colCount, rowIdx));
    } else if (admNoIdx === 1) {
      const swapResult = tryRepairNameMarkSwap(rawCells, colCount, rowIdx);
      if (swapResult) {
        cells = swapResult.cells;
        rowCorrections = swapResult.corrections;
      } else {
        ({ cells, corrections: rowCorrections } = validateMarksheetCells(rawCells, colCount, rowIdx));
      }
    } else {
      // Adm No is shifted right — remove the noise cells before it
      const noise = rawCells.slice(1, admNoIdx);
      const afterAdmNo = rawCells.slice(admNoIdx + 1);
      const repairedCells = [rawCells[0] ?? "", rawCells[admNoIdx]!, ...afterAdmNo];
      while (repairedCells.length < colCount) repairedCells.push("");
      cells = repairedCells.slice(0, colCount);
      rowCorrections.push({
        rowIndex: rowIdx, columnIndex: 1,
        raw: rawCells[1] ?? "",
        value: rawCells[admNoIdx]!,
        status: "corrected",
        reason: `Removed ${noise.length} extra cell(s) before Adm No: "${noise.join('", "')}"`,
      });
      if (cells.length > afterAdmNo.length + 2) {
        rowCorrections.push({
          rowIndex: rowIdx, columnIndex: colCount - 1,
          raw: "", value: "",
          status: "corrected",
          reason: "Remarks column missing after shift repair; padded blank",
        });
      }
      // After shift repair, also check for name/mark swap
      const swapResult = tryRepairNameMarkSwap(cells, colCount, rowIdx);
      if (swapResult) {
        cells = swapResult.cells;
        rowCorrections.push(...swapResult.corrections);
      }
    }

    allCorrections.push(...rowCorrections);
    const hasInvalid = rowCorrections.some((c) => c.status === "invalid");
    const hasCorrected = rowCorrections.some((c) => c.status === "corrected");
    const confidence = hasInvalid ? 0.3 : hasCorrected ? 0.6 : row.confidence;
    return { ...row, cells, confidence };
  });

  const correctionKeys = new Set(allCorrections.map((c) => `${c.rowIndex}:${c.columnIndex}`));
  const filteredUncertain = existingUncertain.filter(
    (u) => !correctionKeys.has(`${u.rowIndex}:${u.columnIndex}`),
  );

  return { rows: repairedRows, uncertainCells: filteredUncertain, cellCorrections: allCorrections };
}

// ── Delimiter-based parsing ───────────────────────────────────────────────────

type Delimiter = "comma" | "tab" | "spaces";

function detectDelimiter(lines: string[]): Delimiter {
  const sample = lines.slice(0, 10).filter(Boolean);
  if (sample.length === 0) return "spaces";
  const commaAvg = sample.reduce((s, l) => s + (l.match(/,/g)?.length ?? 0), 0) / sample.length;
  const tabAvg = sample.reduce((s, l) => s + (l.match(/\t/g)?.length ?? 0), 0) / sample.length;
  if (commaAvg >= 2) return "comma";
  if (tabAvg >= 2) return "tab";
  return "spaces";
}

function splitByDelimiter(line: string, delimiter: Delimiter): string[] {
  if (delimiter === "comma") return line.split(",").map((c) => c.trim());
  if (delimiter === "tab") return line.split("\t").map((c) => c.trim());
  return line.split(/\s{2,}/).map((c) => c.trim()).filter(Boolean);
}

// ── Row-number grouping (when each OCR line is a single cell) ─────────────────

/**
 * Pattern: a data row begins with a digit followed by a period or space.
 * E.g. "1. NAKOTTA LAWRENCE", "3. m. Shemogooma Lamed", "4 Nantale Margret"
 */
const ROW_START_RE = /^(\d+)[.\s]\s*(.*)/;

type LineGroup = {
  no: string;
  cells: string[]; // all cells collected for this row (no is NOT included here)
};

/**
 * Groups single-cell OCR lines into table rows using numbered row markers.
 *
 * Lines before the first numbered row ("orphan" lines) are grouped in chunks
 * of (colCount − 1) and assigned sequential row numbers starting from 1.
 *
 * For each numbered row, the number and any text on the same line become
 * the first two cells; subsequent lines fill the remaining columns.
 */
export function groupLinesByRowNumber(
  lines: string[],
  colCount: number,
): { rows: DocumentRow[]; uncertainCells: UncertainCell[] } {
  // Pass 1: split into groups
  const preLines: string[] = []; // lines before the first row marker
  const groups: LineGroup[] = [];
  let current: LineGroup | null = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const m = ROW_START_RE.exec(line);
    if (m) {
      if (current) groups.push(current);
      // Text after the row number on the same line is the first content cell (usually the name)
      current = { no: m[1]!, cells: m[2]!.trim() ? [m[2]!.trim()] : [] };
    } else if (current) {
      current.cells.push(line);
    } else {
      preLines.push(line);
    }
  }
  if (current) groups.push(current);

  const rows: DocumentRow[] = [];
  const uncertainCells: UncertainCell[] = [];

  // Convert pre-numbered orphan lines into rows (chunk by colCount − 1)
  if (preLines.length > 0) {
    const chunkSize = Math.max(1, colCount - 1);
    let seq = 1;
    for (let o = 0; o < preLines.length; o += chunkSize) {
      const chunk = preLines.slice(o, o + chunkSize);
      const cells = [String(seq++), ...chunk].slice(0, colCount);
      while (cells.length < colCount) cells.push("");
      const rowIdx = rows.length;
      rows.push({ cells, confidence: 0.45 });
      cells.forEach((_, ci) =>
        uncertainCells.push({
          rowIndex: rowIdx,
          columnIndex: ci,
          reason: "Row grouping estimated — please verify against original scan",
        }),
      );
    }
  }

  // Convert numbered groups
  for (const g of groups) {
    const rawCells = [g.no, ...g.cells].slice(0, colCount);
    while (rawCells.length < colCount) rawCells.push("");
    rows.push({ cells: rawCells, confidence: 0.82 });
  }

  return { rows, uncertainCells };
}

// ── Main normalisation entry point ────────────────────────────────────────────

/**
 * Normalises a flat OCR line array into structured table columns and rows.
 *
 * Strategy (tried in order):
 * 1. Locate the column header row by scanning for table keyword segments
 *    (NO, NAME, SUBJECT, LEVEL …) — works even when it falls inside the
 *    first 20 % of lines that the old heuristic consumed.
 * 2. If body lines already carry multiple cells per line (comma / tab /
 *    multi-space separated), use delimiter splitting.
 * 3. Otherwise fall back to row-number grouping: lines matching /^\d+[.\s]/
 *    act as row boundaries; subsequent lines fill remaining columns.
 *
 * Returns `metaEndIdx` — the number of lines before the column header that
 * the caller should use for title / school / year / term extraction.
 */
export function normalizeFromOcrLines(lines: string[]): {
  columns: string[];
  rows: DocumentRow[];
  uncertainCells: UncertainCell[];
  metaEndIdx: number;
} {
  const filtered = lines.map((l) => l.trim()).filter(Boolean);
  if (filtered.length === 0) {
    return { columns: [], rows: [], uncertainCells: [], metaEndIdx: 0 };
  }

  // Step 1: find column header
  const { idx: colHeaderIdx, columns } = findTableColumnHeader(filtered);
  const metaEndIdx = colHeaderIdx >= 0 ? colHeaderIdx : Math.min(4, filtered.length);
  const bodyLines =
    colHeaderIdx >= 0 ? filtered.slice(colHeaderIdx + 1) : filtered.slice(metaEndIdx);

  if (columns.length === 0 || bodyLines.length === 0) {
    return { ...normalizeTableLines(filtered), metaEndIdx };
  }

  const colCount = columns.length;

  // Step 2: check if body lines already have multiple cells (delimiter-separated)
  const delimiter = detectDelimiter(bodyLines);
  const splitBody = bodyLines.map((l) => splitByDelimiter(l, delimiter));
  const multiCellRatio =
    splitBody.filter((cells) => cells.length >= 2).length / splitBody.length;

  if (multiCellRatio >= 0.5) {
    const uncertainCells: UncertainCell[] = [];
    const rows: DocumentRow[] = splitBody.map((cells, rowIdx) => {
      const padded =
        cells.length < colCount
          ? [...cells, ...Array<string>(colCount - cells.length).fill("")]
          : cells.slice(0, colCount);
      const conf = cells.length === colCount ? 0.85 : 0.45;
      if (conf < 0.6) {
        padded.forEach((_, ci) =>
          uncertainCells.push({
            rowIndex: rowIdx,
            columnIndex: ci,
            reason: "Row cell count doesn't match header — please review",
          }),
        );
      }
      return { cells: padded, confidence: conf };
    });
    return { columns, rows, uncertainCells, metaEndIdx };
  }

  // Step 3: body lines are single-cell — group by row-number pattern
  const { rows, uncertainCells } = groupLinesByRowNumber(bodyLines, colCount);
  return { columns, rows, uncertainCells, metaEndIdx };
}

// ── Legacy delimiter-only parser (CSV / tab imports) ─────────────────────────

function looksLikeHeaderRow(cells: string[]): boolean {
  if (cells.length < 2) return false;
  if (/^\d+$/.test(cells[0]!.trim())) return false;
  const nonNumeric = cells.filter((c) => !/^\d+(\.\d+)?$/.test(c.trim()));
  return nonNumeric.length / cells.length >= 0.5;
}

function findHeaderIndex(splitLines: string[][]): number {
  const limit = Math.min(splitLines.length, 5);
  for (let i = 0; i < limit; i++) {
    if (!looksLikeHeaderRow(splitLines[i]!)) continue;
    const next = splitLines[i + 1];
    if (!next || next.some((c) => /^\d+(\.\d+)?$/.test(c.trim()))) return i;
  }
  return -1;
}

/**
 * Parses delimiter-separated lines into columns + rows.
 * Exported for direct use in unit tests and CSV/tab import scenarios.
 */
export function normalizeTableLines(lines: string[]): {
  columns: string[];
  rows: DocumentRow[];
  uncertainCells: UncertainCell[];
} {
  const filtered = lines.map((l) => l.trim()).filter(Boolean);
  if (filtered.length === 0) return { columns: [], rows: [], uncertainCells: [] };

  const delimiter = detectDelimiter(filtered);
  const splitLines = filtered.map((l) => splitByDelimiter(l, delimiter));
  const headerIdx = findHeaderIndex(splitLines);
  const columns = headerIdx >= 0 ? (splitLines[headerIdx] ?? []) : [];
  const dataLines = headerIdx >= 0 ? splitLines.slice(headerIdx + 1) : splitLines;
  const colCount = columns.length;

  const uncertainCells: UncertainCell[] = [];
  const rows: DocumentRow[] = dataLines.map((cells, rowIdx) => {
    const mismatch = colCount > 0 && cells.length !== colCount;
    const short = cells.length < 2 || cells.join("").length < 3;
    const padded =
      colCount > 0 && cells.length < colCount
        ? [...cells, ...Array<string>(colCount - cells.length).fill("")]
        : cells;
    const confidence = !mismatch && !short ? 0.85 : 0.45;
    if (confidence < 0.6) {
      padded.forEach((_, ci) =>
        uncertainCells.push({
          rowIndex: rowIdx,
          columnIndex: ci,
          reason: mismatch
            ? "Row cell count doesn't match header — please review"
            : "Incomplete or very short row — please review",
        }),
      );
    }
    return { cells: padded, confidence };
  });

  return { columns, rows, uncertainCells };
}
