export type ProductKey = "reportLab" | "smartPages";

export type NavItem = {
  to: string;
  label: string;
  icon:
    | "activity"
    | "bell"
    | "clipboard"
    | "cloud"
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
  reportLab: { label: "Report Lab", to: "/dashboard" },
  smartPages: { label: "Smart Pages", to: "/smart-pages" },
};

export const navItemsByProduct: Record<ProductKey, NavItem[]> = {
  reportLab: [
    { to: "/dashboard", label: "Dashboard", icon: "home" },
    { to: "/students", label: "Students", icon: "students" },
    { to: "/imports/marks", label: "Marks Import", icon: "upload" },
    { to: "/marksheets", label: "Marksheets", icon: "clipboard" },
    { to: "/reports", label: "Reports", icon: "file" },
    { to: "/reports/release", label: "Release Center", icon: "send" },
    { to: "/settings", label: "Academic Setup", icon: "settings" },
  ],
  smartPages: [
    { to: "/dashboard", label: "Dashboard", icon: "home" },
    { to: "/smart-pages", label: "Document History", icon: "file" },
    { to: "/collections", label: "Templates", icon: "clipboard" },
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
];

export function getProductFromPath(pathname: string): ProductKey {
  return smartPagesPrefixes.some((path) => pathname === path || pathname.startsWith(`${path}/`))
    ? "smartPages"
    : "reportLab";
}

export function isActiveNavPath(pathname: string, to: string) {
  return pathname === to || pathname.startsWith(`${to}/`);
}
