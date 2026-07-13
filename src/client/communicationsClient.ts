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

export type AudienceDefinition = {
  classId?: string;
  streamId?: string;
  studentIds?: string[];
  mode?: "GENERAL" | "PER_STUDENT";
};

export type CommunicationPreview = {
  total: number;
  ready: number;
  blocked: number;
  recipients: Array<{
    displayName: string;
    studentName: string;
    admissionNumber: string;
    phoneMasked: string;
    status: string;
    blockedReasonCode: string | null;
  }>;
};

export async function previewCommunicationRecipients(campaignId: string, audience: AudienceDefinition): Promise<{ preview: CommunicationPreview }> {
  const res = await fetch(`${API_BASE}/api/communications/campaigns/${campaignId}/preview`, {
    method: "POST",
    headers: makeRequestHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(audience),
  });
  if (!res.ok) throw new Error(await parseApiError(res, "Could not preview recipients"));
  return res.json();
}

export async function sendCommunication(campaignId: string, body: {
  channel: "WHATSAPP" | "SMS";
  confirm: boolean;
  audience?: AudienceDefinition;
}): Promise<{ ok: true; result: { submitted: number; failed: number; skippedDuplicate: number } }> {
  const res = await fetch(`${API_BASE}/api/communications/campaigns/${campaignId}/send`, {
    method: "POST",
    headers: makeRequestHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await parseApiError(res, `${body.channel === "WHATSAPP" ? "WhatsApp" : "SMS"} is not configured yet. Contact platform owner.`));
  return res.json();
}

export async function fetchCommunicationStatus(campaignId: string): Promise<{
  campaign: { id: string; title: string; status: string };
  deliveries: Array<{ status: string; _count: { status: number } }>;
}> {
  const res = await fetch(`${API_BASE}/api/communications/campaigns/${campaignId}/status`, { headers: makeRequestHeaders() });
  if (!res.ok) throw new Error(await parseApiError(res, "Could not load communication status"));
  return res.json();
}
