import type { SettingSection, SettingsResponse, SettingsSections } from "../shared/types/settings";
import { getApiBaseUrl, makeRequestHeaders, parseApiError } from "./apiBase";

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
  // Extract field errors from a clone before parseApiError consumes the body
  let fieldErrors: SettingsFieldErrors | null = null;
  try {
    const bodyText = await response.clone().text();
    if (bodyText) {
      const body = JSON.parse(bodyText) as Record<string, unknown>;
      if (body?.fieldErrors && typeof body.fieldErrors === "object") {
        fieldErrors = body.fieldErrors as SettingsFieldErrors;
      }
    }
  } catch {
    // ignore — field errors not available
  }
  const message = await parseApiError(response, fallback);
  return new SettingsClientError(message, response.status, fieldErrors);
}

export async function fetchSettings(): Promise<SettingsResponse> {
  const response = await fetch(`${API_BASE}/api/settings`, {
    headers: makeRequestHeaders(),
  });
  if (!response.ok) throw await readSettingsError(response, "Could not load settings");
  return response.json();
}

export async function patchSettingsSection<K extends SettingSection>(
  section: K,
  payload: SettingsSections[K],
): Promise<SettingsResponse> {
  const response = await fetch(`${API_BASE}/api/settings/${section}`, {
    method: "PATCH",
    headers: makeRequestHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw await readSettingsError(response, "Could not save settings");
  const result = await response.json();
  window.dispatchEvent(new Event("settings-updated"));
  return result;
}
