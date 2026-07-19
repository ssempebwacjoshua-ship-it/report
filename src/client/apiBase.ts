const LOCAL_API_BASE = "http://localhost:4300";
const DEFAULT_PRODUCTION_API_BASE = "https://report-production-b00d.up.railway.app";
const APP_BASENAME = import.meta.env.BASE_URL.replace(/\/$/, "") || "";
const APP_BASE_PATH = APP_BASENAME || "/";
const BUILD_VERSION = typeof __APP_BUILD_VERSION__ === "string" ? __APP_BUILD_VERSION__ : "development";
const BUILD_TIME = typeof __APP_BUILD_TIME__ === "string" ? __APP_BUILD_TIME__ : null;

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
  if (import.meta.env.DEV && process.env.NODE_ENV !== "production") return LOCAL_API_BASE;
  return DEFAULT_PRODUCTION_API_BASE;
}

export function getAppBasePath() {
  return APP_BASE_PATH;
}

export function getAppBuildVersion() {
  return BUILD_VERSION;
}

export function getAppBuildTime() {
  return BUILD_TIME;
}

export function getApiTargetHost() {
  return new URL(getApiBaseUrl()).host;
}

export function describeBackendConnectionError() {
  return `Unable to connect to the Report Lab backend at ${getApiTargetHost()}.`;
}

export const TOKEN_KEY = "sc_auth_token";
export const CREATOR_TOKEN_KEY = "sp_creator_token";

export function authHeaders(): HeadersInit {
  const token = localStorage.getItem(TOKEN_KEY) ?? localStorage.getItem(CREATOR_TOKEN_KEY);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function makeRequestHeaders(extra?: Record<string, string>): Record<string, string> {
  const token = localStorage.getItem(TOKEN_KEY) ?? localStorage.getItem(CREATOR_TOKEN_KEY);
  return {
    "x-request-id": crypto.randomUUID(),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

export function makeSchoolRequestHeaders(extra?: Record<string, string>): Record<string, string> {
  const token = localStorage.getItem(TOKEN_KEY);
  return {
    "x-request-id": crypto.randomUUID(),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

export function makeCreatorRequestHeaders(extra?: Record<string, string>): Record<string, string> {
  const token = localStorage.getItem(CREATOR_TOKEN_KEY);
  return {
    "x-request-id": crypto.randomUUID(),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

export function handleSessionExpiry(): void {
  localStorage.removeItem(TOKEN_KEY);
  window.location.href = `${APP_BASENAME}/login?reason=session_expired`;
}

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
    // body stays empty; fall back below
  }

  const requestId = typeof body.requestId === "string" ? body.requestId : null;
  const suffix = requestId ? ` (ref: ${requestId})` : "";

  if (response.status >= 500) {
    const msg = typeof body.message === "string" && body.message
      ? body.message
      : typeof body.error === "string" && body.error
        ? body.error
        : null;
    return (msg ?? "A server error occurred. Please try again or contact support.") + suffix;
  }

  if (typeof body.message === "string" && body.message) return body.message + suffix;
  if (typeof body.error === "string" && body.error) return body.error + suffix;
  if (Array.isArray(body.issues) && (body.issues as unknown[]).length > 0) {
    const msg = (body.issues as Array<{ message?: string }>)
      .map((issue) => issue.message)
      .filter(Boolean)
      .join("; ");
    if (msg) return msg + suffix;
  }

  return fallback + suffix;
}
