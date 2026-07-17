export const PUBLIC_SERVICE_WORKER_URL = "/sw.js";
export const PUBLIC_SERVICE_WORKER_SCOPE = "/";
export const PUBLIC_SW_CLEANUP_MARKER_PARAM = "__public_site_sw_cleanup";
export const PUBLIC_SW_CLEANUP_MARKER_VERSION = "public-site-sw-cleanup-v1";
export const PUBLIC_SW_CACHE_PREFIXES = ["public-site-", "ssamenj-public-site-"] as const;

export function ownsPublicSiteCache(cacheName: string) {
  const normalizedName = cacheName.trim().toLowerCase();
  return PUBLIC_SW_CACHE_PREFIXES.some((prefix) => normalizedName.startsWith(prefix));
}

export function buildPublicSwCleanupRefreshUrl(urlString: string, origin = "https://ssamenj.online") {
  const url = new URL(urlString, origin);
  if (url.origin !== origin) return null;
  if (url.searchParams.get(PUBLIC_SW_CLEANUP_MARKER_PARAM) === PUBLIC_SW_CLEANUP_MARKER_VERSION) {
    return null;
  }

  url.searchParams.set(PUBLIC_SW_CLEANUP_MARKER_PARAM, PUBLIC_SW_CLEANUP_MARKER_VERSION);
  return url.toString();
}

export function stripPublicSwCleanupMarkerFromLocation() {
  if (typeof window === "undefined") return false;

  const url = new URL(window.location.href);
  if (url.searchParams.get(PUBLIC_SW_CLEANUP_MARKER_PARAM) !== PUBLIC_SW_CLEANUP_MARKER_VERSION) {
    return false;
  }

  url.searchParams.delete(PUBLIC_SW_CLEANUP_MARKER_PARAM);
  const nextPath = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState(window.history.state, "", nextPath || "/");
  return true;
}
