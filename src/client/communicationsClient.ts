import { getApiBaseUrl, makeRequestHeaders, parseApiError } from "./apiBase";

const API_BASE = getApiBaseUrl();

export type CommunicationCampaign = {
  id: string;
  title: string;
  type: string;
  status: string;
  priority: string;
  contentVersion: number;
  createdAt: string;
  updatedAt: string;
  _count?: { recipients: number; deliveries: number };
  contents?: Array<{ subject: string | null; body: string; shortBody: string | null }>;
};

export async function fetchCommunicationCampaigns(): Promise<{ campaigns: CommunicationCampaign[]; summary: Array<{ status: string; _count: { status: number } }> }> {
  const res = await fetch(`${API_BASE}/api/communications/campaigns`, { headers: makeRequestHeaders() });
  if (!res.ok) throw new Error(await parseApiError(res, "Could not load communication campaigns"));
  return res.json();
}

export async function createCommunicationCampaign(body: {
  type: string;
  title: string;
  subject?: string;
  body: string;
  shortBody?: string;
}): Promise<{ campaign: CommunicationCampaign }> {
  const res = await fetch(`${API_BASE}/api/communications/campaigns`, {
    method: "POST",
    headers: makeRequestHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await parseApiError(res, "Could not create communication campaign"));
  return res.json();
}
