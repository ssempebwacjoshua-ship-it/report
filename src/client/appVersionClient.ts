import { getApiBaseUrl } from "./apiBase";

const API_BASE = getApiBaseUrl();

export type AppVersionResponse = {
  version: string;
  buildTime: string | null;
};

export async function fetchAppVersion() {
  const response = await fetch(`${API_BASE}/api/app-version`, {
    headers: {
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
    },
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Could not check app version.");
  return response.json() as Promise<AppVersionResponse>;
}
