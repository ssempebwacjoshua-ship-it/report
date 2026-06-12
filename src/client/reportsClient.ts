import type { ReportContext, ReportFilters, ReportsResponse } from "../shared/types/reports";
import { getApiBaseUrl } from "./apiBase";
const API_BASE = getApiBaseUrl();

export async function fetchReportContext(schoolCode = "SCU-PREVIEW"): Promise<ReportContext> {
  const response = await fetch(`${API_BASE}/api/context?schoolCode=${encodeURIComponent(schoolCode)}`);
  if (!response.ok) throw new Error("Could not load report context");
  return response.json();
}

export async function fetchReports(filters: ReportFilters): Promise<ReportsResponse> {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, String(value));
  });
  const response = await fetch(`${API_BASE}/api/reports?${params.toString()}`);
  if (!response.ok) throw new Error("Could not load reports");
  return response.json();
}
