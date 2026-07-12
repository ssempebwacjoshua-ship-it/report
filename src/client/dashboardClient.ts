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

export async function streamDashboardAttendanceSummary(input: {
  signal: AbortSignal;
  onSummary: (summary: DashboardAttendanceSummary) => void;
  onError?: (error: Error) => void;
}): Promise<void> {
  const response = await fetch(`${API_BASE}/api/dashboard/attendance-stream`, {
    headers: makeRequestHeaders({ Accept: "text/event-stream" }),
    signal: input.signal,
  });
  if (!response.ok) {
    throw new Error(await parseApiError(response, "Could not open attendance stream"));
  }
  if (!response.body) {
    throw new Error("Attendance stream is unavailable.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const flushEvent = (chunk: string) => {
    const lines = chunk.split("\n");
    let eventName = "message";
    const dataLines: string[] = [];
    for (const line of lines) {
      if (line.startsWith("event:")) eventName = line.slice(6).trim();
      if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
    }
    if (eventName !== "attendance-summary" || dataLines.length === 0) return;
    input.onSummary(JSON.parse(dataLines.join("\n")) as DashboardAttendanceSummary);
  };

  try {
    while (!input.signal.aborted) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let boundary = buffer.indexOf("\n\n");
      while (boundary >= 0) {
        const rawEvent = buffer.slice(0, boundary).trim();
        buffer = buffer.slice(boundary + 2);
        if (rawEvent && !rawEvent.startsWith(":")) {
          flushEvent(rawEvent);
        }
        boundary = buffer.indexOf("\n\n");
      }
    }
  } catch (error) {
    if (!input.signal.aborted && input.onError) {
      input.onError(error instanceof Error ? error : new Error("Attendance stream disconnected"));
    }
  } finally {
    reader.releaseLock();
  }
}
