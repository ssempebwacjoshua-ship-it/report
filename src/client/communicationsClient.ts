import { getApiBaseUrl, makeRequestHeaders, parseApiError } from "./apiBase";
import type { AudienceDefinition, AudienceResolution, CommunicationSubmissionValidation } from "../shared/communications";

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
  audience?: AudienceDefinition;
}): Promise<{ campaign: CommunicationCampaign }> {
  const res = await fetch(`${API_BASE}/api/communications/campaigns`, {
    method: "POST",
    headers: makeRequestHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await parseApiError(res, "Could not create communication campaign"));
  return res.json();
}

export async function previewCommunicationRecipients(campaignId: string, audience: AudienceDefinition): Promise<{ preview: AudienceResolution }> {
  const res = await fetch(`${API_BASE}/api/communications/campaigns/${campaignId}/preview`, {
    method: "POST",
    headers: makeRequestHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(audience),
  });
  if (!res.ok) throw new Error(await parseApiError(res, "Could not preview recipients"));
  return res.json();
}

export async function approveCommunicationCampaign(campaignId: string): Promise<{ ok: true }> {
  const res = await fetch(`${API_BASE}/api/communications/campaigns/${campaignId}/approve`, {
    method: "POST",
    headers: makeRequestHeaders(),
  });
  if (!res.ok) throw new Error(await parseApiError(res, "Could not approve communication campaign"));
  return res.json();
}

export async function requestCommunicationCampaignApproval(campaignId: string): Promise<{
  ok: true;
  campaign: CommunicationCampaign;
  validation: CommunicationSubmissionValidation;
  duplicate: boolean;
}> {
  const res = await fetch(`${API_BASE}/api/communications/campaigns/${campaignId}/request-approval`, {
    method: "POST",
    headers: makeRequestHeaders(),
  });
  if (!res.ok) throw new Error(await parseApiError(res, "Could not submit communication campaign for approval"));
  return res.json();
}

export async function sendCommunication(campaignId: string, body: {
  channel: "WHATSAPP" | "SMS";
  confirm: boolean;
  audience?: AudienceDefinition;
}): Promise<{ ok: true; result: { submitted: number; failed: number; skippedDuplicate: number; dryRun?: boolean } }> {
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
