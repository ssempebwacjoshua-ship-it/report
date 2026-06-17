import { Link, useLocation } from "react-router-dom";
import type { CSSProperties } from "react";
import { Icon } from "./Icon";
import { getSchoolDisplayName, getSchoolInitials } from "./branding";
import { useAppSettings } from "./SettingsContext";
import { useAuth } from "../../contexts/AuthContext";

type Props = {
  open: boolean;
  onClose: () => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  width: number;
};

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: "home" as const },
  { to: "/students", label: "Students", icon: "students" as const },
  { to: "/reports", label: "Report Generation", icon: "file" as const },
  { to: "/reports/release", label: "Release Center", icon: "send" as const },
  { to: "/imports/marks", label: "Marks Import", icon: "upload" as const },
  { to: "/marksheets", label: "Marksheets", icon: "clipboard" as const },
  { to: "/smart-pages", label: "Smart Pages", icon: "sparkles" as const },
  { to: "/documents/cleaner", label: "Paper to PDF", icon: "cloud" as const },
  { to: "/settings", label: "Settings", icon: "settings" as const },
];

export function Sidebar({ open, onClose, collapsed, onToggleCollapsed, width }: Props) {
  const location = useLocation();
  const { user } = useAuth();
  const { settings } = useAppSettings() ?? {};
  const school = settings?.sections.school;
  const schoolName = getSchoolDisplayName(school, "School Connect");
  const initials = getSchoolInitials(schoolName);
  const sidebarWidth = collapsed ? 72 : width;

  function isNavActive(to: string) {
    return location.pathname === to || location.pathname.startsWith(`${to}/`);
  }

  return (
    <>
      <button
        type="button"
        aria-label="Close navigation"
        className={`fixed inset-0 z-30 bg-slate-950/40 transition lg:hidden ${open ? "block" : "hidden"}`}
        onClick={onClose}
      />
      <aside
        style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}
        className={`app-shell-sidebar fixed inset-y-0 left-0 z-40 flex w-[240px] transform flex-col overflow-y-auto overscroll-contain bg-gradient-to-b from-blue-950 via-blue-900 to-sky-900 text-white shadow-2xl transition-transform duration-200 lg:sticky lg:top-0 lg:h-screen lg:w-[var(--sidebar-width)] lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className={`flex items-center gap-3 ${collapsed ? "px-2 pt-3" : "px-3 pt-3"}`}>
          <div
            className={`grid ${collapsed ? "h-8 w-8" : "h-9 w-9"} place-items-center rounded-xl bg-white/15 ring-1 ring-white/25`}
          >
            {school?.logoUrl ? (
              <img
                src={school.logoUrl}
                alt={`${schoolName} logo`}
                className="h-8 w-8 rounded-xl bg-white/10 object-contain"
              />
            ) : (
              <span className="text-sm font-black text-white">{initials}</span>
            )}
          </div>
          {!collapsed ? (
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-sm font-bold leading-tight">{schoolName}</p>
              <p className="mt-0.5 text-[11px] font-medium text-blue-200">{school?.schoolCode ?? "—"}</p>
            </div>
          ) : null}
        </div>

        <nav className="mt-4 grid flex-1 content-start gap-1 overflow-y-auto px-2 pb-3">
          {navItems.map((item) => {
            const active = isNavActive(item.to);
            return (
              <Link
                key={item.label}
                to={item.to}
                title={collapsed ? item.label : undefined}
                onClick={onClose}
                className={`group flex items-center gap-3 rounded-xl border px-3 py-1.5 text-sm font-semibold transition ${
                  active
                    ? "border-blue-300/40 bg-white/12 text-white shadow-[0_10px_20px_rgba(15,23,42,0.16)] ring-1 ring-blue-300/20"
                    : "border-transparent text-blue-100 hover:border-white/10 hover:bg-white/8 hover:text-white"
                }`}
              >
                <Icon
                  name={item.icon}
                  className={`h-4 w-4 shrink-0 ${active ? "text-white" : "text-blue-300"} transition group-hover:text-white`}
                />
                {!collapsed ? <span className="truncate">{item.label}</span> : null}
              </Link>
            );
          })}
        </nav>

        <div className={`mt-auto border-t border-white/10 ${collapsed ? "px-2 py-3" : "px-3 py-3"}`}>
          <div className={`flex items-center gap-3 ${collapsed ? "justify-center" : ""}`}>
            <div className="grid h-8 w-8 place-items-center rounded-full bg-white text-blue-700">
              <Icon name="user" className="h-4 w-4" />
            </div>
            {!collapsed ? (
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{user?.name ?? "School Admin"}</p>
                <p className="truncate text-xs text-blue-200">{user?.role === "ADMIN_OPERATOR" ? "Administrator" : (user?.role ?? "Administrator")}</p>
              </div>
            ) : null}
          </div>
          <button
            type="button"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="no-print mt-3 hidden h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/10 text-blue-100 transition hover:bg-white/15 hover:text-white lg:inline-flex"
            onClick={onToggleCollapsed}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <Icon name="chevron" className={`h-4 w-4 transition ${collapsed ? "" : "rotate-180"}`} />
          </button>
        </div>
      </aside>
    </>
  );
}
