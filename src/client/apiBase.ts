const LOCAL_API_BASE = "http://localhost:4300";

function validateApiBase(url: string) {
  if (!/^https?:\/\//i.test(url)) {
    if (url.startsWith("postgresql://")) {
      throw new Error("VITE_API_BASE_URL must be the backend API URL, not DATABASE_URL.");
    }
    throw new Error("Invalid VITE_API_BASE_URL: must be absolute HTTPS URL");
  }
  return url.replace(/\/+$/, "");
}

export function getApiBaseUrl() {
  const configured = import.meta.env.VITE_API_BASE_URL?.trim();
  if (configured) return validateApiBase(configured);
  if (import.meta.env.DEV) return LOCAL_API_BASE;
  throw new Error("VITE_API_BASE_URL is required in production.");
}

export const TOKEN_KEY = "sc_auth_token";
export const CREATOR_TOKEN_KEY = "sp_creator_token";

export function authHeaders(): HeadersInit {
  const token = localStorage.getItem(TOKEN_KEY) ?? localStorage.getItem(CREATOR_TOKEN_KEY);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// Returns auth + request-id headers for every outbound API call.
// Pass extra to add Content-Type or other per-request headers.
// Falls back to sp_creator_token so lawyer (external) creators can authenticate.
export function makeRequestHeaders(extra?: Record<string, string>): Record<string, string> {
  const token = localStorage.getItem(TOKEN_KEY) ?? localStorage.getItem(CREATOR_TOKEN_KEY);
  return {
    "x-request-id": crypto.randomUUID(),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

export function handleSessionExpiry(): void {
  localStorage.removeItem(TOKEN_KEY);
  window.location.href = "/login?reason=session_expired";
}

// Parse an API error response into a human-readable string.
// - Never returns "true" (ignores boolean error fields).
// - Prefers body.message, then string body.error, then body.issues.
// - Appends (ref: <requestId>) when the server echoes one back.
// - Handles 401 (session expiry), 403 (access denied), 500+ (server error).
export async function parseApiError(response: Response, fallback: string): Promise<string> {
  if (response.status === 401) {
    handleSessionExpiry();
    return "Session expired. Please log in again.";
  }
  if (response.status === 403) {
    return "You do not have access to this resource.";
  }

  let body: Record<string, unknown> = {};
  try {
    const text = await response.text();
    if (text) body = JSON.parse(text) as Record<string, unknown>;
  } catch {
    // body stays empty ? use fallback below
  }

  const requestId = typeof body.requestId === "string" ? body.requestId : null;
  const suffix = requestId ? ` (ref: ${requestId})` : "";

  if (response.status >= 500) {
    const msg = typeof body.message === "string" && body.message ? body.message : null;
    return (msg ?? "A server error occurred. Please try again or contact support.") + suffix;
  }

  if (typeof body.message === "string" && body.message) return body.message + suffix;
  if (typeof body.error === "string" && body.error) return body.error + suffix;
  if (Array.isArray(body.issues) && (body.issues as unknown[]).length > 0) {
    const msg = (body.issues as Array<{ message?: string }>)
      .map((i) => i.message)
      .filter(Boolean)
      .join("; ");
    if (msg) return msg + suffix;
  }

  return fallback + suffix;
}

