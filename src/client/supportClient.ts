import { getApiBaseUrl, makeRequestHeaders, parseApiError } from "./apiBase";

const API_BASE = getApiBaseUrl();

export type SupportRequestInput = {
  message: string;
  contact?: string;
  pageUrl: string;
};

export async function postSupportTelegram(input: SupportRequestInput): Promise<void> {
  const response = await fetch(`${API_BASE}/api/support/telegram`, {
    method: "POST",
    headers: makeRequestHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response, "Could not send your support request"));
  }
}
