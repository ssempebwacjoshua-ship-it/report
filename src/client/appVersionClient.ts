import { getApiBaseUrl } from "./apiBase";

const API_BASE = getApiBaseUrl();
const APP_BASENAME = import.meta.env.BASE_URL.replace(/\/$/, "");

export type AppVersionResponse = {
  version: string;
  buildTime: string | null;
};

async function fetchVersionFrom(url: string) {
  const response = await fetch(url, {
    headers: {
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
    },
    cache: "no-store",
  });
  const contentType = response.headers.get("content-type") ?? "";
  if (!response.ok || !contentType.includes("application/json")) {
    throw new Error("Could not check app version.");
  }
  return response.json() as Promise<AppVersionResponse>;
}

export async function fetchAppVersion() {
  try {
    return await fetchVersionFrom(`${API_BASE}/api/app-version`);
  } catch (error) {
    if (!APP_BASENAME) throw error;
    return fetchVersionFrom(`${APP_BASENAME}/api/app-version`);
  }
}
