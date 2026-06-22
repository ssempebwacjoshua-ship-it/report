import type {
  NfcGenerateResponse,
  NfcResolveResponse,
  NfcTag,
  NfcTagEventsResponse,
  NfcTagListResponse,
} from "../shared/types/nfcTags";

function getApiBaseUrl() {
  return import.meta.env.VITE_API_BASE_URL ?? "";
}

function makeSchoolRequestHeaders(): Record<string, string> {
  const token = localStorage.getItem("authToken");
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

async function parseApiError(res: Response, fallback: string): Promise<string> {
  try {
    const body = await res.json();
    return body?.error ?? body?.message ?? fallback;
  } catch {
    return fallback;
  }
}

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
    headers: makeSchoolRequestHeaders(),
    body: JSON.stringify({ count }),
  });
  if (!res.ok) throw new Error(await parseApiError(res, "Failed to generate NFC tags."));
  return res.json();
}

export async function assignNfcTag(tagId: string, studentId: string): Promise<NfcTag> {
  const res = await fetch(`${getApiBaseUrl()}/api/nfc/tags/${tagId}/assign`, {
    method: "PATCH",
    headers: makeSchoolRequestHeaders(),
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
  const token = localStorage.getItem("authToken");
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${getApiBaseUrl()}/api/nfc/resolve/${publicCode}`, { headers });
  if (!res.ok) throw new Error(await parseApiError(res, "Failed to resolve NFC tag."));
  return res.json();
}
