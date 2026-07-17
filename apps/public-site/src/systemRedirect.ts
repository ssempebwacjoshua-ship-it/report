const TOKEN_KEY = "sc_auth_token";
const USER_KEY = "sc_auth_user";
const SYSTEM_BASE = "/report-lab";
const SYSTEM_LAUNCH_PATH = `${SYSTEM_BASE}/pwa-launch`;

const EXACT_SYSTEM_REDIRECTS = new Map<string, string>([
  ["/login", `${SYSTEM_BASE}/login`],
  ["/logout", `${SYSTEM_BASE}/logout`],
  ["/forgot-password", `${SYSTEM_BASE}/forgot-password`],
  ["/reset-password", `${SYSTEM_BASE}/reset-password`],
  ["/pwa-launch", SYSTEM_LAUNCH_PATH],
  ["/dashboard", `${SYSTEM_BASE}/dashboard`],
  ["/admin", `${SYSTEM_BASE}/dashboard`],
  ["/gate", `${SYSTEM_BASE}/nfc/gate`],
  ["/gate-security", `${SYSTEM_BASE}/nfc/gate`],
  ["/canteen", `${SYSTEM_BASE}/nfc/canteen`],
  ["/canteen-charge", `${SYSTEM_BASE}/nfc/canteen`],
]);

const PREFIX_SYSTEM_REDIRECTS = [
  { prefix: "/account/", destination: `${SYSTEM_BASE}/account/` },
  { prefix: "/nfc/", destination: `${SYSTEM_BASE}/nfc/` },
  { prefix: "/students/", destination: `${SYSTEM_BASE}/students/` },
];

export function hasSystemSessionMarker() {
  if (typeof window === "undefined") return false;
  try {
    return Boolean(window.localStorage.getItem(TOKEN_KEY) || window.localStorage.getItem(USER_KEY));
  } catch {
    return false;
  }
}

export function resolvePublicSiteSystemRedirect(pathname: string, _hasSystemSession = false) {
  if (pathname.startsWith(`${SYSTEM_BASE}/`)) return null;

  const exact = EXACT_SYSTEM_REDIRECTS.get(pathname);
  if (exact) return exact;

  for (const rule of PREFIX_SYSTEM_REDIRECTS) {
    if (pathname.startsWith(rule.prefix)) {
      return `${rule.destination}${pathname.slice(rule.prefix.length)}`;
    }
  }

  return null;
}
