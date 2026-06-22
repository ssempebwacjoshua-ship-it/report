import type {
  AllocationResult,
  AllocationStatus,
  AttendanceDirection,
  CredentialStatus,
  NfcAttendanceDashboard,
  NfcCanteenChargeResult,
  NfcGateDashboard,
  NfcGateScanResponse,
  NfcTokenResolution,
  NfcWalletDashboard,
  NfcWalletStudentResolution,
  NfcWalletTopUpResult,
  StudentCredential,
  StudentCredentialScanResult,
  WalletPaymentMethod,
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

export async function fetchCredentialAllocation(
  filters: { classId?: string; streamId?: string; status?: AllocationStatus | "ALL" | ""; search?: string } = {},
) {
  const params = new URLSearchParams();
  if (filters.classId) params.set("classId", filters.classId);
  if (filters.streamId) params.set("streamId", filters.streamId);
  if (filters.status && filters.status !== "ALL") params.set("status", filters.status);
  if (filters.search) params.set("search", filters.search);
  const response = await fetch(`${API_BASE}/api/student-credentials/allocation?${params}`, {
    headers: makeSchoolRequestHeaders(),
  });
  if (!response.ok) throw new Error(await parseApiError(response, "Could not load allocation data"));
  return response.json() as Promise<AllocationResult>;
}

export async function bulkAllocateStudentCredentials(input: {
  reason: string;
  assignments: Array<{ studentId: string; credentialUID: string }>;
}) {
  const response = await fetch(`${API_BASE}/api/student-credentials/bulk-allocate`, {
    method: "POST",
    headers: makeSchoolRequestHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error(await parseApiError(response, "Bulk allocation failed"));
  return response.json() as Promise<{ credentials: StudentCredential[] }>;
}

export async function amendStudentCredential(
  credentialId: string,
  input: { studentId?: string; credentialUID?: string; reason: string },
) {
  const response = await fetch(`${API_BASE}/api/student-credentials/${encodeURIComponent(credentialId)}/amend`, {
    method: "PATCH",
    headers: makeSchoolRequestHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error(await parseApiError(response, "Could not amend NFC wristband"));
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

export async function resolveWalletStudent(
  input: { studentId?: string; admissionNumber?: string; tokenOrUid?: string },
) {
  const response = await fetch(`${API_BASE}/api/nfc/wallets/resolve-student`, {
    method: "POST",
    headers: makeSchoolRequestHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error(await parseApiError(response, "Could not resolve student"));
  return response.json() as Promise<NfcWalletStudentResolution>;
}

export async function fetchWalletBalance(studentId: string) {
  return resolveWalletStudent({ studentId });
}

export async function topUpNfcWallet(input: {
  studentId?: string;
  admissionNumber?: string;
  tokenOrUid?: string;
  amountUgx: number;
  paymentMethod: WalletPaymentMethod;
  reference?: string;
  notes?: string;
  idempotencyKey?: string;
}) {
  const response = await fetch(`${API_BASE}/api/nfc/wallets/top-up`, {
    method: "POST",
    headers: makeSchoolRequestHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error(await parseApiError(response, "Could not top up student wallet"));
  return response.json() as Promise<NfcWalletTopUpResult>;
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
