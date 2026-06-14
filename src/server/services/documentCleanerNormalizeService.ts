import type { DocumentRow, UncertainCell } from "../../shared/types/documentCleaner";

type Delimiter = "comma" | "tab" | "spaces";

function detectDelimiter(lines: string[]): Delimiter {
  const sample = lines.slice(0, 10).filter(Boolean);
  if (sample.length === 0) return "spaces";

  const commaAvg =
    sample.reduce((sum, l) => sum + (l.match(/,/g)?.length ?? 0), 0) / sample.length;
  const tabAvg =
    sample.reduce((sum, l) => sum + (l.match(/\t/g)?.length ?? 0), 0) / sample.length;

  if (commaAvg >= 2) return "comma";
  if (tabAvg >= 2) return "tab";
  return "spaces";
}

function splitByDelimiter(line: string, delimiter: Delimiter): string[] {
  if (delimiter === "comma") return line.split(",").map((c) => c.trim());
  if (delimiter === "tab") return line.split("\t").map((c) => c.trim());
  return line.split(/\s{2,}/).map((c) => c.trim()).filter(Boolean);
}

/**
 * A row is a header if:
 * - Its first cell is NOT a pure integer (rules out numbered data rows like "1, ...")
 * - At least half its cells are non-numeric words/labels
 */
function looksLikeHeaderRow(cells: string[]): boolean {
  if (cells.length < 2) return false;
  if (/^\d+$/.test(cells[0]!.trim())) return false;
  const nonNumeric = cells.filter((c) => !/^\d+(\.\d+)?$/.test(c.trim()));
  return nonNumeric.length / cells.length >= 0.5;
}

function hasNumericCells(cells: string[]): boolean {
  return cells.some((c) => /^\d+(\.\d+)?$/.test(c.trim()));
}

function findHeaderIndex(splitLines: string[][]): number {
  const limit = Math.min(splitLines.length, 5);
  for (let i = 0; i < limit; i++) {
    if (!looksLikeHeaderRow(splitLines[i]!)) continue;
    const next = splitLines[i + 1];
    // Confirm: next line has numeric data values, or there is no next line
    if (!next || hasNumericCells(next)) return i;
  }
  return -1;
}

/**
 * Converts raw OCR lines into structured columns and rows.
 *
 * Supports comma-separated, tab-separated, and multi-space-aligned tables.
 * Detects the header row by looking for a non-numeric label row followed by
 * numeric data. Short or misaligned rows are marked uncertain for review.
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
    const cellCountMismatch = colCount > 0 && cells.length !== colCount;
    const isShortRow = cells.length < 2 || cells.join("").length < 3;

    // Pad short rows to match column count for aligned grid rendering
    const paddedCells =
      colCount > 0 && cells.length < colCount
        ? [...cells, ...Array<string>(colCount - cells.length).fill("")]
        : cells;

    const confidence = !cellCountMismatch && !isShortRow ? 0.85 : 0.45;

    if (confidence < 0.6) {
      paddedCells.forEach((_, colIdx) => {
        uncertainCells.push({
          rowIndex: rowIdx,
          columnIndex: colIdx,
          reason: cellCountMismatch
            ? "Row cell count doesn't match header — please review"
            : "Incomplete or very short row — please review",
        });
      });
    }

    return { cells: paddedCells, confidence };
  });

  return { columns, rows, uncertainCells };
}
