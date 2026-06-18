import { randomUUID } from "node:crypto";
import sharp from "sharp";
import type { CellCorrection, ExtractedDocument } from "../../shared/types/documentCleaner";
import { isAzureOcrConfigured } from "./azureOcrService";
import {
  detectMarksheetSchema,
  normalizeFromOcrLines,
  normalizeFromTableCells,
  repairMarksheetRows,
  type TableCell,
} from "./documentCleanerNormalizeService";

// â”€â”€ OCR helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Calls the Azure OCR Function directly (one fetch) so we can capture both
 * the flat `lines[]` array AND the structured `raw.tables[].cells[]` that
 * carry rowIndex/columnIndex. The azureOcrService helper discards `raw`, so
 * we bypass it here â€” but we still gate on isAzureOcrConfigured().
 */
async function ocrWithStructure(
  buffer: Buffer,
  mimeType: string,
): Promise<{ lines: string[]; tableCells: TableCell[] | null; error: string }> {
  if (!isAzureOcrConfigured()) {
    return {
      lines: [],
      tableCells: null,
      error: "OCR service is not configured. Enter the document content manually.",
    };
  }

  try {
    let processedBuffer = buffer;
    let processedMime = mimeType;
    if (mimeType !== "application/pdf") {
      processedBuffer = await sharp(buffer)
        .resize({ width: 2000, fit: "inside", withoutEnlargement: true })
        .greyscale()
        .normalize()
        .jpeg({ quality: 92 })
        .toBuffer();
      processedMime = "image/jpeg";
    }

    const functionUrl = process.env.AZURE_OCR_FUNCTION_URL!;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);

    let data: {
      ok?: boolean;
      text?: string;
      lines?: string[];
      raw?: unknown;
    };
    try {
      const response = await fetch(functionUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: processedBuffer.toString("base64"),
          mimeType: processedMime,
        }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error("OCR service returned an error.");
      data = (await response.json()) as typeof data;
    } finally {
      clearTimeout(timeout);
    }

    if (data.ok === false) throw new Error("OCR extraction failed.");

    const lines =
      Array.isArray(data.lines) && data.lines.length > 0
        ? (data.lines as string[])
        : (data.text ?? "").split("\n").map((l: string) => l.trim()).filter(Boolean);

    // Extract table cells from the raw Azure Layout response.
    // The Azure Function may return raw as the full analyzeResult object (raw.tables)
    // or as the full API response (raw.analyzeResult.tables) â€” handle both.
    const rawData = data.raw as Record<string, unknown> | null | undefined;
    let tableCells: TableCell[] | null = null;

    const rawTables: unknown[] | null =
      (rawData && Array.isArray(rawData.tables) ? rawData.tables as unknown[] : null) ??
      (rawData?.analyzeResult && Array.isArray((rawData.analyzeResult as Record<string, unknown>).tables)
        ? (rawData.analyzeResult as Record<string, unknown>).tables as unknown[]
        : null);

    if (rawTables && rawTables.length > 0) {
      // Pick the table with the most cells (the main content table)
      let bestCells: TableCell[] = [];
      for (const table of rawTables as Array<{ cells?: unknown[] }>) {
        if (!Array.isArray(table.cells)) continue;
        const cells: TableCell[] = [];
        for (const c of table.cells as Array<Record<string, unknown>>) {
          if (typeof c.rowIndex === "number" && typeof c.columnIndex === "number") {
            cells.push({
              rowIndex: c.rowIndex,
              columnIndex: c.columnIndex,
              content: String(c.content ?? c.text ?? ""),
              kind: typeof c.kind === "string" ? c.kind : undefined,
            });
          }
        }
        if (cells.length > bestCells.length) bestCells = cells;
      }
      if (bestCells.length > 0) tableCells = bestCells;
    }

    return { lines, tableCells, error: "" };
  } catch (err) {
    return {
      lines: [],
      tableCells: null,
      error: err instanceof Error ? err.message : "OCR extraction failed.",
    };
  }
}

// â”€â”€ Document structure parsing â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Try to find the document title from the first non-empty OCR lines.
 * Heuristic: a title line is typically short (<= 60 chars), all-caps or mixed case,
 * and appears in the first 3 lines.
 */
function extractTitle(lines: string[]): string {
  for (const line of lines.slice(0, 4)) {
    const trimmed = line.trim();
    if (trimmed.length >= 4 && trimmed.length <= 80) {
      return trimmed.toUpperCase();
    }
  }
  return "";
}

/** Extract school name, year, term from header lines using simple keyword heuristics. */
function extractMeta(lines: string[]): { schoolName: string; academicYear: string; term: string } {
  let schoolName = "";
  let academicYear = "";
  let term = "";

  for (const line of lines.slice(0, 8)) {
    const upper = line.toUpperCase();
    if (!schoolName && (upper.includes("S.S") || upper.includes("SECONDARY") || upper.includes("SCHOOL") || upper.includes("P/S"))) {
      schoolName = line.trim();
    }
    const yearMatch = line.match(/\b(20\d{2})\b/);
    if (!academicYear && yearMatch) academicYear = yearMatch[1]!;
    const termMatch = upper.match(/TERM\s*([123]|ONE|TWO|THREE)/);
    if (!term && termMatch) term = `TERM ${termMatch[1]!}`;
  }

  return { schoolName, academicYear, term };
}


// â”€â”€ Image preview â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function makePreviewDataUrl(buffer: Buffer, _mimeType: string): Promise<string> {
  try {
    const preview = await sharp(buffer)
      .resize({ width: 800, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 75 })
      .toBuffer();
    return `data:image/jpeg;base64,${preview.toString("base64")}`;
  } catch {
    return "";
  }
}

// â”€â”€ Public API â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/** Empty template returned when OCR is unavailable or produces no useful output. */
function emptyDocument(): ExtractedDocument {
  return {
    documentType: "table",
    title: "",
    schoolName: "",
    academicYear: "",
    term: "",
    columns: [],
    rows: [],
    uncertainCells: [],
    cellCorrections: [],
  };
}

export async function extractDocumentFromImage(
  buffer: Buffer,
  mimeType: string,
): Promise<{ draftId: string; document: ExtractedDocument; imagePreviewUrl: string }> {
  const draftId = randomUUID();
  const [imagePreviewUrl, { lines, tableCells }] = await Promise.all([
    makePreviewDataUrl(buffer, mimeType),
    ocrWithStructure(buffer, mimeType),
  ]);

  if (lines.length === 0 && !tableCells) {
    return { draftId, document: emptyDocument(), imagePreviewUrl };
  }

  let columns: string[];
  let rows: ReturnType<typeof normalizeFromOcrLines>["rows"];
  let uncertainCells: ReturnType<typeof normalizeFromOcrLines>["uncertainCells"];
  let metaEndIdx: number;

  if (tableCells && tableCells.length > 0) {
    // Azure returned structured table cells with rowIndex/columnIndex â€” use them
    // directly to avoid the interleaved-row problem in flat OCR line output.
    const result = normalizeFromTableCells(tableCells);
    columns = result.columns;
    rows = result.rows;
    uncertainCells = result.uncertainCells;
    metaEndIdx = 0; // use first few lines from flat output for meta extraction
  } else {
    // Fall back to line-based normalisation (delimiter detection + row grouping)
    const result = normalizeFromOcrLines(lines);
    columns = result.columns;
    rows = result.rows;
    uncertainCells = result.uncertainCells;
    metaEndIdx = result.metaEndIdx;
  }

  // Schema-aware marksheet repair: detect horizontal cell shifts and type errors.
  // Only applied when the column headers indicate a student marksheet (Adm No + Mark + Name).
  let cellCorrections: CellCorrection[] = [];
  if (detectMarksheetSchema(columns, rows)) {
    const repaired = repairMarksheetRows(columns, rows, uncertainCells);
    rows = repaired.rows;
    uncertainCells = repaired.uncertainCells;
    cellCorrections = repaired.cellCorrections;
  }

  const metaLines =
    metaEndIdx > 0 ? lines.slice(0, metaEndIdx) : lines.slice(0, Math.min(4, lines.length));

  const title = extractTitle(metaLines);
  const { schoolName, academicYear, term } = extractMeta(metaLines);

  const document: ExtractedDocument = {
    documentType: "table",
    title,
    schoolName,
    academicYear,
    term,
    columns,
    rows,
    uncertainCells,
    cellCorrections,
  };

  return { draftId, document, imagePreviewUrl };
}

// â”€â”€ HTML PDF generation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderDocumentHtml(doc: ExtractedDocument, primaryColor = "#1e40af"): string {
  const title = escapeHtml(doc.title || "DOCUMENT");
  const school = escapeHtml(doc.schoolName);
  const yearTerm = [doc.academicYear, doc.term].filter(Boolean).map(escapeHtml).join(" â€” ");

  const colHeaders = doc.columns.length > 0
    ? `<tr>${doc.columns.map((c) => `<th>${escapeHtml(c)}</th>`).join("")}</tr>`
    : "";

  const dataRows = doc.rows.map((row) =>
    `<tr>${row.cells.map((c) => `<td>${escapeHtml(c)}</td>`).join("")}</tr>`,
  ).join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>${title}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 13px;
    color: #111;
    background: #fff;
    padding: 24px 32px;
  }
  header {
    border-bottom: 3px solid ${escapeHtml(primaryColor)};
    padding-bottom: 10px;
    margin-bottom: 18px;
  }
  header .school-name {
    font-size: 18px;
    font-weight: 700;
    color: ${escapeHtml(primaryColor)};
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  header .doc-title {
    font-size: 15px;
    font-weight: 700;
    margin-top: 4px;
    text-transform: uppercase;
    letter-spacing: 0.02em;
  }
  header .meta {
    font-size: 12px;
    color: #555;
    margin-top: 3px;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 8px;
  }
  th {
    background: ${escapeHtml(primaryColor)};
    color: #fff;
    text-align: left;
    padding: 7px 10px;
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
  }
  td {
    padding: 6px 10px;
    border-bottom: 1px solid #e5e7eb;
    vertical-align: top;
  }
  tr:nth-child(even) td { background: #f8fafc; }
  @media print {
    body { padding: 0; font-size: 12px; }
    @page { size: A4 portrait; margin: 12mm 15mm; }
    table { page-break-inside: auto; }
    tr { page-break-inside: avoid; }
    thead { display: table-header-group; }
  }
</style>
</head>
<body>
<header>
  ${school ? `<div class="school-name">${school}</div>` : ""}
  <div class="doc-title">${title}</div>
  ${yearTerm ? `<div class="meta">${yearTerm}</div>` : ""}
</header>
<table>
  <thead>${colHeaders}</thead>
  <tbody>${dataRows}</tbody>
</table>
</body>
</html>`;
}

