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

export type OfflineDeviceStatus = {
  id: string;
  name: string;
  deviceKey: string;
  location: string | null;
  mode: string;
  status: string;
  isActive: boolean;
  lastSeenAt: string | null;
  lastIp?: string | null;
  lastRssi?: number | null;
  firmwareVersion?: string | null;
  queueDepth?: number | null;
  onlineStatus?: string | null;
  lastScanAt?: string | null;
  lastScanStatus?: string | null;
  lastScanMessage?: string | null;
};

export type OfflineSyncStatus = {
  batches: unknown[];
  devices: OfflineDeviceStatus[];
};

export async function fetchOfflineBootstrap(modules?: string[], deviceId?: string, mode?: "GATE" | "CANTEEN" | "ATTENDANCE"): Promise<OfflineBootstrapSnapshot> {
  const params = new URLSearchParams();
  if (modules?.length) params.set("modules", modules.join(","));
  if (deviceId) params.set("deviceId", deviceId);
  if (mode) params.set("mode", mode);
  return api<OfflineBootstrapSnapshot>(`/api/nfc/offline/bootstrap?${params.toString()}`);
}

export async function fetchOfflineSyncStatus(): Promise<OfflineSyncStatus> {
  return api<OfflineSyncStatus>("/api/nfc/offline/sync-status");
}
