import type { DashboardStats } from "../shared/types/dashboard";
import { getApiBaseUrl } from "./apiBase";

const API_BASE = getApiBaseUrl();

export async function fetchDashboardStats(schoolCode = "SCU-PREVIEW"): Promise<DashboardStats> {
  const response = await fetch(
    `${API_BASE}/api/dashboard/stats?schoolCode=${encodeURIComponent(schoolCode)}`,
  );
  if (!response.ok) throw new Error("Could not load dashboard stats");
  return response.json() as Promise<DashboardStats>;
}
