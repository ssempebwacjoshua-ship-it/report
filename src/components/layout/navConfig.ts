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
    | "sparkles"
    | "students"
    | "upload";
};

export const productSwitcherItems: Record<ProductKey, { label: string; to: string }> = {
  reportLab: { label: "Report Lab", to: "/app/dashboard" },
  smartPages: { label: "Smart Pages", to: "/app/smart-pages" },
};

export const navItemsByProduct: Record<ProductKey, NavItem[]> = {
  reportLab: [
    { to: "/app/dashboard", label: "Dashboard", icon: "home", exact: true },
    { to: "/app/students", label: "Students", icon: "students", exact: true },
    { to: "/app/imports/marks", label: "Marks Import", icon: "upload", exact: true },
    { to: "/app/marksheets", label: "Marksheets", icon: "clipboard", exact: true },
    { to: "/app/reports", label: "Reports", icon: "file", exact: true },
    { to: "/app/reports/release", label: "Release Center", icon: "send", exact: true },
    { to: "/app/promotions", label: "Promotions", icon: "upload", exact: true },
    { to: "/app/settings", label: "Academic Setup", icon: "settings" },
  ],
  smartPages: [
    { to: "/app/dashboard", label: "Dashboard", icon: "home", exact: true },
    { to: "/app/smart-pages", label: "Document History", icon: "file", exact: true },
    { to: "/app/collections", label: "Templates", icon: "clipboard", exact: true },
    { to: "/app/smart-pages/billing", label: "Billing", icon: "credit-card", exact: true },
    { to: "/app/preferences", label: "Settings", icon: "settings" },
  ],
};

const smartPagesPrefixes = [
  "/app/smart-pages",
  "/app/collections",
  "/app/search",
  "/app/automations",
  "/app/analytics",
  "/app/notifications",
  "/app/preferences",
  "/app/smart-pages/billing",
];

export function getProductFromPath(pathname: string): ProductKey {
  return smartPagesPrefixes.some((path) => pathname === path || pathname.startsWith(`${path}/`))
    ? "smartPages"
    : "reportLab";
}

export function isActiveNavPath(pathname: string, to: string, exact = false) {
  return exact ? pathname === to : pathname === to || pathname.startsWith(`${to}/`);
}
