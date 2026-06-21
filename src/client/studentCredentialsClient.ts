import type {
  AttendanceDirection,
  CredentialStatus,
  NfcAttendanceDashboard,
  NfcCanteenChargeResult,
  NfcGateDashboard,
  NfcGateScanResponse,
  NfcTokenResolution,
  NfcWalletDashboard,
  StudentCredential,
  StudentCredentialScanResult,
} from "../shared/types/studentCredentials";
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

export async function fetchNfcAttendance(filters: { search?: string; classId?: string; streamId?: string } = {}) {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.classId) params.set("classId", filters.classId);
  if (filters.streamId) params.set("streamId", filters.streamId);
  const response = await fetch(`${API_BASE}/api/nfc/attendance?${params.toString()}`, {
    headers: makeSchoolRequestHeaders(),
  });
  if (!response.ok) throw new Error(await parseApiError(response, "Could not load NFC attendance"));
  return response.json() as Promise<NfcAttendanceDashboard>;
}

export async function scanNfcAttendance(input: { tokenOrUid: string; direction: AttendanceDirection }) {
  const response = await fetch(`${API_BASE}/api/nfc/attendance/scan`, {
    method: "POST",
    headers: makeSchoolRequestHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error(await parseApiError(response, "Could not record NFC attendance"));
  return response.json() as Promise<NfcAttendanceDashboard>;
}

export async function fetchNfcWallets(filters: { search?: string; classId?: string; streamId?: string } = {}) {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.classId) params.set("classId", filters.classId);
  if (filters.streamId) params.set("streamId", filters.streamId);
  const response = await fetch(`${API_BASE}/api/nfc/wallets?${params.toString()}`, {
    headers: makeSchoolRequestHeaders(),
  });
  if (!response.ok) throw new Error(await parseApiError(response, "Could not load NFC wallets"));
  return response.json() as Promise<NfcWalletDashboard>;
}

export async function chargeNfcCanteen(input: { tokenOrUid: string; amountCents: number; description?: string; idempotencyKey?: string }) {
  const response = await fetch(`${API_BASE}/api/nfc/canteen/charge`, {
    method: "POST",
    headers: makeSchoolRequestHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error(await parseApiError(response, "Could not charge student wallet"));
  return response.json() as Promise<NfcCanteenChargeResult>;
}

export async function scanNfcGate(input: { tokenOrUid: string }) {
  const response = await fetch(`${API_BASE}/api/nfc/gate/scan`, {
    method: "POST",
    headers: makeSchoolRequestHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error(await parseApiError(response, "Could not verify gate scan"));
  return response.json() as Promise<NfcGateScanResponse>;
}

export async function fetchNfcGateDashboard() {
  const response = await fetch(`${API_BASE}/api/nfc/gate`, {
    headers: makeSchoolRequestHeaders(),
  });
  if (!response.ok) throw new Error(await parseApiError(response, "Could not load gate scans"));
  return response.json() as Promise<NfcGateDashboard>;
}
