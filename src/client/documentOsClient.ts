import { getApiBaseUrl, makeRequestHeaders, parseApiError } from "./apiBase";

const API_BASE = getApiBaseUrl();

async function json<T>(response: Response, fallback: string): Promise<T> {
  if (!response.ok) throw new Error(await parseApiError(response, fallback));
  return response.json() as Promise<T>;
}

export interface CreatorPreference {
  id: string;
  key: string;
  value: unknown;
  updatedAt: string;
}

export interface AutomationWorkflow {
  id: string;
  name: string;
  trigger: string;
  actions: Array<{ type: string; config?: Record<string, unknown> }>;
  isActive: boolean;
  enabled?: boolean;
  lastRunAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SearchResult {
  id: string;
  entityType: string;
  entityId: string;
  title: string | null;
  snippet: string;
  metadata?: Record<string, unknown>;
  score: number;
  updatedAt: string;
}

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  readAt: string | null;
  createdAt: string;
}

export interface AnalyticsSummary {
  totals: { documents: number; publishedDocuments?: number; views: number; downloads: number; shares: number };
  mostViewed: Array<{ documentId: string; title: string; views: number; downloads: number; shares: number; versionCount: number; updatedAt: string }>;
  mostDownloaded: Array<{ documentId: string; title: string; views: number; downloads: number; shares: number; versionCount: number; updatedAt: string }>;
  mostActiveCollections?: Array<{ collectionId: string; name: string; recordCount: number; bulkJobCount: number; activityScore: number; updatedAt: string }>;
}

export async function listPreferences(): Promise<CreatorPreference[]> {
  const res = await fetch(`${API_BASE}/api/document-os/preferences`, { headers: makeRequestHeaders() });
  const data = await json<{ preferences: CreatorPreference[] }>(res, "Could not load preferences");
  return data.preferences;
}

export async function savePreference(key: string, value: unknown): Promise<CreatorPreference> {
  const res = await fetch(`${API_BASE}/api/document-os/preferences`, {
    method: "PUT",
    headers: makeRequestHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ key, value }),
  });
  const data = await json<{ preference: CreatorPreference }>(res, "Could not save preference");
  return data.preference;
}

export async function listWorkflows(): Promise<AutomationWorkflow[]> {
  const res = await fetch(`${API_BASE}/api/document-os/workflows`, { headers: makeRequestHeaders() });
  const data = await json<{ workflows: AutomationWorkflow[] }>(res, "Could not load workflows");
  return data.workflows;
}

export async function createWorkflow(input: { name: string; trigger: string; actions: Array<{ type: string; config?: Record<string, unknown> }>; isActive?: boolean }): Promise<AutomationWorkflow> {
  const res = await fetch(`${API_BASE}/api/document-os/workflows`, {
    method: "POST",
    headers: makeRequestHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(input),
  });
  const data = await json<{ workflow: AutomationWorkflow }>(res, "Could not create workflow");
  return data.workflow;
}

export async function searchDocumentOs(query: string): Promise<SearchResult[]> {
  const url = new URL(`${API_BASE}/api/document-os/search`);
  url.searchParams.set("q", query);
  const res = await fetch(url.toString(), { headers: makeRequestHeaders() });
  const data = await json<{ results: SearchResult[] }>(res, "Search failed");
  return data.results;
}

export async function reindexDocumentOs(): Promise<number> {
  const res = await fetch(`${API_BASE}/api/document-os/search/reindex`, { method: "POST", headers: makeRequestHeaders() });
  const data = await json<{ count: number }>(res, "Could not rebuild search index");
  return data.count;
}

export async function listNotifications(includeRead = false): Promise<NotificationItem[]> {
  const url = new URL(`${API_BASE}/api/document-os/notifications`);
  if (includeRead) url.searchParams.set("includeRead", "true");
  const res = await fetch(url.toString(), { headers: makeRequestHeaders() });
  const data = await json<{ notifications: NotificationItem[] }>(res, "Could not load notifications");
  return data.notifications;
}

export async function markNotificationRead(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/document-os/notifications/${encodeURIComponent(id)}/read`, {
    method: "PATCH",
    headers: makeRequestHeaders(),
  });
  await json(res, "Could not update notification");
}

export async function getAnalytics(): Promise<AnalyticsSummary> {
  const res = await fetch(`${API_BASE}/api/document-os/analytics`, { headers: makeRequestHeaders() });
  const data = await json<{ analytics: AnalyticsSummary }>(res, "Could not load analytics");
  return data.analytics;
}

export async function runAgent(input: { domain?: string; instruction: string; documentId?: string }) {
  const res = await fetch(`${API_BASE}/api/document-os/agent`, {
    method: "POST",
    headers: makeRequestHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(input),
  });
  const data = await json<{ result: { agentId: string; agentLabel: string; response: string; suggestedActions: string[] } }>(res, "Agent failed");
  return data.result;
}

export async function suggestWorkflow(context: unknown) {
  const res = await fetch(`${API_BASE}/api/document-os/workflows/suggest`, {
    method: "POST",
    headers: makeRequestHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(context),
  });
  const data = await json<{ suggestion: { name: string; trigger: string; actions: Array<{ type: string; config?: Record<string, unknown> }>; rationale: string } }>(res, "Could not suggest workflow");
  return data.suggestion;
}
