import { getApiBaseUrl, makeRequestHeaders, parseApiError } from "../../../client/apiBase";
import type {
  InventoryItemsResponse,
  InventoryOverviewResponse,
  InventoryReconciliationResponse,
  InventoryReportingContextResponse,
} from "../shared/types";

const API_BASE = getApiBaseUrl();

async function parseJson<T>(response: Response, fallback: string): Promise<T> {
  if (!response.ok) {
    throw new Error(await parseApiError(response, fallback));
  }
  return response.json() as Promise<T>;
}

export async function fetchInventoryOverview(): Promise<InventoryOverviewResponse> {
  const response = await fetch(`${API_BASE}/api/inventory/overview`, {
    headers: makeRequestHeaders(),
  });
  return parseJson<InventoryOverviewResponse>(response, "Could not load inventory overview.");
}

export async function fetchInventoryItems(): Promise<InventoryItemsResponse> {
  const response = await fetch(`${API_BASE}/api/inventory/items`, {
    headers: makeRequestHeaders(),
  });
  return parseJson<InventoryItemsResponse>(response, "Could not load inventory items.");
}

export async function createInventoryItem(input: {
  name: string;
  category: string;
  unit: string;
  minimumStock: number;
}) {
  const response = await fetch(`${API_BASE}/api/inventory/items`, {
    method: "POST",
    headers: makeRequestHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(input),
  });
  return parseJson<{ item: { id: string } }>(response, "Could not create inventory item.");
}

export async function updateInventoryItem(input: {
  itemId: string;
  name: string;
  category: string;
  unit: string;
  minimumStock: number;
  active: boolean;
}) {
  const response = await fetch(`${API_BASE}/api/inventory/items/${input.itemId}`, {
    method: "PATCH",
    headers: makeRequestHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(input),
  });
  return parseJson<{ ok: true }>(response, "Could not update inventory item.");
}

export async function archiveInventoryItem(itemId: string) {
  const response = await fetch(`${API_BASE}/api/inventory/items/${itemId}/archive`, {
    method: "POST",
    headers: makeRequestHeaders({ "Content-Type": "application/json" }),
  });
  return parseJson<{ ok: true }>(response, "Could not archive inventory item.");
}

export async function recordInventoryMovement(
  kind: "receive" | "issue" | "adjust",
  input: {
    itemId: string;
    quantity: number;
    source: string;
    notes?: string;
    studentId?: string;
  },
) {
  const response = await fetch(`${API_BASE}/api/inventory/movements/${kind}`, {
    method: "POST",
    headers: makeRequestHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(input),
  });
  return parseJson<{ movement: { id: string } }>(response, "Could not record inventory movement.");
}

export async function fetchInventoryReportingContext(search = ""): Promise<InventoryReportingContextResponse> {
  const params = new URLSearchParams();
  if (search.trim()) params.set("search", search.trim());
  const suffix = params.toString() ? `?${params}` : "";
  const response = await fetch(`${API_BASE}/api/inventory/reporting/context${suffix}`, {
    headers: makeRequestHeaders(),
  });
  return parseJson<InventoryReportingContextResponse>(response, "Could not load reporting day data.");
}

export async function saveReportingRequirement(input: {
  itemId: string;
  classId?: string;
  termId?: string;
  requiredQuantity: number;
}) {
  const response = await fetch(`${API_BASE}/api/inventory/reporting/requirements`, {
    method: "POST",
    headers: makeRequestHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(input),
  });
  return parseJson<{ ok: true }>(response, "Could not save reporting requirement.");
}

export async function saveStudentReportingRecord(input: {
  studentId: string;
  termId?: string;
  items: Array<{ itemId: string; expectedQuantity: number; broughtQuantity: number }>;
}) {
  const response = await fetch(`${API_BASE}/api/inventory/reporting/records`, {
    method: "POST",
    headers: makeRequestHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(input),
  });
  return parseJson<{ record: { id: string } }>(response, "Could not save reporting-day registration.");
}

export async function fetchInventoryReconciliation(): Promise<InventoryReconciliationResponse> {
  const response = await fetch(`${API_BASE}/api/inventory/reconciliation`, {
    headers: makeRequestHeaders(),
  });
  return parseJson<InventoryReconciliationResponse>(response, "Could not load inventory reconciliation.");
}
