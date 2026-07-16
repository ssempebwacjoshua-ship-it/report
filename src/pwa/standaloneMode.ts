import { getDefaultRouteForRole } from "../shared/permissions";

const PWA_LAUNCH_PATH_KEY = "sc_pwa_launch_path";
const APP_BASENAME = "/report-lab";

export function getAppBasename() {
  return APP_BASENAME;
}

export function isStandaloneDisplayMode() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function normalizeDedicatedPwaLaunchPath(pathname: string) {
  if (pathname === "/nfc/gate" || pathname.startsWith("/nfc/gate/") || pathname.startsWith("/gate/nfc/")) {
    return "/nfc/gate";
  }

  if (
    pathname === "/nfc/canteen"
    || pathname.startsWith("/nfc/canteen/")
    || pathname === "/nfc/wallets"
    || pathname.startsWith("/nfc/wallets/")
    || pathname.includes("/wallet")
  ) {
    return "/nfc/canteen";
  }

  return null;
}

export function rememberDedicatedPwaLaunchPath(pathname: string) {
  if (typeof window === "undefined") return;
  const normalized = normalizeDedicatedPwaLaunchPath(pathname);
  if (!normalized) return;

  try {
    localStorage.setItem(PWA_LAUNCH_PATH_KEY, normalized);
  } catch {
    /* noop */
  }
}

export function getRememberedDedicatedPwaLaunchPath() {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(PWA_LAUNCH_PATH_KEY);
    return raw === "/nfc/gate" || raw === "/nfc/canteen" ? raw : null;
  } catch {
    return null;
  }
}

export function resolveDedicatedPwaLaunchPath(role: string | null | undefined) {
  return getRememberedDedicatedPwaLaunchPath() ?? getDefaultRouteForRole(role);
}

export function getDedicatedWorkspaceHomeForRole(role: string | null | undefined) {
  if (role === "SECURITY" || role === "GATE_SECURITY") return "/nfc/gate";
  if (role === "CANTEEN" || role === "CASHIER") return "/nfc/canteen";
  return null;
}

export function getDedicatedWorkspaceKindForRole(role: string | null | undefined) {
  if (role === "SECURITY" || role === "GATE_SECURITY") return "gate";
  if (role === "CANTEEN" || role === "CASHIER") return "canteen";
  return null;
}

export function buildAppUrl(pathname: string) {
  if (typeof window === "undefined") return `${APP_BASENAME}${pathname}`;
  return new URL(`${APP_BASENAME}${pathname}`, window.location.origin).toString();
}

export function getDedicatedInstalledWorkspace(pathname: string, role: string | null | undefined) {
  if (!isStandaloneDisplayMode()) return null;

  const workspace = getDedicatedWorkspaceKindForRole(role);
  return pathname.startsWith("/nfc/") ? workspace : null;
}
