import type { CSSProperties } from "react";
import { Link, useLocation } from "react-router-dom";
import { getSchoolDisplayName, getSchoolInitials } from "./branding";
import { Icon } from "./Icon";
import { useAppSettings } from "./SettingsContext";
import { getProductFromPath, isActiveNavPath, navItemsByProduct, type NavItem, type ProductKey } from "./navConfig";

type Props = {
  open: boolean;
  onClose: () => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  width: number;
};

function NavLinkRow({
  to,
  label,
  icon,
  active,
  collapsed,
  onClick,
}: {
  to: string;
  label: string;
  icon: NavItem["icon"];
  active: boolean;
  collapsed: boolean;
  onClick: () => void;
}) {
  return (
    <Link
      to={to}
      title={collapsed ? label : undefined}
      onClick={onClick}
      className={`group flex items-center gap-3 rounded-full border px-3 py-2 text-sm font-semibold transition ${
        active
          ? "border-white/25 bg-white text-blue-700 shadow-[0_10px_24px_rgba(15,23,42,0.14)]"
          : "border-transparent text-blue-100 hover:border-white/10 hover:bg-white/10 hover:text-white"
      }`}
    >
      <Icon
        name={icon}
        className={`h-4 w-4 shrink-0 transition ${active ? "text-blue-700" : "text-blue-200 group-hover:text-white"}`}
      />
      {!collapsed ? <span className="truncate">{label}</span> : null}
    </Link>
  );
}

function SidebarSection({
  product,
  pathname,
  collapsed,
  onNavigate,
}: {
  product: ProductKey;
  pathname: string;
  collapsed: boolean;
  onNavigate: () => void;
}) {
  const items = navItemsByProduct[product];
  const sectionLabel = product === "reportLab" ? "REPORT LAB" : "SMART PAGES";

  return (
    <>
      {!collapsed ? (
        <div className="px-3 pb-2 pt-1 text-[11px] font-black uppercase tracking-[0.18em] text-blue-200/75">
          {sectionLabel}
        </div>
      ) : null}
      <div className="grid gap-1 px-2">
        {items.map((item) => (
          <NavLinkRow
            key={item.to}
            to={item.to}
            label={item.label}
            icon={item.icon}
            active={isActiveNavPath(pathname, item.to)}
            collapsed={collapsed}
            onClick={onNavigate}
          />
        ))}
      </div>
    </>
  );
}

export function Sidebar({ open, onClose, collapsed, onToggleCollapsed, width }: Props) {
  const location = useLocation();
  const { settings } = useAppSettings() ?? {};
  const school = settings?.sections.school;
  const schoolName = getSchoolDisplayName(school, "School Connect");
  const initials = getSchoolInitials(schoolName);
  const sidebarWidth = collapsed ? 72 : width;
  const product = getProductFromPath(location.pathname);

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
        className={`app-shell-sidebar fixed inset-y-0 left-0 z-40 flex w-[260px] transform flex-col overflow-y-auto overscroll-contain bg-gradient-to-b from-blue-950 via-blue-900 to-sky-900 text-white shadow-2xl transition-transform duration-200 lg:sticky lg:top-0 lg:h-screen lg:w-[var(--sidebar-width)] lg:translate-x-0 ${
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
              <p className="mt-0.5 text-[11px] font-medium text-blue-200">{school?.schoolCode ?? "-"}</p>
            </div>
          ) : null}
        </div>

        <nav className="mt-4 grid flex-1 content-start gap-3 overflow-y-auto px-2 pb-4">
          <SidebarSection
            product={product}
            pathname={location.pathname}
            collapsed={collapsed}
            onNavigate={onClose}
          />
        </nav>
        <div className={`${collapsed ? "px-2 py-3" : "px-3 py-3"}`}>
          <button
            type="button"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="no-print hidden h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/10 text-blue-100 transition hover:bg-white/15 hover:text-white lg:inline-flex"
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
