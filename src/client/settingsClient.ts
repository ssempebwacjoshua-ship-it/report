import type { SettingSection, SettingsResponse, SettingsSections } from "../shared/types/settings";
import { getApiBaseUrl } from "./apiBase";
const API_BASE = getApiBaseUrl();

export type SettingsFieldErrors = Record<string, string[]>;

export class SettingsClientError extends Error {
  status: number;

  fieldErrors: SettingsFieldErrors | null;

  constructor(message: string, status: number, fieldErrors: SettingsFieldErrors | null = null) {
    super(message);
    this.name = "SettingsClientError";
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

async function readSettingsError(response: Response, fallback: string): Promise<SettingsClientError> {
  try {
    const body = await response.json();
    const fieldErrors: SettingsFieldErrors | null =
      body?.fieldErrors && typeof body.fieldErrors === "object" ? body.fieldErrors : null;

    if (typeof body?.message === "string") {
      return new SettingsClientError(body.message, response.status, fieldErrors);
    }

    if (typeof body?.error === "string") {
      return new SettingsClientError(body.error, response.status, fieldErrors);
    }

    if (Array.isArray(body?.issues) && body.issues.length) {
      const message = body.issues
        .map((issue: { path?: Array<string | number>; message?: string }) => {
          const path = issue.path?.join(".");
          return path ? `${path}: ${issue.message}` : issue.message;
        })
        .join("; ");
      return new SettingsClientError(message || fallback, response.status, fieldErrors);
    }
  } catch {
    return new SettingsClientError(fallback, response.status);
  }
  return new SettingsClientError(fallback, response.status);
}

export async function fetchSettings(schoolCode = "SCU-PREVIEW"): Promise<SettingsResponse> {
  const response = await fetch(`${API_BASE}/api/settings?schoolCode=${encodeURIComponent(schoolCode)}`);
  if (!response.ok) throw await readSettingsError(response, "Could not load settings");
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
  if (!response.ok) throw await readSettingsError(response, "Could not save settings");
  const result = await response.json();
  window.dispatchEvent(new Event("settings-updated"));
  return result;
}
