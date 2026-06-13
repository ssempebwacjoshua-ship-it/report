import { getApiBaseUrl } from "./apiBase";

const API_BASE = getApiBaseUrl();

async function readOcrError(response: Response, fallback: string): Promise<string> {
  try {
    const body = await response.json();
    if (typeof body?.error === "string") return body.error;
    if (typeof body?.message === "string") return body.message;
  } catch {
    return fallback;
  }
  return fallback;
}

export async function readAzureOcr(url: string, token?: string | null): Promise<{ provider: string; text: string; lines: string[] }> {
  const response = await fetch(`${API_BASE}/internal/ocr/read`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ url }),
  });
  if (!response.ok) throw new Error(await readOcrError(response, "Could not extract text"));
  return response.json();
}
