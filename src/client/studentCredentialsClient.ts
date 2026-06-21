import type { CredentialStatus, NfcTokenResolution, StudentCredential, StudentCredentialScanResult } from "../shared/types/studentCredentials";
import { getApiBaseUrl, makeSchoolRequestHeaders, parseApiError } from "./apiBase";

const API_BASE = getApiBaseUrl();

export async function fetchStudentCredentials(filters: { search?: string; studentId?: string; status?: CredentialStatus | "" } = {}) {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.studentId) params.set("studentId", filters.studentId);
  if (filters.status) params.set("status", filters.status);
  const response = await fetch(`${API_BASE}/api/student-credentials?${params.toString()}`, {
    headers: makeSchoolRequestHeaders(),
  });
  if (!response.ok) throw new Error(await parseApiError(response, "Could not load NFC wristbands"));
  return response.json() as Promise<{ credentials: StudentCredential[] }>;
}

export async function issueStudentCredential(input: { studentId: string; credentialUID: string }) {
  const response = await fetch(`${API_BASE}/api/student-credentials`, {
    method: "POST",
    headers: makeSchoolRequestHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error(await parseApiError(response, "Could not register NFC wristband"));
  return response.json() as Promise<{ credential: StudentCredential }>;
}

export async function deactivateStudentCredential(credentialId: string, reason: string) {
  const response = await fetch(`${API_BASE}/api/student-credentials/${encodeURIComponent(credentialId)}/deactivate`, {
    method: "PATCH",
    headers: makeSchoolRequestHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ reason }),
  });
  if (!response.ok) throw new Error(await parseApiError(response, "Could not deactivate NFC wristband"));
  return response.json() as Promise<{ credential: StudentCredential }>;
}

export async function scanStudentCredential(credentialUID: string) {
  const response = await fetch(`${API_BASE}/api/student-credentials/scan`, {
    method: "POST",
    headers: makeSchoolRequestHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ credentialUID, context: "VERIFY" }),
  });
  if (!response.ok) throw new Error(await parseApiError(response, "Could not scan NFC wristband"));
  return response.json() as Promise<StudentCredentialScanResult>;
}

export async function resolveNfcToken(token: string) {
  const response = await fetch(`${API_BASE}/api/nfc/t/${encodeURIComponent(token)}`, {
    headers: makeSchoolRequestHeaders(),
  });
  if (!response.ok) throw new Error(await parseApiError(response, "Could not verify NFC wristband"));
  return response.json() as Promise<NfcTokenResolution>;
}
