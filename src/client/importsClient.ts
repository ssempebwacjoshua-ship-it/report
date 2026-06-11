import type { ImportPreview, ScanImportBatch, ScanUploadPayload, ScanUploadResponse } from "../shared/types/imports";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4300";

async function readImportError(response: Response, fallback: string): Promise<string> {
  try {
    const body = await response.json();
    if (typeof body?.error === "string") return body.error;
    if (Array.isArray(body?.issues) && body.issues.length)
      return body.issues.map((issue: { message?: string }) => issue.message).join("; ");
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

// ── Scanned handwritten marksheet import ─────────────────────────────────────

export async function uploadScanMetadata(payload: ScanUploadPayload): Promise<ScanUploadResponse> {
  const response = await fetch(`${API_BASE}/api/imports/scans/upload`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(await readImportError(response, "Could not upload scan"));
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
