import type { SubscriptionResponse } from "../shared/types/subscription";
import { getApiBaseUrl, makeRequestHeaders, parseApiError } from "./apiBase";

const API_BASE = getApiBaseUrl();

export async function fetchSubscription(): Promise<SubscriptionResponse> {
  const response = await fetch(`${API_BASE}/api/subscription`, {
    headers: makeRequestHeaders(),
  });
  if (!response.ok) throw new Error(await parseApiError(response, "Could not load subscription"));
  return response.json();
}

