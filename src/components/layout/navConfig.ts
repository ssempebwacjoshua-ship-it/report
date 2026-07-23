import { hasPermission } from "../../shared/permissions";

export type ProductKey = "reportLab" | "smartPages" | "nfc";

export type NavItem = {
  to: string;
  label: string;
  exact?: boolean;
  requiredPermission?: string;
  visibleRoles?: string[];
  icon:
    | "activity"
    | "bell"
    | "clipboard"
    | "cloud"
    | "credit-card"
    | "file"
    | "home"
    | "search"
    | "send"
    | "settings"
    | "shield"
    | "sparkles"
    | "students"
    | "upload";
};

export const productSwitcherItems: Record<ProductKey, { label: string; to: string }> = {
  reportLab: { label: "Report Lab", to: "/dashboard" },
  smartPages: { label: "Smart Pages", to: "/smart-pages" },
  nfc: { label: "NFC", to: "/nfc/wristbands" },
};

export function getVisibleProductSwitcherProducts(role: string | null | undefined, pathname: string): ProductKey[] {
  if (hasPermission(role, "app.admin")) {
    return ["reportLab", "smartPages", "nfc"];
  }

  if (hasPermission(role, "nfc.gate.view") || hasPermission(role, "nfc.canteen.view")) {
    return ["nfc"];
  }

  return [getProductFromPath(pathname)];
}

export const navItemsByProduct: Record<ProductKey, NavItem[]> = {
  reportLab: [
    { to: "/dashboard", label: "Dashboard", icon: "home", exact: true, requiredPermission: "app.admin" },
    { to: "/students", label: "Students", icon: "students", exact: true, requiredPermission: "app.admin" },
    { to: "/inventory", label: "Inventory", icon: "clipboard", exact: false, requiredPermission: "app.admin" },
    { to: "/reports", label: "Reports", icon: "file", exact: true, requiredPermission: "app.admin" },
    { to: "/communications", label: "Communication", icon: "bell", exact: true, requiredPermission: "communications.view" },
    { to: "/settings", label: "Academic Setup", icon: "settings", requiredPermission: "app.admin" },
  ],
  smartPages: [
    { to: "/dashboard", label: "Dashboard", icon: "home", exact: true, requiredPermission: "app.admin" },
    { to: "/smart-pages", label: "Document History", icon: "file", exact: true, requiredPermission: "app.admin" },
    { to: "/collections", label: "Templates", icon: "clipboard", exact: true, requiredPermission: "app.admin" },
    { to: "/smart-pages/billing", label: "Billing", icon: "credit-card", exact: true, requiredPermission: "app.admin" },
    { to: "/preferences", label: "Settings", icon: "settings", requiredPermission: "app.admin" },
  ],
  nfc: [
    { to: "/nfc/wristbands", label: "Wristbands", icon: "shield", exact: true, requiredPermission: "nfc.tags.manage" },
    { to: "/nfc/attendance", label: "Attendance", icon: "activity", exact: true, requiredPermission: "nfc.devices.manage" },
    { to: "/nfc/wallets", label: "Wallets", icon: "credit-card", exact: true, requiredPermission: "nfc.wallets.pin.manage" },
    { to: "/nfc/canteen", label: "Charge", icon: "credit-card", exact: true, requiredPermission: "nfc.canteen.charge" },
    { to: "/nfc/gate", label: "Gate", icon: "shield", exact: true, requiredPermission: "nfc.gate.view", visibleRoles: ["SECURITY", "GATE_SECURITY"] },
    { to: "/nfc/gate-admin", label: "Gate Operations", icon: "activity", exact: true, requiredPermission: "app.admin" },
    { to: "/nfc/settings", label: "Settings", icon: "settings", exact: true, requiredPermission: "app.admin" },
    { to: "/nfc/staff-users", label: "Staff", icon: "settings", exact: true, requiredPermission: "staff.manage" },
  ],
};

const smartPagesPrefixes = [
  "/smart-pages",
  "/collections",
  "/search",
  "/automations",
  "/analytics",
  "/notifications",
  "/preferences",
  "/smart-pages/billing",
];

// All NFC pages live under /nfc/ plus the token deep-link paths.
const nfcPrefixes = ["/nfc/", "/canteen/nfc/", "/gate/nfc/"];

// Legacy paths (now redirect to /nfc/*) still show NFC sidebar while redirecting.
const legacyNfcPaths = [
  "/nfc-tags",
  "/nfc-attendance",
  "/nfc-wallets",
  "/student-credentials",
  "/canteen-charge",
  "/gate-security",
];

export function getProductFromPath(pathname: string): ProductKey {
  if (
    nfcPrefixes.some((p) => pathname === p || pathname.startsWith(p)) ||
    legacyNfcPaths.some((p) => pathname === p || pathname.startsWith(`${p}/`))
  ) return "nfc";
  return smartPagesPrefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`))
    ? "smartPages"
    : "reportLab";
}

export function isActiveNavPath(pathname: string, to: string, exact = false) {
  return exact ? pathname === to : pathname === to || pathname.startsWith(`${to}/`);
}
