const LOCAL_APP_URL = "http://localhost:5173";

export function getPublicAppUrl() {
  const configured = process.env.APP_BASE_URL ?? process.env.PUBLIC_APP_URL ?? process.env.CLIENT_ORIGIN;
  if (configured?.trim()) return configured.trim().replace(/\/+$/, "");
  if (process.env.NODE_ENV === "production") {
    throw new Error("APP_BASE_URL, PUBLIC_APP_URL, or CLIENT_ORIGIN is required in production.");
  }
  return LOCAL_APP_URL;
}

export function getPublicSiteUrl() {
  return getPublicAppUrl().replace(/\/report-lab$/i, "");
}

export function buildParentReportPublicUrl(token: string) {
  return `${getPublicSiteUrl()}/r/${token}`;
}

