import { useEffect, useState } from "react";

const DISMISSED_KEY = "school-connect-install-dismissed";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isIos() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari legacy flag
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** Small, dismissible install helper.
 * - Chrome/Edge/Android: shows an "Install app" button when beforeinstallprompt fires.
 * - iOS Safari: shows Share → Add to Home Screen instructions.
 * - Never shows when already installed, and stays hidden after dismissal.
 */
export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISSED_KEY) === "true";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (dismissed || isStandalone()) return;

    function onBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);

    if (isIos()) setShowIosHelp(true);

    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
  }, [dismissed]);

  function dismiss() {
    setDismissed(true);
    setDeferredPrompt(null);
    setShowIosHelp(false);
    try {
      localStorage.setItem(DISMISSED_KEY, "true");
    } catch {
      /* noop */
    }
  }

  async function install() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === "dismissed") dismiss();
    setDeferredPrompt(null);
  }

  if (dismissed || isStandalone() || (!deferredPrompt && !showIosHelp)) return null;

  return (
    <div className="no-print fixed inset-x-3 bottom-3 z-50 mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-3 shadow-xl sm:inset-x-auto sm:right-4 sm:bottom-4">
      <div className="flex items-start gap-3">
        <img src="/icons/icon-192.png" alt="" className="h-9 w-9 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-slate-900">Install School Connect</p>
          {deferredPrompt ? (
            <p className="mt-0.5 text-xs text-slate-500">Add the app to your home screen for quick access.</p>
          ) : (
            <p className="mt-0.5 text-xs text-slate-500">
              On iPhone: tap <span className="font-semibold">Share</span>, then{" "}
              <span className="font-semibold">Add to Home Screen</span>.
            </p>
          )}
          <div className="mt-2 flex gap-2">
            {deferredPrompt ? (
              <button
                type="button"
                onClick={() => void install()}
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-blue-700"
              >
                Install app
              </button>
            ) : null}
            <button
              type="button"
              onClick={dismiss}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              Not now
            </button>
          </div>
        </div>
        <button
          type="button"
          aria-label="Dismiss install prompt"
          onClick={dismiss}
          className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
