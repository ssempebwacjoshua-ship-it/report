import type { DashboardStats } from "../shared/types/dashboard";
import { getApiBaseUrl, makeRequestHeaders, parseApiError } from "./apiBase";

const API_BASE = getApiBaseUrl();

export async function fetchDashboardStats(): Promise<DashboardStats> {
  const response = await fetch(`${API_BASE}/api/dashboard/stats`, {
    headers: makeRequestHeaders(),
  });
  if (!response.ok) throw new Error(await parseApiError(response, "Could not load dashboard stats"));
  return response.json() as Promise<DashboardStats>;
}

