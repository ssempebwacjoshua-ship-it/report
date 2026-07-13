/* School Connect Reports - service worker.
 * Safety rules:
 *  - NEVER caches API responses (any /api/ path or cross-origin request, e.g. Railway).
 *  - Cache-first only for same-origin immutable hashed assets (/assets/) and icons.
 *  - Navigations are network-first; offline fallback is the cached app shell, which
 *    shows the app's own honest error/offline states (no fake data, no fake login).
 *  - Versioned cache + immediate activation so users don't stay on stale bundles.
 */
const CACHE_VERSION = "report-lab-v6";
const BASE_PATH = "/report-lab";
const SHELL_CACHE = `${CACHE_VERSION}-shell`;
const ASSET_CACHE = `${CACHE_VERSION}-assets`;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll([`${BASE_PATH}/`, `${BASE_PATH}/manifest.webmanifest`])).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(CACHE_VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return; // never touch mutations

  const url = new URL(req.url);

  // Never intercept cross-origin (Railway API) or any /api/ path - browser handles them normally.
  if (url.origin !== self.location.origin || !url.pathname.startsWith(`${BASE_PATH}/`) || url.pathname.startsWith(`${BASE_PATH}/api/`)) return;

  // Navigations: network-first, fall back to cached shell when offline.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(SHELL_CACHE).then((cache) => cache.put(`${BASE_PATH}/`, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(`${BASE_PATH}/`))
    );
    return;
  }

  // Hashed immutable assets + icons: cache-first.
  if (url.pathname.startsWith(`${BASE_PATH}/assets/`) || url.pathname.startsWith(`${BASE_PATH}/icons/`) || url.pathname === `${BASE_PATH}/manifest.webmanifest` || url.pathname === `${BASE_PATH}/manifest.json` || url.pathname === `${BASE_PATH}/favicon.svg`) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(ASSET_CACHE).then((cache) => cache.put(req, copy)).catch(() => {});
            }
            return res;
          })
      )
    );
  }
  // Everything else: default browser behavior (no caching).
});
