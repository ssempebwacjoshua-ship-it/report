import { getAppBasePath } from "../client/apiBase";

/** Registers the service worker in production builds only.
 * Checks for updates on load and on tab focus so users pick up new bundles quickly.
 */
export function registerServiceWorker() {
  if (!import.meta.env.PROD) return;
  if (!("serviceWorker" in navigator)) return;

  const appBasePath = getAppBasePath();

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register(`${appBasePath}/sw.js`, { scope: `${appBasePath}/` })
      .then((registration) => {
        const activateWaitingWorker = () => {
          registration.waiting?.postMessage({ type: "SKIP_WAITING" });
        };

        activateWaitingWorker();
        registration.addEventListener("updatefound", () => {
          const nextWorker = registration.installing;
          if (!nextWorker) return;
          nextWorker.addEventListener("statechange", () => {
            if (nextWorker.state === "installed" && navigator.serviceWorker.controller) {
              activateWaitingWorker();
            }
          });
        });

        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") registration.update().catch(() => {});
        });
      })
      .catch(() => {
        /* SW is an enhancement; never block the app */
      });
  });

  let refreshed = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshed) return;
    refreshed = true;
    window.location.reload();
  });
}
