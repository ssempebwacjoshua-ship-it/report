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
