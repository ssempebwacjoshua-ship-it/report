function normalizeBaseUrl(value: string) {
  return value.trim().replace(/\/+$/, "");
}

const READER_GATEWAY_FALLBACK_API_BASE_URL = "https://report-production-b00d.up.railway.app";

export function getReaderGatewayCanonicalApiBaseUrl() {
  const configured = process.env.READER_GATEWAY_PRODUCTION_API_BASE_URL?.trim()
    || process.env.READER_GATEWAY_API_BASE_URL?.trim()
    || process.env.VITE_API_BASE_URL?.trim()
    || process.env.PUBLIC_APP_URL?.trim()
    || process.env.APP_URL?.trim()
    || process.env.APP_BASE_URL?.trim()
    || "";

  if (!configured) {
    return READER_GATEWAY_FALLBACK_API_BASE_URL;
  }

  return normalizeBaseUrl(configured);
}
