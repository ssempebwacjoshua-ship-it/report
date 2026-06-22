export type ProductKey = "reportLab" | "smartPages";

export type NavItem = {
  to: string;
  label: string;
  exact?: boolean;
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
};

export const navItemsByProduct: Record<ProductKey, NavItem[]> = {
  reportLab: [
    { to: "/dashboard", label: "Dashboard", icon: "home", exact: true },
    { to: "/students", label: "Students", icon: "students", exact: true },
    { to: "/student-credentials", label: "NFC Wristbands", icon: "shield", exact: true },
    { to: "/nfc-attendance", label: "NFC Attendance", icon: "activity", exact: true },
    { to: "/nfc-wallets", label: "NFC Wallets", icon: "credit-card", exact: true },
    { to: "/canteen-charge", label: "Canteen Charge", icon: "credit-card", exact: true },
    { to: "/gate-security", label: "Gate Security", icon: "shield", exact: true },
    { to: "/nfc-tags", label: "NFC Tags", icon: "shield", exact: true },
    { to: "/imports/marks", label: "Marks Import", icon: "upload", exact: true },
    { to: "/marksheets", label: "Marksheets", icon: "clipboard", exact: true },
    { to: "/reports", label: "Reports", icon: "file", exact: true },
    { to: "/reports/release", label: "Release Center", icon: "send", exact: true },
    { to: "/promotions", label: "Promotions", icon: "upload", exact: true },
    { to: "/settings", label: "Academic Setup", icon: "settings" },
  ],
  smartPages: [
    { to: "/dashboard", label: "Dashboard", icon: "home", exact: true },
    { to: "/smart-pages", label: "Document History", icon: "file", exact: true },
    { to: "/collections", label: "Templates", icon: "clipboard", exact: true },
    { to: "/smart-pages/billing", label: "Billing", icon: "credit-card", exact: true },
    { to: "/preferences", label: "Settings", icon: "settings" },
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

export function getProductFromPath(pathname: string): ProductKey {
  return smartPagesPrefixes.some((path) => pathname === path || pathname.startsWith(`${path}/`))
    ? "smartPages"
    : "reportLab";
}

export function isActiveNavPath(pathname: string, to: string, exact = false) {
  return exact ? pathname === to : pathname === to || pathname.startsWith(`${to}/`);
}
