import { getApiBaseUrl, makeRequestHeaders, parseApiError } from "./apiBase";

import type { SmartPagesAdminLedgerRow, SmartPagesPaymentRequest } from "../shared/types/smartPages";

const API_BASE = getApiBaseUrl();
export type OwnerDashboardStats = {
  totalSchools: number;
  activeSchools: number;
  expiredSchools: number;
  suspendedSchools: number;
  noSubscriptionSchools: number;
  totalUsers: number;
  recentSchools: Array<{ id: string; code: string; name: string; createdAt: string }>;
};

export type OwnerSchool = {
  id: string;
  code: string;
  name: string;
  phone: string | null;
  email?: string | null;
  address: string | null;
  logoUrl?: string | null;
  timezone?: string;
  brandingMode?: string;
  isActive: boolean;
  createdAt: string;
  subscription: { planCode: string; status: string; currentPeriodEnd: string; studentLimit: number | null } | null;
  primaryAdmin: { id: string; name: string; email: string } | null;
  studentCount: number;
};

export type CreateOwnerSchoolInput = {
  schoolName: string;
  schoolCode: string;
  phone?: string;
  address?: string;
  sections: Array<"NURSERY" | "PRIMARY" | "SECONDARY" | "COMBINED">;
  defaultStreamCodes?: Array<"A" | "B" | "C" | "D">;
  planCode: string;
  trialDays?: number;
  adminName: string;
  adminEmail: string;
  adminTemporaryPassword: string;
};

export type CreateOwnerSchoolResult = {
  ok: boolean;
  school: { id: string; code: string; name: string; phone: string | null; address: string | null; isActive: boolean };
  subscription: { id: string; planCode: string; status: string; currentPeriodEnd: string; studentLimit: number | null };
  invoice: { id: string; setupFeeUgx: number; amountUgx: number; totalUgx: number; status: string };
  admin: { id: string; email: string; name: string; mustChangePassword: boolean };
  academicYear: { id: string; name: string };
  activeTerm: { id: string; name: string };
  settings: {
    schoolSections: Array<"NURSERY" | "PRIMARY" | "SECONDARY" | "COMBINED">;
    defaultStreamCodes: Array<"A" | "B" | "C" | "D">;
    brandingMode: "PLATFORM_DEFAULTS";
    reportFooterText: string;
    marksheetFooterText: string;
    logoUrl: string;
  };
  classesSeeded: number;
  streamsSeeded: number;
};

export type OwnerUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  school: { id: string; code: string; name: string };
};

export type OwnerReader = {
  id: string;
  schoolId?: string;
  school?: { id: string; code: string; name: string } | null;
  name: string;
  deviceKey: string;
  location: string | null;
  locationType: string | null;
  locationName: string | null;
  mode: string;
  attendanceMode: string | null;
  setupStatus?: string;
  studentScope: string | null;
  classId: string | null;
  streamId: string | null;
  status: string;
  provisioningStatus?: string;
  assignmentStatus?: string;
  isActive: boolean;
  firmwareVersion: string | null;
  lastHeartbeatAt?: string | null;
  lastIp: string | null;
  lastRssi: number | null;
  lastSeenAt: string | null;
  lastScanAt: string | null;
  lastScanStatus: string | null;
  lastScanMessage: string | null;
  queueDepth: number;
  onlineStatus: string;
  rawOnlineStatus?: string;
  uptimeMs?: number | null;
  freeHeap?: number | null;
  rebootReason?: string | null;
  otaStatus?: string | null;
  otaMessage?: string | null;
  heartbeatStale?: boolean;
  hasToken: boolean;
  tokenHashPrefix: string | null;
  activationExpiresAt?: string | null;
  activationUsedAt?: string | null;
  activationFailedAttempts?: number;
  activationLastError?: string | null;
  activationBoundHardwareId?: string | null;
  pendingSetup?: boolean;
};

export type OwnerReaderInventoryFilter = {
  search?: string;
  schoolId?: string;
  status?: "ALL" | "ONLINE" | "OFFLINE" | "DISABLED" | "PENDING_SETUP" | "ACTIVATION_EXPIRED" | "ACTIVATION_FAILED" | "ERRORS" | "OTA_PENDING";
  otaStatus?: "ALL" | "PENDING" | "FAILED" | "INSTALLED" | "NO_UPDATE";
  firmwareVersion?: string;
};

export type CreatePendingOwnerReaderInput = {
  schoolId: string;
  deviceName: string;
  location: string;
  readerType: "GATE" | "CLASSROOM";
};

export type OwnerReaderDiagnostics = {
  health: {
    status: string;
    heartbeatAgeMinutes: number | null;
    queueDepth: number;
    firmwareVersion: string | null;
    wifiRssi: number | null;
    freeHeap: number | null;
    uptimeMs: number | null;
    rebootReason: string | null;
    otaStatus: string | null;
  };
  recentScans: Array<{ id: string; action: string; correlationId: string | null; details: unknown; createdAt: string }>;
  recentErrors: Array<{ id: string; action: string; correlationId: string | null; details: unknown; createdAt: string }>;
  otaHistory: Array<{ id: string; action: string; correlationId: string | null; details: unknown; createdAt: string }>;
  heartbeats: Array<{ id: string; action: string; correlationId: string | null; details: unknown; createdAt: string }>;
};

export type OwnerReaderDetail = {
  reader: OwnerReader;
  diagnostics: OwnerReaderDiagnostics;
};

export type OwnerAuditLog = {
  id: string;
  action: string;
  correlationId: string | null;
  details: unknown;
  createdAt: string;
};

export type OwnerFeatureFlag = {
  feature: "REPORT_LAB" | "SMART_PAGES" | "ATTENDANCE" | "WALLET" | "GATE" | "NFC" | "OCR" | "AI";
  enabled: boolean;
};

export type OwnerSchoolConsole = {
  school: OwnerSchool & {
    studentCount: number;
    userCount: number;
    reportCount: number;
    importCount: number;
  };
  users: OwnerUser[];
  admins: OwnerUser[];
  readers: OwnerReader[];
  featureFlags: OwnerFeatureFlag[];
  auditLogs: OwnerAuditLog[];
  supportSessions: Array<{ id: string; mode: string; status: string; reason: string | null; expiresAt: string; endedAt: string | null; createdAt: string }>;
  sessions: { active: unknown[]; note: string };
  apiKeys: { readerTokens: Array<{ id: string; name: string; deviceKey: string; hasToken: boolean; tokenHashPrefix: string | null }>; webhookKeys: unknown[] };
  health: {
    studentCount: number;
    userCount: number;
    issuedReportCount: number;
    importCount: number;
    storageUsage: string | null;
    databaseSize: string | null;
    lastBackup: string | null;
    ocrUsage: number;
    gatewayStatus: string;
    smartPagesStatus: string;
  };
};

export async function fetchOwnerDashboard(): Promise<OwnerDashboardStats> {
  const res = await fetch(`${API_BASE}/api/owner/dashboard`, { headers: makeRequestHeaders() });
  if (!res.ok) throw new Error(await parseApiError(res, "Could not load owner dashboard"));
  return res.json();
}

export async function fetchOwnerSchools(): Promise<{ schools: OwnerSchool[] }> {
  const res = await fetch(`${API_BASE}/api/owner/schools`, { headers: makeRequestHeaders() });
  if (!res.ok) throw new Error(await parseApiError(res, "Could not load schools"));
  return res.json();
}

export async function fetchOwnerUsers(filters: { search?: string; schoolId?: string; isActive?: string } = {}): Promise<{ users: OwnerUser[] }> {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.schoolId) params.set("schoolId", filters.schoolId);
  if (filters.isActive !== undefined) params.set("isActive", filters.isActive);
  const res = await fetch(`${API_BASE}/api/owner/users?${params.toString()}`, { headers: makeRequestHeaders() });
  if (!res.ok) throw new Error(await parseApiError(res, "Could not load users"));
  return res.json();
}

export async function createOwnerUser(input: {
  schoolId: string;
  name: string;
  email: string;
  role: "ADMIN_OPERATOR";
  temporaryPassword: string;
}): Promise<{ user: OwnerUser; mustChangePassword: boolean }> {
  const res = await fetch(`${API_BASE}/api/owner/users`, {
    method: "POST",
    headers: makeRequestHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await parseApiError(res, "Could not create user"));
  return res.json();
}

export async function ownerResetPassword(userId: string, temporaryPassword: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/owner/users/${encodeURIComponent(userId)}/reset-password`, {
    method: "POST",
    headers: makeRequestHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ temporaryPassword }),
  });
  if (!res.ok) throw new Error(await parseApiError(res, "Could not reset password"));
}

export async function ownerResetPasswordAdvanced(userId: string, input: { temporaryPassword?: string; generateTemporaryPassword?: boolean; sendResetEmail?: boolean }): Promise<{ temporaryPassword?: string; resetEmailQueued: boolean }> {
  const res = await fetch(`${API_BASE}/api/owner/users/${encodeURIComponent(userId)}/reset-password`, {
    method: "POST",
    headers: makeRequestHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await parseApiError(res, "Could not reset password"));
  return res.json();
}

export async function ownerDisableUser(userId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/owner/users/${encodeURIComponent(userId)}/disable`, {
    method: "POST",
    headers: makeRequestHeaders(),
  });
  if (!res.ok) throw new Error(await parseApiError(res, "Could not disable user"));
}

export async function ownerEnableUser(userId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/owner/users/${encodeURIComponent(userId)}/enable`, {
    method: "POST",
    headers: makeRequestHeaders(),
  });
  if (!res.ok) throw new Error(await parseApiError(res, "Could not enable user"));
}

export async function ownerUnlockUser(userId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/owner/users/${encodeURIComponent(userId)}/unlock`, {
    method: "POST",
    headers: makeRequestHeaders(),
  });
  if (!res.ok) throw new Error(await parseApiError(res, "Could not unlock account"));
}

export async function ownerTerminateUserSessions(userId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/owner/users/${encodeURIComponent(userId)}/terminate-sessions`, {
    method: "POST",
    headers: makeRequestHeaders(),
  });
  if (!res.ok) throw new Error(await parseApiError(res, "Could not terminate sessions"));
}

export async function ownerResetMfa(userId: string): Promise<{ reset: boolean; message: string }> {
  const res = await fetch(`${API_BASE}/api/owner/users/${encodeURIComponent(userId)}/reset-mfa`, {
    method: "POST",
    headers: makeRequestHeaders(),
  });
  if (!res.ok) throw new Error(await parseApiError(res, "Could not reset MFA"));
  return res.json();
}

export async function createOwnerSchool(input: CreateOwnerSchoolInput): Promise<CreateOwnerSchoolResult> {
  const res = await fetch(`${API_BASE}/api/owner/schools`, {
    method: "POST",
    headers: makeRequestHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await parseApiError(res, "Could not create school"));
  return res.json();
}

export async function fetchOwnerSchoolById(schoolId: string): Promise<{ school: OwnerSchool }> {
  const res = await fetch(`${API_BASE}/api/owner/schools/${encodeURIComponent(schoolId)}`, {
    headers: makeRequestHeaders(),
  });
  if (!res.ok) throw new Error(await parseApiError(res, "Could not load school"));
  return res.json();
}

export async function patchOwnerSchool(
  schoolId: string,
  data: { name?: string; phone?: string | null; address?: string | null; isActive?: boolean },
): Promise<void> {
  const res = await fetch(`${API_BASE}/api/owner/schools/${encodeURIComponent(schoolId)}`, {
    method: "PATCH",
    headers: makeRequestHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await parseApiError(res, "Could not update school"));
}

export async function fetchOwnerSchoolConsole(schoolId: string): Promise<OwnerSchoolConsole> {
  const res = await fetch(`${API_BASE}/api/owner/schools/${encodeURIComponent(schoolId)}/console`, {
    headers: makeRequestHeaders(),
  });
  if (!res.ok) throw new Error(await parseApiError(res, "Could not load school console"));
  return res.json();
}

export async function updateOwnerSchoolDetails(schoolId: string, data: Partial<Pick<OwnerSchool, "name" | "phone" | "email" | "address" | "logoUrl" | "timezone" | "brandingMode">>): Promise<void> {
  const res = await fetch(`${API_BASE}/api/owner/schools/${encodeURIComponent(schoolId)}/details`, {
    method: "PATCH",
    headers: makeRequestHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await parseApiError(res, "Could not update school details"));
}

export async function updateOwnerSubscription(schoolId: string, input: { action: "EXTEND" | "CANCEL" | "PAUSE" | "CHANGE_PLAN"; planCode?: string; extendDays?: number; studentLimit?: number | null }): Promise<void> {
  const res = await fetch(`${API_BASE}/api/owner/schools/${encodeURIComponent(schoolId)}/subscription`, {
    method: "PATCH",
    headers: makeRequestHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await parseApiError(res, "Could not update subscription"));
}

export async function startOwnerSupportSession(schoolId: string, input: { mode: "READ_ONLY" | "WRITE"; reason: string; durationMinutes: number; writeConfirmed?: boolean }): Promise<{ supportSession: { id: string; banner: string; expiresAt: string; readOnly: boolean } }> {
  const res = await fetch(`${API_BASE}/api/owner/schools/${encodeURIComponent(schoolId)}/support-sessions`, {
    method: "POST",
    headers: makeRequestHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await parseApiError(res, "Could not start support session"));
  return res.json();
}

export async function updateOwnerFeatureFlags(schoolId: string, flags: OwnerFeatureFlag[]): Promise<void> {
  const res = await fetch(`${API_BASE}/api/owner/schools/${encodeURIComponent(schoolId)}/feature-flags`, {
    method: "PATCH",
    headers: makeRequestHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ flags }),
  });
  if (!res.ok) throw new Error(await parseApiError(res, "Could not update feature flags"));
}

export async function requestOwnerMaintenance(schoolId: string, action: "FORCE_SYNC" | "REBUILD_SEARCH" | "REPAIR_DOCUMENTS" | "REGENERATE_QR_CODES" | "RESEND_PENDING_EMAILS"): Promise<void> {
  const res = await fetch(`${API_BASE}/api/owner/schools/${encodeURIComponent(schoolId)}/maintenance`, {
    method: "POST",
    headers: makeRequestHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ action }),
  });
  if (!res.ok) throw new Error(await parseApiError(res, "Could not request maintenance"));
}

export async function requestOwnerReaderAction(schoolId: string, deviceId: string, action: "RESTART" | "SYNC" | "UPDATE_FIRMWARE" | "RE_REGISTER"): Promise<void> {
  if (action === "UPDATE_FIRMWARE") {
    const updateRes = await fetch(`${API_BASE}/api/readers/${encodeURIComponent(deviceId)}/commands/firmware-update`, {
      method: "POST",
      headers: makeRequestHeaders({ "Content-Type": "application/json" }),
    });
    if (!updateRes.ok) throw new Error(await parseApiError(updateRes, "Could not request firmware update"));
    return;
  }
  const res = await fetch(`${API_BASE}/api/owner/schools/${encodeURIComponent(schoolId)}/readers/${encodeURIComponent(deviceId)}/actions`, {
    method: "POST",
    headers: makeRequestHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ action }),
  });
  if (!res.ok) throw new Error(await parseApiError(res, "Could not request reader action"));
}

export async function createPendingOwnerReader(input: CreatePendingOwnerReaderInput): Promise<{ reader: OwnerReader; activationCode: string; activationExpiresAt: string }> {
  const res = await fetch(`${API_BASE}/api/owner/readers`, {
    method: "POST",
    headers: makeRequestHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await parseApiError(res, "Could not create pending reader"));
  return res.json();
}

export async function regenerateOwnerReaderActivation(readerId: string): Promise<{ reader: OwnerReader; activationCode: string; activationExpiresAt: string }> {
  const res = await fetch(`${API_BASE}/api/owner/readers/${encodeURIComponent(readerId)}/regenerate-activation`, {
    method: "POST",
    headers: makeRequestHeaders(),
  });
  if (!res.ok) throw new Error(await parseApiError(res, "Could not regenerate activation code"));
  return res.json();
}

export async function cancelOwnerReaderSetup(readerId: string): Promise<{ reader: OwnerReader }> {
  const res = await fetch(`${API_BASE}/api/owner/readers/${encodeURIComponent(readerId)}/cancel-setup`, {
    method: "POST",
    headers: makeRequestHeaders(),
  });
  if (!res.ok) throw new Error(await parseApiError(res, "Could not cancel pending reader setup"));
  return res.json();
}

export async function fetchOwnerReaders(filters: OwnerReaderInventoryFilter = {}): Promise<{ readers: OwnerReader[] }> {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.schoolId) params.set("schoolId", filters.schoolId);
  if (filters.status) params.set("status", filters.status);
  if (filters.otaStatus) params.set("otaStatus", filters.otaStatus);
  if (filters.firmwareVersion) params.set("firmwareVersion", filters.firmwareVersion);
  const query = params.toString();
  const res = await fetch(`${API_BASE}/api/owner/readers${query ? `?${query}` : ""}`, {
    headers: makeRequestHeaders(),
  });
  if (!res.ok) throw new Error(await parseApiError(res, "Could not load reader inventory"));
  return res.json();
}

export async function fetchOwnerReader(readerId: string): Promise<OwnerReaderDetail> {
  const res = await fetch(`${API_BASE}/api/owner/readers/${encodeURIComponent(readerId)}`, {
    headers: makeRequestHeaders(),
  });
  if (!res.ok) throw new Error(await parseApiError(res, "Could not load reader details"));
  return res.json();
}

export async function fetchOwnerSmartPagesPayments(status = "PENDING"): Promise<{ payments: SmartPagesPaymentRequest[] }> {
  const params = new URLSearchParams({ status });
  const res = await fetch(`${API_BASE}/api/owner/smart-pages/payments?${params.toString()}`, {
    headers: makeRequestHeaders(),
  });
  if (!res.ok) throw new Error(await parseApiError(res, "Could not load Smart Pages payments"));
  return res.json();
}

export async function fetchOwnerSmartPagesUsage(): Promise<{ ledger: Array<SmartPagesAdminLedgerRow & { schoolName?: string; schoolId: string }> }> {
  const res = await fetch(`${API_BASE}/api/owner/smart-pages/usage`, {
    headers: makeRequestHeaders(),
  });
  if (!res.ok) throw new Error(await parseApiError(res, "Could not load Smart Pages usage"));
  return res.json();
}

export async function confirmOwnerSmartPagesPayment(paymentId: string, notes?: string): Promise<SmartPagesPaymentRequest> {
  const res = await fetch(`${API_BASE}/api/owner/smart-pages/payments/${encodeURIComponent(paymentId)}/confirm`, {
    method: "POST",
    headers: makeRequestHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ notes }),
  });
  if (!res.ok) throw new Error(await parseApiError(res, "Could not confirm Smart Pages payment"));
  const data = await res.json() as { payment: SmartPagesPaymentRequest };
  return data.payment;
}

export async function rejectOwnerSmartPagesPayment(paymentId: string, notes?: string): Promise<SmartPagesPaymentRequest> {
  const res = await fetch(`${API_BASE}/api/owner/smart-pages/payments/${encodeURIComponent(paymentId)}/reject`, {
    method: "POST",
    headers: makeRequestHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ notes }),
  });
  if (!res.ok) throw new Error(await parseApiError(res, "Could not reject Smart Pages payment"));
  const data = await res.json() as { payment: SmartPagesPaymentRequest };
  return data.payment;
}

