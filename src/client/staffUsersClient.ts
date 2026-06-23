import { getApiBaseUrl, makeSchoolRequestHeaders, parseApiError } from "./apiBase";

const API_BASE = getApiBaseUrl();

export type StaffUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
};

export type StaffUserRole = "ADMIN_OPERATOR" | "GATE_SECURITY" | "SECURITY" | "CANTEEN" | "CASHIER";

export const STAFF_ROLE_LABELS: Record<StaffUserRole, string> = {
  ADMIN_OPERATOR: "Admin Operator",
  GATE_SECURITY: "Gatekeeper",
  SECURITY: "Security",
  CANTEEN: "Canteen Cashier",
  CASHIER: "Cashier",
};

export async function fetchStaffUsers() {
  const res = await fetch(`${API_BASE}/api/staff-users`, { headers: makeSchoolRequestHeaders() });
  if (!res.ok) throw new Error(await parseApiError(res, "Could not load staff users"));
  return res.json() as Promise<{ users: StaffUser[] }>;
}

export async function createStaffUser(input: { name: string; email: string; phone?: string; role: StaffUserRole; temporaryPassword: string }) {
  const res = await fetch(`${API_BASE}/api/staff-users`, {
    method: "POST",
    headers: makeSchoolRequestHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await parseApiError(res, "Could not create staff user"));
  return res.json() as Promise<{ user: StaffUser }>;
}

export async function changeStaffRole(userId: string, input: { role: StaffUserRole; reason: string }) {
  const res = await fetch(`${API_BASE}/api/staff-users/${encodeURIComponent(userId)}/role`, {
    method: "PATCH",
    headers: makeSchoolRequestHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await parseApiError(res, "Could not change role"));
  return res.json() as Promise<{ user: StaffUser; requiresRelogin: boolean }>;
}

export async function setStaffStatus(userId: string, input: { isActive: boolean; reason: string }) {
  const res = await fetch(`${API_BASE}/api/staff-users/${encodeURIComponent(userId)}/status`, {
    method: "PATCH",
    headers: makeSchoolRequestHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await parseApiError(res, "Could not update user status"));
  return res.json() as Promise<{ user: StaffUser }>;
}

export async function resetStaffPassword(userId: string, input: { temporaryPassword: string; reason: string }) {
  const res = await fetch(`${API_BASE}/api/staff-users/${encodeURIComponent(userId)}/reset-password`, {
    method: "POST",
    headers: makeSchoolRequestHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await parseApiError(res, "Could not reset password"));
  return res.json() as Promise<{ user: StaffUser }>;
}
