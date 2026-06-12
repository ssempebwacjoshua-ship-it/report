import type { ImportPreview } from "../shared/types/imports";
import type { MarksheetBatchContext, MarksheetBatchesResponse, MarksheetStudentsResponse } from "../shared/types/marksheets";
import { getApiBaseUrl } from "./apiBase";
const API_BASE = getApiBaseUrl();

async function readError(response: Response, fallback: string): Promise<string> {
  try {
    const body = await response.json();
    if (typeof body?.error === "string") return body.error;
    if (Array.isArray(body?.issues) && body.issues.length) {
      return body.issues.map((i: { message?: string }) => i.message).join("; ");
    }
  } catch {
    return fallback;
  }
  return fallback;
}

export async function fetchMarksheetStudents(
  classId: string,
  streamId: string,
  schoolCode = "SCU-PREVIEW",
): Promise<MarksheetStudentsResponse> {
  const params = new URLSearchParams({ schoolCode, classId, streamId });
  const response = await fetch(`${API_BASE}/api/marksheets/students?${params}`);
  if (!response.ok) throw new Error(await readError(response, "Could not load students"));
  return response.json();
}

export async function fetchMarksheetBatches(schoolCode = "SCU-PREVIEW"): Promise<MarksheetBatchesResponse> {
  const response = await fetch(`${API_BASE}/api/marksheets/batches?schoolCode=${encodeURIComponent(schoolCode)}`);
  if (!response.ok) throw new Error(await readError(response, "Could not load batches"));
  return response.json();
}

export async function commitMarksheetEntry(
  csvText: string,
  context: MarksheetBatchContext,
  schoolCode = "SCU-PREVIEW",
): Promise<ImportPreview> {
  const response = await fetch(`${API_BASE}/api/marksheets/commit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ schoolCode, csvText, context }),
  });
  if (!response.ok) throw new Error(await readError(response, "Could not commit marks"));
  return response.json();
}

export async function approveMarksheetBatch(
  batchId: string,
  note: string,
  schoolCode = "SCU-PREVIEW",
): Promise<void> {
  const response = await fetch(
    `${API_BASE}/api/marksheets/batches/${encodeURIComponent(batchId)}/approve?schoolCode=${encodeURIComponent(schoolCode)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note }),
    },
  );
  if (!response.ok) throw new Error(await readError(response, "Could not approve batch"));
}

export async function returnMarksheetBatch(
  batchId: string,
  note: string,
  schoolCode = "SCU-PREVIEW",
): Promise<void> {
  const response = await fetch(
    `${API_BASE}/api/marksheets/batches/${encodeURIComponent(batchId)}/return?schoolCode=${encodeURIComponent(schoolCode)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note }),
    },
  );
  if (!response.ok) throw new Error(await readError(response, "Could not return batch"));
}
