const CACHE_PREFIXES = ["public-site-", "ssamenj-public-site-"];
const REFRESH_MARKER_PARAM = "__public_site_sw_cleanup";
const REFRESH_MARKER_VERSION = "public-site-sw-cleanup-v1";

function ownsPublicSiteCache(cacheName) {
  const normalizedName = String(cacheName || "").toLowerCase();
  return CACHE_PREFIXES.some((prefix) => normalizedName.startsWith(prefix));
}

function withRefreshMarker(urlString) {
  const url = new URL(urlString);
  if (url.origin !== self.location.origin) return null;
  if (url.searchParams.get(REFRESH_MARKER_PARAM) === REFRESH_MARKER_VERSION) return null;

  url.searchParams.set(REFRESH_MARKER_PARAM, REFRESH_MARKER_VERSION);
  return url.toString();
}

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      await self.clients.claim();

      const cacheKeys = await caches.keys();
      await Promise.all(
        cacheKeys.filter((cacheName) => ownsPublicSiteCache(cacheName)).map((cacheName) => caches.delete(cacheName)),
      );

      const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      await Promise.all(
        clients.map(async (client) => {
          if (typeof client.navigate !== "function") return;

          const refreshUrl = withRefreshMarker(client.url);
          if (!refreshUrl) return;

          await client.navigate(refreshUrl);
        }),
      );

      await self.registration.unregister();
    })(),
  );
});
