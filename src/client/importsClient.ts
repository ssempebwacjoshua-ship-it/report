import type {
  DetectContextResponse,
  GeminiScanContext,
  GeminiScanExtractResponse,
  ImportPreview,
  ScanBatchReloadResponse,
  ScanImportBatch,
  ScanMarksheetContext,
  ScanRowsCommitResponse,
  ScanRowsValidationResponse,
  ScanUploadPayload,
  ScanUploadResponse,
  ScanImportRow,
} from "../shared/types/imports";
import { getApiBaseUrl } from "./apiBase";
const API_BASE = getApiBaseUrl();
const TOKEN_KEY = "sc_auth_token";
function authHeaders(): HeadersInit {
  const token = localStorage.getItem(TOKEN_KEY);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function readImportError(response: Response, fallback: string): Promise<string> {
  try {
    const body = await response.json() as Record<string, unknown>;
    if (import.meta.env.DEV) {
      console.debug("[import-error]", response.url, response.status, body);
    }
    if (body?.error === true && typeof body?.message === "string") return body.message as string;
    if (typeof body?.error === "string") return body.error;
    if (Array.isArray(body?.issues) && (body.issues as unknown[]).length)
      return (body.issues as Array<{ message?: string }>).map((issue) => issue.message).join("; ");
  } catch {
    return fallback;
  }
  return fallback;
}

// ── Digital import (CSV / XLS / XLSX) ────────────────────────────────────────

export async function dryRunMarksImport(csvText: string, schoolCode = "SCU-PREVIEW"): Promise<ImportPreview> {
  const response = await fetch(`${API_BASE}/api/imports/marks/dry-run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ schoolCode, csvText }),
  });
  if (!response.ok) throw new Error(await readImportError(response, "Could not validate import"));
  return response.json();
}

export async function commitMarksImport(csvText: string, schoolCode = "SCU-PREVIEW"): Promise<ImportPreview> {
  const response = await fetch(`${API_BASE}/api/imports/marks/commit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ schoolCode, csvText }),
  });
  if (!response.ok) throw new Error(await readImportError(response, "Could not commit import"));
  return response.json();
}

// ── Scanned marksheet context detection ──────────────────────────────────────

/**
 * Upload a scan image and auto-detect the marksheet context from the header.
 * This is a non-committing call — it never persists marks.
 */
export async function detectScanContext(
  file: File,
  schoolCode: string,
): Promise<DetectContextResponse & { ocrFoundId: string | null }> {
  const form = new FormData();
  form.append("file", file);
  form.append("schoolCode", schoolCode);

  const response = await fetch(`${API_BASE}/api/imports/scans/detect-context`, {
    method: "POST",
    body: form,
  });
  if (!response.ok) throw new Error(await readImportError(response, "Context detection failed"));
  return response.json();
}

/**
 * Look up full marksheet context from a typed/pasted Marksheet ID.
 * Does not require uploading a file.
 */
export async function lookupMarksheetContext(
  marksheetId: string,
  schoolCode: string,
): Promise<DetectContextResponse> {
  const params = new URLSearchParams({ marksheetId, schoolCode });
  const response = await fetch(`${API_BASE}/api/imports/scans/context?${params}`);
  if (!response.ok) throw new Error(await readImportError(response, "Marksheet context lookup failed"));
  return response.json();
}

// ── Scanned handwritten marksheet import ─────────────────────────────────────

/** @deprecated Use uploadScanFile instead (sends actual file bytes for OCR). */
export async function uploadScanMetadata(payload: ScanUploadPayload): Promise<ScanUploadResponse> {
  return uploadScanFile(
    new File([], payload.fileName, { type: "application/octet-stream" }),
    payload.schoolCode,
    payload.context,
  );
}

/**
 * Upload a scanned marksheet image and run the extraction engine.
 *
 * Sends the file as multipart/form-data. The server returns extracted mark rows
 * for mandatory operator review — rows are never auto-committed.
 */
export async function uploadScanFile(
  file: File,
  schoolCode: string,
  context: ScanMarksheetContext,
  options: { recognizedMarksheetId?: string | null; selectedMarksheetId?: string } = {},
): Promise<ScanUploadResponse> {
  const form = new FormData();
  form.append("file", file);
  form.append("schoolCode", schoolCode);
  form.append("context", JSON.stringify(context));
  if (options.recognizedMarksheetId) form.append("recognizedMarksheetId", options.recognizedMarksheetId);
  if (options.selectedMarksheetId) form.append("selectedMarksheetId", options.selectedMarksheetId);

  const response = await fetch(`${API_BASE}/api/imports/scans/upload`, {
    method: "POST",
    body: form,
    // Do NOT set Content-Type — the browser/fetch sets it with the correct boundary
  });
  if (!response.ok) throw new Error(await readImportError(response, "Could not upload scan"));
  return response.json();
}

/**
 * Reload a previously extracted scan batch by its batchId.
 * Used to restore extraction state after a page refresh.
 */
export async function loadScanBatch(batchId: string): Promise<ScanBatchReloadResponse> {
  const response = await fetch(`${API_BASE}/api/imports/scan-batches/${encodeURIComponent(batchId)}`);
  if (!response.ok) throw new Error(await readImportError(response, "Could not load scan batch"));
  return response.json();
}

export async function fetchScanBatches(schoolCode = "SCU-PREVIEW"): Promise<ScanImportBatch[]> {
  const response = await fetch(
    `${API_BASE}/api/imports/scans/batches?schoolCode=${encodeURIComponent(schoolCode)}`,
  );
  if (!response.ok) throw new Error("Could not load scan batches");
  const body = await response.json();
  return (body.batches ?? []) as ScanImportBatch[];
}

export async function dryRunScanRows(
  context: ScanMarksheetContext,
  rows: ScanImportRow[],
  schoolCode = "SCU-PREVIEW",
  batchId?: string,
): Promise<ScanRowsValidationResponse> {
  const response = await fetch(`${API_BASE}/api/imports/scans/dry-run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ schoolCode, context, rows, batchId }),
  });
  if (!response.ok) throw new Error(await readImportError(response, "Could not validate scanned marks"));
  return response.json();
}

export async function commitScanRows(
  context: ScanMarksheetContext,
  rows: ScanImportRow[],
  schoolCode = "SCU-PREVIEW",
): Promise<ScanRowsCommitResponse> {
  const response = await fetch(`${API_BASE}/api/imports/scans/commit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ schoolCode, context, rows }),
  });
  if (!response.ok) throw new Error(await readImportError(response, "Could not commit scanned marks"));
  return response.json();
}
// ── Gemini marksheet scan extraction ─────────────────────────────

/**
 * Upload a marksheet image to the Gemini extraction endpoint. Returns the
 * validated, student-matched review rows. Never commits marks. The Gemini API
 * key stays on the server — the client only sends the image and context IDs.
 */
export async function extractMarksWithGeminiScan(
  image: File,
  context: GeminiScanContext,
  schoolCode = "SCU-PREVIEW",
): Promise<GeminiScanExtractResponse> {
  const form = new FormData();
  form.append("image", image);
  form.append("classId", context.classId);
  if (context.streamId) form.append("streamId", context.streamId);
  form.append("subjectId", context.subjectId);
  form.append("termId", context.termId);
  form.append("examType", context.examType);
  form.append("schoolCode", schoolCode);

  const response = await fetch(`${API_BASE}/api/marks-import/scan/extract`, {
    method: "POST",
    headers: authHeaders(),
    body: form,
  });
  if (!response.ok) throw new Error(await readImportError(response, "Gemini extraction failed"));
  return response.json();
}
