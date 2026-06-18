import type { ReportContext, ReportFilters, ReportsResponse } from "../shared/types/reports";
import { getApiBaseUrl, makeRequestHeaders, parseApiError } from "./apiBase";

const API_BASE = getApiBaseUrl();

export async function fetchReportContext(): Promise<ReportContext> {
  const response = await fetch(`${API_BASE}/api/context`, {
    headers: makeRequestHeaders(),
  });
  if (!response.ok) throw new Error(await parseApiError(response, "Could not load report context"));
  return response.json();
}

export async function fetchReports(filters: ReportFilters): Promise<ReportsResponse> {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value && key !== "schoolCode") params.set(key, String(value));
  });
  const response = await fetch(`${API_BASE}/api/reports?${params.toString()}`, {
    headers: makeRequestHeaders(),
  });
  if (!response.ok) throw new Error(await parseApiError(response, "Could not load reports"));
  return response.json();
}

