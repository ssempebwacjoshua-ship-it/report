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
  address: string | null;
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
  sections: Array<"NURSERY" | "PRIMARY" | "SECONDARY">;
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
  classesSeeded: number;
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

