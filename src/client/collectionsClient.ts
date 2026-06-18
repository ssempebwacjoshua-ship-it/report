const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4300";

function authHeaders(): HeadersInit {
  const stored = localStorage.getItem("sc_auth_token") ?? localStorage.getItem("sp_creator_token");
  return stored ? { Authorization: `Bearer ${stored}`, "Content-Type": "application/json" } : { "Content-Type": "application/json" };
}

async function json<T>(res: Response): Promise<T> {
  const text = await res.text();
  const data = text ? (JSON.parse(text) as T) : ({} as T);
  if (!res.ok) throw new Error((data as any)?.error ?? `HTTP ${res.status}`);
  return data;
}

// ── Types ──────────────────────────────────────────────────────────────────────

export interface CollectionRecord {
  id: string;
  data: Record<string, unknown>;
  sortOrder: number;
}

export interface Collection {
  id: string;
  name: string;
  type: string;
  createdAt: string;
  updatedAt: string;
  recordCount?: number;
  records?: CollectionRecord[];
}

export interface BulkJobSummary {
  id: string;
  collectionId: string;
  collectionName: string;
  intent: string;
  status: string;
  totalRecords: number;
  processedRecords: number;
  failedRecords: number;
  progressPct: number;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface BulkJobOutput {
  id: string;
  recordId: string;
  recordData: Record<string, unknown>;
  documentId: string | null;
  publishToken: string | null;
  status: string;
  error: string | null;
}

// ── Collections ────────────────────────────────────────────────────────────────

export async function listCollections(): Promise<Collection[]> {
  const res = await fetch(`${API_BASE}/api/collections`, { headers: authHeaders() });
  const data = await json<{ ok: boolean; collections: Collection[] }>(res);
  return data.collections;
}

export async function createCollection(name: string, type?: string): Promise<Collection> {
  const res = await fetch(`${API_BASE}/api/collections`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ name, type }),
  });
  const data = await json<{ ok: boolean; collection: Collection }>(res);
  return data.collection;
}

export async function getCollection(id: string): Promise<Collection> {
  const res = await fetch(`${API_BASE}/api/collections/${id}`, { headers: authHeaders() });
  const data = await json<{ ok: boolean; collection: Collection }>(res);
  return data.collection;
}

export async function updateCollection(id: string, name: string, type?: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/collections/${id}`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify({ name, type }),
  });
  await json<{ ok: boolean }>(res);
}

export async function deleteCollection(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/collections/${id}`, { method: "DELETE", headers: authHeaders() });
  await json<{ ok: boolean }>(res);
}

export async function addRecord(collectionId: string, data: Record<string, unknown>): Promise<{ id: string }> {
  const res = await fetch(`${API_BASE}/api/collections/${collectionId}/records`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ data }),
  });
  return json<{ ok: boolean; id: string }>(res);
}

export async function deleteRecord(collectionId: string, recordId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/collections/${collectionId}/records/${recordId}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  await json<{ ok: boolean }>(res);
}

export async function importCSV(collectionId: string, file: File): Promise<{ imported: number; skipped: number }> {
  const form = new FormData();
  form.append("file", file);
  const stored = localStorage.getItem("sc_auth_token") ?? localStorage.getItem("sp_creator_token");
  const headers: HeadersInit = stored ? { Authorization: `Bearer ${stored}` } : {};
  const res = await fetch(`${API_BASE}/api/collections/${collectionId}/import-csv`, {
    method: "POST",
    headers,
    body: form,
  });
  return json<{ ok: boolean; imported: number; skipped: number }>(res);
}

// ── Bulk generation jobs ───────────────────────────────────────────────────────

export async function createBulkJob(collectionId: string, intent: string): Promise<BulkJobSummary> {
  const res = await fetch(`${API_BASE}/api/bulk-jobs`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ collectionId, intent }),
  });
  const data = await json<{ ok: boolean; job: BulkJobSummary }>(res);
  return data.job;
}

export async function listBulkJobs(): Promise<BulkJobSummary[]> {
  const res = await fetch(`${API_BASE}/api/bulk-jobs`, { headers: authHeaders() });
  const data = await json<{ ok: boolean; jobs: BulkJobSummary[] }>(res);
  return data.jobs;
}

export async function getBulkJobDetail(jobId: string): Promise<{ job: BulkJobSummary; outputs: BulkJobOutput[] }> {
  const res = await fetch(`${API_BASE}/api/bulk-jobs/${jobId}`, { headers: authHeaders() });
  return json<{ ok: boolean; job: BulkJobSummary; outputs: BulkJobOutput[] }>(res);
}

