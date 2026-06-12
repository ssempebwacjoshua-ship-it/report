import type { SettingSection, SettingsResponse, SettingsSections } from "../shared/types/settings";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4300";

async function readSettingsError(response: Response, fallback: string): Promise<string> {
  try {
    const body = await response.json();
    if (typeof body?.error === "string") return body.error;
    if (Array.isArray(body?.issues) && body.issues.length) {
      return body.issues
        .map((issue: { path?: Array<string | number>; message?: string }) => {
          const path = issue.path?.join(".");
          return path ? `${path}: ${issue.message}` : issue.message;
        })
        .join("; ");
    }
  } catch {
    return fallback;
  }
  return fallback;
}

export async function fetchSettings(schoolCode = "SCU-PREVIEW"): Promise<SettingsResponse> {
  const response = await fetch(`${API_BASE}/api/settings?schoolCode=${encodeURIComponent(schoolCode)}`);
  if (!response.ok) throw new Error(await readSettingsError(response, "Could not load settings"));
  return response.json();
}

export async function patchSettingsSection<K extends SettingSection>(
  section: K,
  payload: SettingsSections[K],
  schoolCode = "SCU-PREVIEW",
): Promise<SettingsResponse> {
  const response = await fetch(`${API_BASE}/api/settings/${section}?schoolCode=${encodeURIComponent(schoolCode)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(await readSettingsError(response, "Could not save settings"));
  return response.json();
}
