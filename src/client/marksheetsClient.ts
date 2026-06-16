import type { ImportPreview } from "../shared/types/imports";
import type { MarksheetBatchContext, MarksheetBatchesResponse, MarksheetStudentsResponse } from "../shared/types/marksheets";
import { getApiBaseUrl, makeRequestHeaders, parseApiError } from "./apiBase";

const API_BASE = getApiBaseUrl();

export async function fetchMarksheetStudents(
  classId: string,
  streamId: string,
): Promise<MarksheetStudentsResponse> {
  const params = new URLSearchParams({ classId, streamId });
  const response = await fetch(`${API_BASE}/api/marksheets/students?${params}`, {
    headers: makeRequestHeaders(),
  });
  if (!response.ok) throw new Error(await parseApiError(response, "Could not load students"));
  return response.json();
}

export async function fetchMarksheetBatches(): Promise<MarksheetBatchesResponse> {
  const response = await fetch(`${API_BASE}/api/marksheets/batches`, {
    headers: makeRequestHeaders(),
  });
  if (!response.ok) throw new Error(await parseApiError(response, "Could not load batches"));
  return response.json();
}

export async function commitMarksheetEntry(
  csvText: string,
  context: MarksheetBatchContext,
): Promise<ImportPreview> {
  const response = await fetch(`${API_BASE}/api/marksheets/commit`, {
    method: "POST",
    headers: makeRequestHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ csvText, context }),
  });
  if (!response.ok) throw new Error(await parseApiError(response, "Could not commit marks"));
  return response.json();
}

export async function approveMarksheetBatch(
  batchId: string,
  note: string,
): Promise<void> {
  const response = await fetch(
    `${API_BASE}/api/marksheets/batches/${encodeURIComponent(batchId)}/approve`,
    {
      method: "POST",
      headers: makeRequestHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ note }),
    },
  );
  if (!response.ok) throw new Error(await parseApiError(response, "Could not approve batch"));
}

export async function returnMarksheetBatch(
  batchId: string,
  note: string,
): Promise<void> {
  const response = await fetch(
    `${API_BASE}/api/marksheets/batches/${encodeURIComponent(batchId)}/return`,
    {
      method: "POST",
      headers: makeRequestHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ note }),
    },
  );
  if (!response.ok) throw new Error(await parseApiError(response, "Could not return batch"));
}
