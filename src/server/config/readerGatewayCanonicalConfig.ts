function normalizeBaseUrl(value: string) {
  return value.trim().replace(/\/+$/, "");
}

export function getReaderGatewayCanonicalApiBaseUrl() {
  const configured = process.env.READER_GATEWAY_PRODUCTION_API_BASE_URL?.trim()
    || process.env.PUBLIC_APP_URL?.trim()
    || process.env.APP_URL?.trim()
    || process.env.APP_BASE_URL?.trim()
    || "";

  if (!configured) {
    return "https://ssamenj.online/report-lab";
  }

  return normalizeBaseUrl(configured);
}
