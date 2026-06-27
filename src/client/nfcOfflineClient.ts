import { getApiBaseUrl } from "./apiBase";
import type { OfflineBootstrapSnapshot } from "../offline/offlineTypes";

const API = getApiBaseUrl();

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem("sc_auth_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...authHeaders(), ...(init?.headers ?? {}) },
  });
  const body = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  return body;
}

export async function fetchOfflineBootstrap(modules?: string[], deviceId?: string, mode?: "GATE" | "CANTEEN" | "ATTENDANCE"): Promise<OfflineBootstrapSnapshot> {
  const params = new URLSearchParams();
  if (modules?.length) params.set("modules", modules.join(","));
  if (deviceId) params.set("deviceId", deviceId);
  if (mode) params.set("mode", mode);
  return api<OfflineBootstrapSnapshot>(`/internal/kiosk/offline-snapshot?${params.toString()}`);
}

export async function fetchOfflineSyncStatus(): Promise<{ batches: unknown[]; devices: unknown[] }> {
  return api<{ batches: unknown[]; devices: unknown[] }>("/api/nfc/offline/sync-status");
}
