import type {
  AllocationResult,
  AllocationStatus,
  AttendanceDirection,
  AttendanceCurrentStatus,
  AttendanceLateAction,
  ClassroomAttendanceReport,
  CredentialStatus,
  CanteenReconciliationRecord,
  DailySummary,
  GateAttendanceReport,
  NfcCanteenReconciliationResponse,
  NfcAttendanceDashboard,
  NfcAttendanceScanResponse,
  NfcCanteenChargeResult,
  NfcGateDashboard,
  NfcGateScanResponse,
  NfcTokenResolution,
  NfcWalletDashboard,
  NfcFeeHold,
  NfcFeeHoldListResponse,
  NfcPolicyResponse,
  StudentWalletDetail,
  NfcWalletStudentResolution,
  NfcWalletTopUpResult,
  StudentCredential,
  StudentCredentialScanResult,
  WalletAdjustResult,
  WalletPaymentMethod,
  WalletPinStatus,
  WalletReversalResult,
  WalletTransactionListResponse,
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

export async function reactivateStudentCredential(credentialId: string, reason: string) {
  const response = await fetch(`${API_BASE}/api/student-credentials/${encodeURIComponent(credentialId)}/reactivate`, {
    method: "PATCH",
    headers: makeSchoolRequestHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ reason }),
  });
  if (!response.ok) throw new Error(await parseApiError(response, "Could not re-enable NFC wristband"));
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

export async function scanNfcAttendance(input: {
  tokenOrUid: string;
  direction?: AttendanceDirection;
  idempotencyKey?: string;
  deviceId?: string;
}) {
  const response = await fetch(`${API_BASE}/api/nfc/attendance/scan`, {
    method: "POST",
    headers: makeSchoolRequestHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error(await parseApiError(response, "Could not record NFC attendance"));
  return response.json() as Promise<NfcAttendanceScanResponse>;
}

export type AttendanceRegisterScanEvent = {
  id: string;
  scannedAt: string;
  source: string;
};

export type AttendanceRegisterLastScan = {
  id: string;
  direction: string;
  scannedAt: string;
  status: string;
  reason: string | null;
};

export type AttendanceRegisterRow = {
  student: {
    id: string;
    name: string;
    admissionNumber: string;
    className: string | null;
    streamName: string | null;
    studentType: "DAY" | "BOARDING" | null;
    photoUrl: string | null;
  };
  tapIn: AttendanceRegisterScanEvent | null;
  tapOut: AttendanceRegisterScanEvent | null;
  lastScan: AttendanceRegisterLastScan | null;
  currentStatus: AttendanceCurrentStatus;
};

export type AttendanceRegisterResponse = {
  date: string;
  summary: {
    totalStudents: number;
    present: number;
    out: number;
    absent: number;
    blockedScans: number;
    duplicateScans: number;
  };
  rows: AttendanceRegisterRow[];
};

export async function fetchNfcPolicy() {
  const response = await fetch(`${API_BASE}/api/nfc/policy`, {
    headers: makeSchoolRequestHeaders(),
  });
  if (!response.ok) throw new Error(await parseApiError(response, "Could not load NFC policy"));
  return response.json() as Promise<NfcPolicyResponse>;
}

export async function updateNfcPolicy(input: {
  feeDefaulterBlockingEnabled: boolean;
  feeDefaulterBlockScope: "DAY_SCHOLARS_ONLY" | "ALL_STUDENTS";
  attendanceTapInCutoffEnabled: boolean;
  tapInCutoffTime?: string | null;
  cutoffLateAction: AttendanceLateAction;
  timezone: string;
  duplicateWindowSeconds: number;
  gateArrivalStart: string;
  gateArrivalLateAfter: string;
  gateArrivalEnd: string;
  morningClassroomStart: string;
  morningClassroomEnd: string;
  gateDepartureStart: string;
  gateDepartureEnd: string;
  nightPrepStart: string;
  nightPrepEnd: string;
  nightPrepBoardingOnly: boolean;
  allowAutomaticCheckout: boolean;
  recordUnclassifiedScans: boolean;
  feeGatePolicyEnabled: boolean;
  gateOfflineEnabled: boolean;
  canteenOfflineEnabled: boolean;
  gateSnapshotValidHours: number;
  canteenSnapshotValidHours: number;
  maxOfflineSpendPerStudentPerDay: number;
  maxOfflineSpendPerTransaction: number;
  maxOfflineSpendPerDeviceSession: number;
  unknownCardOfflinePolicy: "DENY";
  frozenCardOfflinePolicy: "DENY";
  deactivatedCardOfflinePolicy: "DENY";
  offlineConflictPolicy: "ALLOW_AND_FLAG" | "HOLD_FOR_BURSAR_REVIEW";
}) {
  const response = await fetch(`${API_BASE}/api/nfc/policy`, {
    method: "PUT",
    headers: makeSchoolRequestHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error(await parseApiError(response, "Could not save NFC policy"));
  return response.json() as Promise<NfcPolicyResponse>;
}

export async function fetchNfcFeeHolds(filters: { search?: string; classId?: string; streamId?: string; studentType?: string; status?: string } = {}) {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.classId) params.set("classId", filters.classId);
  if (filters.streamId) params.set("streamId", filters.streamId);
  if (filters.studentType && filters.studentType !== "ALL") params.set("studentType", filters.studentType);
  if (filters.status && filters.status !== "ALL") params.set("status", filters.status);
  const response = await fetch(`${API_BASE}/api/nfc/fee-holds?${params.toString()}`, {
    headers: makeSchoolRequestHeaders(),
  });
  if (!response.ok) throw new Error(await parseApiError(response, "Could not load fee holds"));
  return response.json() as Promise<NfcFeeHoldListResponse>;
}

export async function searchNfcFeeHoldStudents(filters: { search?: string; classId?: string; streamId?: string; studentType?: string } = {}) {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.classId) params.set("classId", filters.classId);
  if (filters.streamId) params.set("streamId", filters.streamId);
  if (filters.studentType && filters.studentType !== "ALL") params.set("studentType", filters.studentType);
  const response = await fetch(`${API_BASE}/api/nfc/fee-holds/students?${params.toString()}`, {
    headers: makeSchoolRequestHeaders(),
  });
  if (!response.ok) throw new Error(await parseApiError(response, "Could not search students"));
  return response.json() as Promise<{ students: Array<{ id: string; studentName: string; admissionNumber: string; className: string | null; streamName: string | null; studentType: "DAY" | "BOARDING" | null; isActive: boolean }> }>;
}

export async function createNfcFeeHold(input: {
  studentId: string;
  reason?: string | null;
  balanceDueCents?: number | null;
  effectiveFrom?: string | null;
}) {
  const response = await fetch(`${API_BASE}/api/nfc/fee-holds`, {
    method: "POST",
    headers: makeSchoolRequestHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error(await parseApiError(response, "Could not create fee hold"));
  return response.json() as Promise<{ feeHold: NfcFeeHold }>;
}

export async function clearNfcFeeHold(holdId: string, reason?: string | null) {
  const response = await fetch(`${API_BASE}/api/nfc/fee-holds/${encodeURIComponent(holdId)}/clear`, {
    method: "PATCH",
    headers: makeSchoolRequestHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ reason }),
  });
  if (!response.ok) throw new Error(await parseApiError(response, "Could not clear fee hold"));
  return response.json() as Promise<{ feeHold: NfcFeeHold }>;
}

export async function fetchNfcAttendanceRegister(
  filters: { date?: string; classId?: string; streamId?: string; search?: string; studentType?: string } = {},
) {
  const params = new URLSearchParams();
  if (filters.date) params.set("date", filters.date);
  if (filters.classId) params.set("classId", filters.classId);
  if (filters.streamId) params.set("streamId", filters.streamId);
  if (filters.search) params.set("search", filters.search);
  if (filters.studentType && filters.studentType !== "ALL") params.set("studentType", filters.studentType);
  const response = await fetch(`${API_BASE}/api/nfc/attendance/register?${params.toString()}`, {
    headers: makeSchoolRequestHeaders(),
  });
  if (!response.ok) throw new Error(await parseApiError(response, "Could not load attendance register"));
  return response.json() as Promise<AttendanceRegisterResponse>;
}

export async function fetchGateAttendanceReport(
  filters: {
    date?: string;
    classId?: string;
    streamId?: string;
    search?: string;
    studentType?: string;
    attendanceStatus?: string;
    campusStatus?: string;
    departureMissing?: boolean;
  } = {},
) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value === undefined || value === "" || value === false) return;
    params.set(key, String(value));
  });
  const response = await fetch(`${API_BASE}/api/nfc/attendance/gate-report?${params.toString()}`, {
    headers: makeSchoolRequestHeaders(),
  });
  if (!response.ok) throw new Error(await parseApiError(response, "Could not load gate attendance report"));
  return response.json() as Promise<GateAttendanceReport>;
}

export async function fetchClassroomAttendanceReport(
  filters: {
    date?: string;
    classId?: string;
    streamId?: string;
    search?: string;
    studentType?: string;
    sessionType?: string;
  } = {},
) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (!value) return;
    params.set(key, String(value));
  });
  const response = await fetch(`${API_BASE}/api/nfc/attendance/classroom-report?${params.toString()}`, {
    headers: makeSchoolRequestHeaders(),
  });
  if (!response.ok) throw new Error(await parseApiError(response, "Could not load classroom attendance report"));
  return response.json() as Promise<ClassroomAttendanceReport>;
}

export async function approveGateAttendanceOverride(input: { studentId: string; reason: string; expiresAt: string }) {
  const response = await fetch(`${API_BASE}/api/nfc/attendance/gate-overrides`, {
    method: "POST",
    headers: makeSchoolRequestHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error(await parseApiError(response, "Could not approve gate override"));
  return response.json() as Promise<{ gateOverride: { id: string; status: string; activeUntil: string | null }; idempotent: boolean }>;
}

export type AttendanceClassItem = {
  id: string;
  name: string;
  code: string;
  streams: Array<{ id: string; name: string; code: string }>;
};

export async function fetchAttendanceClasses(): Promise<{ classes: AttendanceClassItem[] }> {
  const response = await fetch(`${API_BASE}/api/nfc/classes`, {
    headers: makeSchoolRequestHeaders(),
  });
  if (!response.ok) throw new Error(await parseApiError(response, "Could not load class list"));
  return response.json() as Promise<{ classes: AttendanceClassItem[] }>;
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

export async function chargeNfcCanteen(input: { tokenOrUid: string; amountCents: number; pin: string; description?: string; idempotencyKey?: string; deviceId?: string }) {
  const response = await fetch(`${API_BASE}/api/nfc/canteen/charge`, {
    method: "POST",
    headers: makeSchoolRequestHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error(await parseApiError(response, "Could not charge student wallet"));
  return response.json() as Promise<NfcCanteenChargeResult>;
}

export async function listWalletTransactions(filters: {
  dateFrom?: string; dateTo?: string; studentId?: string; admissionNumber?: string;
  classId?: string; streamId?: string; cashierUserId?: string; type?: string; search?: string;
} = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v); });
  const response = await fetch(`${API_BASE}/api/nfc/wallet-transactions?${params}`, {
    headers: makeSchoolRequestHeaders(),
  });
  if (!response.ok) throw new Error(await parseApiError(response, "Could not load wallet transactions"));
  return response.json() as Promise<WalletTransactionListResponse>;
}

export async function reverseWalletTransaction(transactionId: string, reason: string) {
  const response = await fetch(`${API_BASE}/api/nfc/wallet-transactions/${encodeURIComponent(transactionId)}/reverse`, {
    method: "POST",
    headers: makeSchoolRequestHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ reason }),
  });
  if (!response.ok) throw new Error(await parseApiError(response, "Could not reverse transaction"));
  return response.json() as Promise<WalletReversalResult>;
}

export async function adjustNfcWallet(input: {
  studentId?: string; admissionNumber?: string; amountUgx: number; reason: string;
}) {
  const response = await fetch(`${API_BASE}/api/nfc/wallets/adjust`, {
    method: "POST",
    headers: makeSchoolRequestHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error(await parseApiError(response, "Could not adjust wallet"));
  return response.json() as Promise<WalletAdjustResult>;
}

export async function getDailySummary(filters: { date?: string; cashierUserId?: string } = {}) {
  const params = new URLSearchParams();
  if (filters.date) params.set("date", filters.date);
  if (filters.cashierUserId) params.set("cashierUserId", filters.cashierUserId);
  const response = await fetch(`${API_BASE}/api/nfc/canteen/daily-summary?${params}`, {
    headers: makeSchoolRequestHeaders(),
  });
  if (!response.ok) throw new Error(await parseApiError(response, "Could not load daily summary"));
  return response.json() as Promise<DailySummary>;
}

export async function fetchNfcCanteenReconciliation(filters: { date?: string; cashierUserId?: string; shiftName?: string } = {}) {
  const params = new URLSearchParams();
  if (filters.date) params.set("date", filters.date);
  if (filters.cashierUserId) params.set("cashierUserId", filters.cashierUserId);
  if (filters.shiftName) params.set("shiftName", filters.shiftName);
  const response = await fetch(`${API_BASE}/api/nfc/canteen/reconciliation?${params.toString()}`, {
    headers: makeSchoolRequestHeaders(),
  });
  if (!response.ok) throw new Error(await parseApiError(response, "Could not load canteen reconciliation"));
  return response.json() as Promise<NfcCanteenReconciliationResponse>;
}

export async function closeNfcCanteenReconciliation(input: {
  date: string;
  cashierUserId?: string | null;
  shiftName?: string | null;
  canteenOperatorUserId?: string | null;
  declaredCashUgx: number;
  declaredMobileMoneyUgx: number;
  notes?: string | null;
}) {
  const response = await fetch(`${API_BASE}/api/nfc/canteen/reconciliation/close`, {
    method: "POST",
    headers: makeSchoolRequestHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error(await parseApiError(response, "Could not close canteen reconciliation"));
  return response.json() as Promise<{ reconciliation: CanteenReconciliationRecord }>;
}

export async function approveNfcCanteenReconciliation(id: string) {
  const response = await fetch(`${API_BASE}/api/nfc/canteen/reconciliation/${encodeURIComponent(id)}/approve`, {
    method: "POST",
    headers: makeSchoolRequestHeaders({ "Content-Type": "application/json" }),
  });
  if (!response.ok) throw new Error(await parseApiError(response, "Could not approve canteen reconciliation"));
  return response.json() as Promise<{ reconciliation: CanteenReconciliationRecord }>;
}

export async function rejectNfcCanteenReconciliation(id: string, notes: string) {
  const response = await fetch(`${API_BASE}/api/nfc/canteen/reconciliation/${encodeURIComponent(id)}/reject`, {
    method: "POST",
    headers: makeSchoolRequestHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ notes }),
  });
  if (!response.ok) throw new Error(await parseApiError(response, "Could not reject canteen reconciliation"));
  return response.json() as Promise<{ reconciliation: CanteenReconciliationRecord }>;
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
  const response = await fetch(`${API_BASE}/api/wallet/top-up`, {
    method: "POST",
    headers: makeSchoolRequestHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error(await parseApiError(response, "Could not top up student wallet"));
  return response.json() as Promise<NfcWalletTopUpResult>;
}

export async function fetchStudentWallet(studentId: string) {
  const response = await fetch(`${API_BASE}/api/nfc/students/${encodeURIComponent(studentId)}/wallet`, {
    headers: makeSchoolRequestHeaders(),
  });
  if (!response.ok) throw new Error(await parseApiError(response, "Could not load student wallet"));
  return response.json() as Promise<StudentWalletDetail>;
}

export async function scanNfcGate(input: { tokenOrUid: string; idempotencyKey?: string; deviceId?: string }) {
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

export async function getWalletPinStatus(walletId: string) {
  const response = await fetch(`${API_BASE}/api/nfc/wallets/${encodeURIComponent(walletId)}/pin-status`, {
    headers: makeSchoolRequestHeaders(),
  });
  if (!response.ok) throw new Error(await parseApiError(response, "Could not load PIN status"));
  return response.json() as Promise<WalletPinStatus>;
}

export async function setWalletPin(walletId: string, pin: string, reason: string) {
  const response = await fetch(`${API_BASE}/api/nfc/wallets/${encodeURIComponent(walletId)}/pin`, {
    method: "POST",
    headers: makeSchoolRequestHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ pin, reason }),
  });
  if (!response.ok) throw new Error(await parseApiError(response, "Could not set wallet PIN"));
  return response.json() as Promise<{ ok: boolean; pinSet: boolean }>;
}

export async function changeWalletPin(walletId: string, oldPin: string, newPin: string) {
  const response = await fetch(`${API_BASE}/api/nfc/wallets/${encodeURIComponent(walletId)}/pin`, {
    method: "PATCH",
    headers: makeSchoolRequestHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ oldPin, newPin }),
  });
  if (!response.ok) throw new Error(await parseApiError(response, "Could not change wallet PIN"));
  return response.json() as Promise<{ ok: boolean }>;
}

export async function setStudentWalletPin(studentId: string, input: { pin: string; reason: string }) {
  const response = await fetch(`${API_BASE}/api/nfc/wallets/student/${encodeURIComponent(studentId)}/pin`, {
    method: "POST",
    headers: makeSchoolRequestHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error(await parseApiError(response, "Could not set wallet PIN"));
  return response.json() as Promise<{ walletId: string; studentId: string; pinSet: boolean; pinLocked: boolean; pinLockedUntil: string | null }>;
}

export async function getStudentWalletPinStatus(studentId: string) {
  const response = await fetch(`${API_BASE}/api/nfc/wallets/student/${encodeURIComponent(studentId)}/pin-status`, {
    headers: makeSchoolRequestHeaders(),
  });
  if (!response.ok) throw new Error(await parseApiError(response, "Could not load PIN status"));
  return response.json() as Promise<WalletPinStatus>;
}
