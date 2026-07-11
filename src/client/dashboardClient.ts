import type { DashboardAttendanceSummary, DashboardStats } from "../shared/types/dashboard";
import { getApiBaseUrl, makeRequestHeaders, parseApiError } from "./apiBase";

const API_BASE = getApiBaseUrl();

export async function fetchDashboardStats(signal?: AbortSignal): Promise<DashboardStats> {
  const response = await fetch(`${API_BASE}/api/dashboard/stats`, {
    headers: makeRequestHeaders(),
    signal,
  });
  if (!response.ok) throw new Error(await parseApiError(response, "Could not load dashboard stats"));
  return response.json() as Promise<DashboardStats>;
}

export async function fetchDashboardAttendanceSummary(
  signal?: AbortSignal,
): Promise<DashboardAttendanceSummary> {
  const response = await fetch(`${API_BASE}/api/dashboard/attendance-summary`, {
    headers: makeRequestHeaders(),
    signal,
  });
  if (!response.ok) {
    throw new Error(await parseApiError(response, "Could not load attendance summary"));
  }
  return response.json() as Promise<DashboardAttendanceSummary>;
}
