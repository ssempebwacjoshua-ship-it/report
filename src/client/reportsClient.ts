import type { ReportContext, ReportFilters, ReportsResponse } from "../shared/types/reports";
import { authHeaders, getApiBaseUrl, handleSessionExpiry } from "./apiBase";
const API_BASE = getApiBaseUrl();

function checkUnauthorized(response: Response): void {
  if (response.status === 401) {
    handleSessionExpiry();
    throw new Error("Session expired. Please log in again.");
  }
}

export async function fetchReportContext(): Promise<ReportContext> {
  const response = await fetch(`${API_BASE}/api/context`, {
    headers: authHeaders(),
  });
  checkUnauthorized(response);
  if (!response.ok) throw new Error("Could not load report context");
  return response.json();
}

export async function fetchReports(filters: ReportFilters): Promise<ReportsResponse> {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value && key !== "schoolCode") params.set(key, String(value));
  });
  const response = await fetch(`${API_BASE}/api/reports?${params.toString()}`, {
    headers: authHeaders(),
  });
  checkUnauthorized(response);
  if (!response.ok) throw new Error("Could not load reports");
  return response.json();
}
