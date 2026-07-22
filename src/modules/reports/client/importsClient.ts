import type {
  DetectContextResponse,
  GeminiCommitResponse,
  GeminiScanContext,
  GeminiScanExtractResponse,
  GeminiScanRow,
  ImportPreview,
  ScanBatchReloadResponse,
  ScanImportBatch,
  ScanMarksheetContext,
  ScanOptions,
  ScanRowsCommitResponse,
  ScanRowsValidationResponse,
  ScanUploadPayload,
  ScanUploadResponse,
  ScanImportRow,
} from "../../../shared/types/imports";
import { getApiBaseUrl, makeRequestHeaders, parseApiError } from "../../../client/apiBase";

const API_BASE = getApiBaseUrl();

// -- Digital import (CSV / XLS / XLSX) ---------------------------------------

export async function dryRunMarksImport(csvText: string): Promise<ImportPreview> {
  const response = await fetch(`${API_BASE}/api/imports/marks/dry-run`, {
    method: "POST",
    headers: makeRequestHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ csvText }),
  });
  if (!response.ok) throw new Error(await parseApiError(response, "Could not validate import"));
  return response.json();
}

export async function commitMarksImport(csvText: string): Promise<ImportPreview> {
  const response = await fetch(`${API_BASE}/api/imports/marks/commit`, {
    method: "POST",
    headers: makeRequestHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ csvText }),
  });
  if (!response.ok) throw new Error(await parseApiError(response, "Could not commit import"));
  return response.json();
}

// -- Scanned marksheet context detection -------------------------------------

export async function detectScanContext(
  file: File,
): Promise<DetectContextResponse & { ocrFoundId: string | null }> {
  const form = new FormData();
  form.append("file", file);

  const response = await fetch(`${API_BASE}/api/imports/scans/detect-context`, {
    method: "POST",
    headers: makeRequestHeaders(),
    body: form,
  });
  if (!response.ok) throw new Error(await parseApiError(response, "Context detection failed"));
  return response.json();
}

export async function lookupMarksheetContext(
  marksheetId: string,
): Promise<DetectContextResponse> {
  const params = new URLSearchParams({ marksheetId });
  const response = await fetch(`${API_BASE}/api/imports/scans/context?${params}`, {
    headers: makeRequestHeaders(),
  });
  if (!response.ok) throw new Error(await parseApiError(response, "Marksheet context lookup failed"));
  return response.json();
}

// -- Scanned handwritten marksheet import ------------------------------------

export async function uploadScanMetadata(payload: ScanUploadPayload): Promise<ScanUploadResponse> {
  return uploadScanFile(
    new File([], payload.fileName, { type: "application/octet-stream" }),
    payload.context,
  );
}

export async function uploadScanFile(
  file: File,
  context: ScanMarksheetContext,
  options: { recognizedMarksheetId?: string | null; selectedMarksheetId?: string } = {},
): Promise<ScanUploadResponse> {
  const form = new FormData();
  form.append("file", file);
  form.append("context", JSON.stringify(context));
  if (options.recognizedMarksheetId) form.append("recognizedMarksheetId", options.recognizedMarksheetId);
  if (options.selectedMarksheetId) form.append("selectedMarksheetId", options.selectedMarksheetId);

  const response = await fetch(`${API_BASE}/api/imports/scans/upload`, {
    method: "POST",
    headers: makeRequestHeaders(),
    body: form,
  });
  if (!response.ok) throw new Error(await parseApiError(response, "Could not upload scan"));
  return response.json();
}

export async function loadScanBatch(batchId: string): Promise<ScanBatchReloadResponse> {
  const response = await fetch(`${API_BASE}/api/imports/scan-batches/${encodeURIComponent(batchId)}`, {
    headers: makeRequestHeaders(),
  });
  if (!response.ok) throw new Error(await parseApiError(response, "Could not load scan batch"));
  return response.json();
}

export async function fetchScanBatches(): Promise<ScanImportBatch[]> {
  const response = await fetch(`${API_BASE}/api/imports/scans/batches`, {
    headers: makeRequestHeaders(),
  });
  if (!response.ok) throw new Error(await parseApiError(response, "Could not load scan batches"));
  const body = await response.json();
  return (body.batches ?? []) as ScanImportBatch[];
}

export async function dryRunScanRows(
  context: ScanMarksheetContext,
  rows: ScanImportRow[],
  batchId?: string,
): Promise<ScanRowsValidationResponse> {
  const response = await fetch(`${API_BASE}/api/imports/scans/dry-run`, {
    method: "POST",
    headers: makeRequestHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ context, rows, batchId }),
  });
  if (!response.ok) throw new Error(await parseApiError(response, "Could not validate scanned marks"));
  return response.json();
}

export async function commitScanRows(
  context: ScanMarksheetContext,
  rows: ScanImportRow[],
): Promise<ScanRowsCommitResponse> {
  const response = await fetch(`${API_BASE}/api/imports/scans/commit`, {
    method: "POST",
    headers: makeRequestHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ context, rows }),
  });
  if (!response.ok) throw new Error(await parseApiError(response, "Could not commit scanned marks"));
  return response.json();
}

// -- Gemini marksheet scan options -------------------------------------------

export async function fetchScanOptions(): Promise<ScanOptions> {
  const response = await fetch(`${API_BASE}/api/marks-import/scan/options`, {
    headers: makeRequestHeaders(),
  });
  if (!response.ok) throw new Error(await parseApiError(response, "Could not load import options"));
  return response.json();
}

// -- Gemini marksheet scan extraction ----------------------------------------

export async function extractMarksWithGeminiScan(
  image: File,
  context: GeminiScanContext,
): Promise<GeminiScanExtractResponse> {
  const form = new FormData();
  form.append("image", image);
  form.append("classId", context.classId);
  if (context.streamId) form.append("streamId", context.streamId);
  form.append("subjectId", context.subjectId);
  form.append("termId", context.termId);
  form.append("examType", context.examType);

  const response = await fetch(`${API_BASE}/api/marks-import/scan/extract`, {
    method: "POST",
    headers: makeRequestHeaders(),
    body: form,
  });
  if (!response.ok) throw new Error(await parseApiError(response, "Gemini extraction failed"));
  return response.json();
}

export async function commitGeminiScanRows(
  jobId: string,
  reviewedRows: GeminiScanRow[],
): Promise<GeminiCommitResponse> {
  const response = await fetch(`${API_BASE}/api/marks-import/scan/commit`, {
    method: "POST",
    headers: makeRequestHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ jobId, reviewedRows }),
  });
  if (!response.ok) throw new Error(await parseApiError(response, "Could not save marks"));
  return response.json();
}

export async function fetchSmartPagesBalance(): Promise<{ remainingPages: number; trialClaimed: boolean }> {
  try {
    const response = await fetch(`${API_BASE}/api/smart-pages/billing/summary`, {
      headers: makeRequestHeaders(),
    });
    if (!response.ok) return { remainingPages: -1, trialClaimed: false };
    const data = await response.json() as { summary?: { remainingPages?: number; trialClaimed?: boolean } };
    return {
      remainingPages: data?.summary?.remainingPages ?? -1,
      trialClaimed: data?.summary?.trialClaimed ?? false,
    };
  } catch {
    return { remainingPages: -1, trialClaimed: false };
  }
}
