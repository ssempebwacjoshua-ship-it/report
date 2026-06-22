import { getApiBaseUrl, makeSchoolRequestHeaders, parseApiError } from "./apiBase";
import type {
  NfcGenerateResponse,
  NfcInventoryAllocateResponse,
  NfcResolveResponse,
  NfcTag,
  NfcTagBatchListResponse,
  NfcTagEventsResponse,
  NfcTagInventoryResponse,
  NfcTagListResponse,
  NfcTagMode,
  NfcTagStatus,
  NfcUidImportResponse,
  NfcUrlBatchCreateResponse,
} from "../shared/types/nfcTags";

export async function listNfcTags(filters: { status?: string } = {}): Promise<NfcTagListResponse> {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  const res = await fetch(`${getApiBaseUrl()}/api/nfc/tags?${params}`, {
    headers: makeSchoolRequestHeaders(),
  });
  if (!res.ok) throw new Error(await parseApiError(res, "Failed to load NFC tags."));
  return res.json();
}

export async function generateNfcTags(count: number): Promise<NfcGenerateResponse> {
  const res = await fetch(`${getApiBaseUrl()}/api/nfc/tags/generate`, {
    method: "POST",
    headers: makeSchoolRequestHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ count }),
  });
  if (!res.ok) throw new Error(await parseApiError(res, "Failed to generate NFC tags."));
  return res.json();
}

export async function assignNfcTag(tagId: string, studentId: string): Promise<NfcTag> {
  const res = await fetch(`${getApiBaseUrl()}/api/nfc/tags/${tagId}/assign`, {
    method: "PATCH",
    headers: makeSchoolRequestHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ studentId }),
  });
  if (!res.ok) throw new Error(await parseApiError(res, "Failed to assign NFC tag."));
  return res.json();
}

export async function unassignNfcTag(tagId: string): Promise<{ id: string; status: string }> {
  const res = await fetch(`${getApiBaseUrl()}/api/nfc/tags/${tagId}/unassign`, {
    method: "PATCH",
    headers: makeSchoolRequestHeaders(),
  });
  if (!res.ok) throw new Error(await parseApiError(res, "Failed to unassign NFC tag."));
  return res.json();
}

export async function disableNfcTag(tagId: string): Promise<{ id: string; status: string }> {
  const res = await fetch(`${getApiBaseUrl()}/api/nfc/tags/${tagId}/disable`, {
    method: "PATCH",
    headers: makeSchoolRequestHeaders(),
  });
  if (!res.ok) throw new Error(await parseApiError(res, "Failed to disable NFC tag."));
  return res.json();
}

export async function getNfcTagEvents(tagId: string): Promise<NfcTagEventsResponse> {
  const res = await fetch(`${getApiBaseUrl()}/api/nfc/tags/${tagId}/events`, {
    headers: makeSchoolRequestHeaders(),
  });
  if (!res.ok) throw new Error(await parseApiError(res, "Failed to load tap events."));
  return res.json();
}

export async function resolveNfcPublicCode(publicCode: string): Promise<NfcResolveResponse> {
  const res = await fetch(`${getApiBaseUrl()}/api/nfc/resolve/${publicCode}`, {
    headers: makeSchoolRequestHeaders(),
  });
  if (!res.ok) throw new Error(await parseApiError(res, "Failed to resolve NFC tag."));
  return res.json();
}

export async function listTagBatches(filters: { tagMode?: NfcTagMode } = {}): Promise<NfcTagBatchListResponse> {
  const params = new URLSearchParams();
  if (filters.tagMode) params.set("tagMode", filters.tagMode);
  const res = await fetch(`${getApiBaseUrl()}/api/nfc/tag-batches?${params}`, {
    headers: makeSchoolRequestHeaders(),
  });
  if (!res.ok) throw new Error(await parseApiError(res, "Failed to load tag batches."));
  return res.json();
}

export async function createUrlTagBatch(input: {
  name: string;
  quantity: number;
  labelPrefix?: string;
}): Promise<NfcUrlBatchCreateResponse> {
  const res = await fetch(`${getApiBaseUrl()}/api/nfc/tag-batches`, {
    method: "POST",
    headers: makeSchoolRequestHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await parseApiError(res, "Failed to create URL tag batch."));
  return res.json();
}

export async function bulkImportUids(input: {
  batchName: string;
  uids: string[];
  reason?: string;
}): Promise<NfcUidImportResponse> {
  const res = await fetch(`${getApiBaseUrl()}/api/nfc/tags/bulk-import-uids`, {
    method: "POST",
    headers: makeSchoolRequestHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await parseApiError(res, "Failed to import UID wristbands."));
  return res.json();
}

export async function listTagInventory(filters: {
  batchId?: string;
  tagMode?: NfcTagMode;
  status?: NfcTagStatus | "ALL" | "";
  search?: string;
} = {}): Promise<NfcTagInventoryResponse> {
  const params = new URLSearchParams();
  if (filters.batchId) params.set("batchId", filters.batchId);
  if (filters.tagMode) params.set("tagMode", filters.tagMode);
  if (filters.status && filters.status !== "ALL") params.set("status", filters.status);
  if (filters.search) params.set("search", filters.search);
  const res = await fetch(`${getApiBaseUrl()}/api/nfc/tags/inventory?${params}`, {
    headers: makeSchoolRequestHeaders(),
  });
  if (!res.ok) throw new Error(await parseApiError(res, "Failed to load tag inventory."));
  return res.json();
}

export async function verifyNfcTag(tagId: string): Promise<NfcTag> {
  const res = await fetch(`${getApiBaseUrl()}/api/nfc/tags/${encodeURIComponent(tagId)}/verify`, {
    method: "PATCH",
    headers: makeSchoolRequestHeaders(),
  });
  if (!res.ok) throw new Error(await parseApiError(res, "Failed to verify NFC tag."));
  return res.json();
}

export async function amendNfcTag(
  tagId: string,
  input: { label?: string; physicalUid?: string; status?: string; reason: string },
): Promise<NfcTag> {
  const res = await fetch(`${getApiBaseUrl()}/api/nfc/tags/${encodeURIComponent(tagId)}/amend`, {
    method: "PATCH",
    headers: makeSchoolRequestHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await parseApiError(res, "Failed to amend NFC tag."));
  return res.json();
}

export async function bulkAllocateFromInventory(input: {
  assignments: Array<{ tagId: string; studentId: string }>;
  reason: string;
}): Promise<NfcInventoryAllocateResponse> {
  const res = await fetch(`${getApiBaseUrl()}/api/nfc/tags/bulk-allocate`, {
    method: "POST",
    headers: makeSchoolRequestHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await parseApiError(res, "Failed to allocate tags from inventory."));
  return res.json();
}
