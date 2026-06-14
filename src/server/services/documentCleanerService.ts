import { randomUUID } from "node:crypto";
import sharp from "sharp";
import type { ExtractedDocument } from "../../shared/types/documentCleaner";
import { isAzureOcrConfigured, readAzureOcrFromImage } from "./azureOcrService";
import { normalizeTableLines } from "./documentCleanerNormalizeService";

// ── OCR helpers ───────────────────────────────────────────────────────────────

async function ocrImageBuffer(buffer: Buffer, mimeType: string): Promise<{ lines: string[]; error: string }> {
  if (!isAzureOcrConfigured()) {
    return { lines: [], error: "OCR service is not configured. Enter the document content manually." };
  }
  try {
    // PDFs are sent as-is; images are pre-processed for better OCR accuracy
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
    const result = await readAzureOcrFromImage({
      imageBase64: processedBuffer.toString("base64"),
      mimeType: processedMime,
    });
    const lines = result.lines.length > 0
      ? result.lines
      : result.text.split("\n").map((l) => l.trim()).filter(Boolean);
    return { lines, error: "" };
  } catch (err) {
    return {
      lines: [],
      error: err instanceof Error ? err.message : "OCR extraction failed.",
    };
  }
}

// ── Document structure parsing ────────────────────────────────────────────────

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


// ── Image preview ─────────────────────────────────────────────────────────────

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

// ── Public API ────────────────────────────────────────────────────────────────

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
  };
}

export async function extractDocumentFromImage(
  buffer: Buffer,
  mimeType: string,
): Promise<{ draftId: string; document: ExtractedDocument; imagePreviewUrl: string }> {
  const draftId = randomUUID();
  const [imagePreviewUrl, { lines }] = await Promise.all([
    makePreviewDataUrl(buffer, mimeType),
    ocrImageBuffer(buffer, mimeType),
  ]);

  if (lines.length === 0) {
    return { draftId, document: emptyDocument(), imagePreviewUrl };
  }

  // Identify the split between header metadata and table content.
  // A rough heuristic: header lines are the first ~20% of all lines (max 6).
  const headerCount = Math.min(6, Math.max(2, Math.round(lines.length * 0.2)));
  const headerLines = lines.slice(0, headerCount);
  const bodyLines = lines.slice(headerCount);

  const title = extractTitle(headerLines);
  const { schoolName, academicYear, term } = extractMeta(headerLines);
  const { columns, rows, uncertainCells } = normalizeTableLines(bodyLines);

  const document: ExtractedDocument = {
    documentType: "table",
    title,
    schoolName,
    academicYear,
    term,
    columns,
    rows,
    uncertainCells,
  };

  return { draftId, document, imagePreviewUrl };
}

// ── HTML PDF generation ───────────────────────────────────────────────────────

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
  const yearTerm = [doc.academicYear, doc.term].filter(Boolean).map(escapeHtml).join(" — ");

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
