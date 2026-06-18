import { useEffect, useRef, useState } from "react";

// ── Storage keys ───────────────────────────────────────────────────────────────

const DISMISSED_KEY = "sc_pwa_dismissed_v3";
const INSTALLED_KEY = "sc_pwa_installed";
const DISMISS_TTL_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

// ── Platform detection ─────────────────────────────────────────────────────────

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isAndroidChrome() {
  const ua = window.navigator.userAgent;
  return /Android/i.test(ua) && /Chrome/i.test(ua) && !/SamsungBrowser/i.test(ua);
}

function isIos() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

function isMobile() {
  return isAndroidChrome() || isIos();
}

function wasDismissedRecently() {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    if (!raw) return false;
    return Date.now() - Number(raw) < DISMISS_TTL_MS;
  } catch {
    return false;
  }
}

function wasInstalled() {
  try {
    return localStorage.getItem(INSTALLED_KEY) === "true";
  } catch {
    return false;
  }
}

// ── Types ──────────────────────────────────────────────────────────────────────

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type BannerState = "hidden" | "chrome-prompt" | "manual-android" | "manual-ios";

// ── Manual instruction modals ──────────────────────────────────────────────────

function AndroidInstructions({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="no-print fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 p-4 sm:items-center">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center gap-3">
          <img src="/icons/icon-192.png" alt="" className="h-10 w-10 rounded-xl" />
          <div>
            <p className="font-black text-slate-900">Install Smart Pages</p>
            <p className="text-xs text-slate-500">Add to your home screen</p>
          </div>
        </div>
        <ol className="mb-5 grid gap-3">
          {[
            ["1", "Tap ⋮ (three-dot menu)", "Top right corner of Chrome"],
            ["2", 'Tap "Add to Home screen"', 'Or "Install app"'],
            ["3", 'Tap "Add" to confirm', "The app installs in seconds"],
          ].map(([num, title, sub]) => (
            <li key={num} className="flex items-start gap-3">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-blue-600 text-xs font-black text-white">
                {num}
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-900">{title}</p>
                <p className="text-xs text-slate-500">{sub}</p>
              </div>
            </li>
          ))}
        </ol>
        <button
          type="button"
          onClick={onDismiss}
          className="w-full rounded-xl border border-slate-200 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50"
        >
          Maybe Later
        </button>
      </div>
    </div>
  );
}

function IosInstructions({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="no-print fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 p-4 sm:items-center">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center gap-3">
          <img src="/icons/icon-192.png" alt="" className="h-10 w-10 rounded-xl" />
          <div>
            <p className="font-black text-slate-900">Install Smart Pages</p>
            <p className="text-xs text-slate-500">Add to your home screen</p>
          </div>
        </div>
        <ol className="mb-5 grid gap-3">
          {[
            ["1", "Tap Share ↑", "Bottom toolbar in Safari"],
            ["2", 'Tap "Add to Home Screen"', "Scroll down in the share sheet"],
            ["3", 'Tap "Add"', "The app installs immediately"],
          ].map(([num, title, sub]) => (
            <li key={num} className="flex items-start gap-3">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-blue-600 text-xs font-black text-white">
                {num}
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-900">{title}</p>
                <p className="text-xs text-slate-500">{sub}</p>
              </div>
            </li>
          ))}
        </ol>
        <button
          type="button"
          onClick={onDismiss}
          className="w-full rounded-xl border border-slate-200 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50"
        >
          Maybe Later
        </button>
      </div>
    </div>
  );
}

// ── Big install banner (Chrome prompt available) ───────────────────────────────

function InstallBanner({
  onInstall,
  onDismiss,
  onShowManual,
}: {
  onInstall: () => void;
  onDismiss: () => void;
  onShowManual: () => void;
}) {
  return (
    <div className="no-print fixed inset-x-0 bottom-0 z-50 border-t border-blue-100 bg-white px-4 pb-safe-area-inset-bottom shadow-[0_-4px_24px_rgba(0,0,0,0.10)] sm:inset-x-auto sm:right-4 sm:bottom-4 sm:max-w-sm sm:rounded-2xl sm:border sm:border-blue-100">
      <div className="px-0 py-4 sm:px-4">
        {/* Header row */}
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/icons/icon-192.png" alt="" className="h-10 w-10 rounded-xl shadow-sm" />
            <div>
              <p className="text-base font-black text-slate-900">Install Smart Pages</p>
              <p className="text-xs text-slate-500">Faster access - Offline - Full mobile experience</p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={onDismiss}
            className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Install button with pulse */}
        <button
          type="button"
          onClick={onInstall}
          className="relative w-full overflow-hidden rounded-xl bg-blue-600 py-3.5 text-sm font-black text-white shadow-lg shadow-blue-600/30 hover:bg-blue-700 active:scale-[0.98]"
        >
          <span className="relative z-10 flex items-center justify-center gap-2">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
            </svg>
            Install App
          </span>
          {/* Pulse ring */}
          <span className="absolute inset-0 animate-ping rounded-xl bg-blue-400 opacity-20" />
        </button>

        <div className="mt-2 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={onDismiss}
            className="py-2 text-xs font-medium text-slate-400 hover:text-slate-600"
          >
            Maybe Later
          </button>
          <span className="text-slate-200" aria-hidden>-</span>
          <button
            type="button"
            onClick={onShowManual}
            className="py-2 text-xs font-medium text-slate-400 underline hover:text-slate-600"
          >
            Manual install
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function InstallPrompt() {
  const [bannerState, setBannerState] = useState<BannerState>("hidden");
  const [showManual, setShowManual] = useState(false);
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null);
  const promptCaptured = useRef(false);

  useEffect(() => {
    // Never show if already installed or dismissed recently
    if (isStandalone() || wasInstalled() || wasDismissedRecently()) return;
    // Only show on mobile
    if (!isMobile()) return;

    function onBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      deferredPromptRef.current = e as BeforeInstallPromptEvent;
      promptCaptured.current = true;
      setBannerState("chrome-prompt");
    }

    function onAppInstalled() {
      try { localStorage.setItem(INSTALLED_KEY, "true"); } catch { /* noop */ }
      setBannerState("hidden");
      deferredPromptRef.current = null;
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);

    // After 4 s, if Chrome prompt never fired, show manual fallback on mobile
    const fallbackTimer = setTimeout(() => {
       if (promptCaptured.current) return; // prompt fired - already showing
      if (isStandalone() || wasInstalled() || wasDismissedRecently()) return;
      if (isAndroidChrome()) setBannerState("manual-android");
      else if (isIos()) setBannerState("manual-ios");
    }, 4000);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
      clearTimeout(fallbackTimer);
    };
  }, []);

  function dismiss() {
    setBannerState("hidden");
    setShowManual(false);
    deferredPromptRef.current = null;
    try { localStorage.setItem(DISMISSED_KEY, String(Date.now())); } catch { /* noop */ }
  }

  async function install() {
    const prompt = deferredPromptRef.current;
    if (!prompt) { setShowManual(true); return; }
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice.outcome === "dismissed") dismiss();
    } catch {
      setShowManual(true);
    }
    deferredPromptRef.current = null;
  }

  if (bannerState === "hidden") return null;

  if (showManual) {
    return isIos()
      ? <IosInstructions onDismiss={dismiss} />
      : <AndroidInstructions onDismiss={dismiss} />;
  }

  if (bannerState === "manual-android") return <AndroidInstructions onDismiss={dismiss} />;
  if (bannerState === "manual-ios") return <IosInstructions onDismiss={dismiss} />;

  return (
    <InstallBanner
      onInstall={() => void install()}
      onDismiss={dismiss}
      onShowManual={() => setShowManual(true)}
    />
  );
}

