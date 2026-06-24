import type { CSSProperties } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  ArrowUploadRegular,
  ChevronLeftRegular,
  DocumentRegular,
  DocumentTextRegular,
  HomeRegular,
  PeopleRegular,
  ReceiptRegular,
  SendRegular,
  SettingsRegular,
  ShieldRegular,
  SparkleRegular,
} from "@fluentui/react-icons";
import { getSchoolDisplayName } from "./branding";
import { useAppSettings } from "./SettingsContext";
import { useAuth } from "../../contexts/AuthContext";
import { hasPermission } from "../../shared/permissions";
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
      className={`group flex h-10 min-w-0 items-center gap-2 rounded-full border px-2.5 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-0 ${
        active
          ? "border-white/25 bg-[color:var(--sc-primary-soft)] text-[color:var(--sc-primary)] shadow-[0_10px_24px_rgba(15,23,42,0.14)]"
          : "border-transparent text-white hover:border-white/10 hover:bg-white/10 hover:text-white"
      }`}
    >
      <ShellNavIcon name={icon} active={active} />
      {!collapsed ? <span className="min-w-0 flex-1 truncate">{label}</span> : null}
    </Link>
  );
}

function ShellNavIcon({ name, active }: { name: NavItem["icon"]; active: boolean }) {
  const className = `h-4 w-4 shrink-0 transition ${active ? "text-[color:var(--sc-primary)]" : "text-white group-hover:text-white"}`;

  switch (name) {
    case "home":
      return <HomeRegular className={className} />;
    case "students":
      return <PeopleRegular className={className} />;
    case "upload":
      return <ArrowUploadRegular className={className} />;
    case "clipboard":
      return <DocumentTextRegular className={className} />;
    case "file":
      return <DocumentRegular className={className} />;
    case "send":
      return <SendRegular className={className} />;
    case "credit-card":
      return <ReceiptRegular className={className} />;
    case "settings":
      return <SettingsRegular className={className} />;
    case "shield":
      return <ShieldRegular className={className} />;
    case "sparkles":
      return <SparkleRegular className={className} />;
    default:
      return <DocumentRegular className={className} />;
  }
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
  const { user } = useAuth();
  const allItems = navItemsByProduct[product];
  const items = allItems.filter((item) =>
    !item.requiredPermission || hasPermission(user?.role, item.requiredPermission),
  );
  const sectionLabel = product === "reportLab" ? "REPORT LAB" : product === "nfc" ? "NFC" : "SMART PAGES";

  const groupedItems = items.reduce<Record<string, NavItem[]>>((groups, item) => {
    const key = item.section ?? "";
    (groups[key] ??= []).push(item);
    return groups;
  }, {});
  const orderedSections = items.reduce<string[]>((sections, item) => {
    const key = item.section ?? "";
    if (!sections.includes(key)) sections.push(key);
    return sections;
  }, []);

  if (items.length === 0) return null;

  return (
    <>
      {!collapsed ? (
        <div className="px-2 pb-1 pt-0.5 text-[11px] font-black uppercase tracking-[0.18em] text-white">
          {sectionLabel}
        </div>
      ) : null}
      <div className="grid gap-2 px-1.5">
        {orderedSections.map((section) => {
          const sectionItems = groupedItems[section] ?? [];
          return (
            <div key={section} className="grid gap-1.5">
              {!collapsed && section ? (
                <div className="px-2 pt-1 text-[10px] font-black uppercase tracking-[0.16em] text-white/75">
                  {section}
                </div>
              ) : null}
              <div className="grid gap-1">
                {sectionItems.map((item) => (
                  <NavLinkRow
                    key={item.to}
                    to={item.to}
                    label={item.label}
                    icon={item.icon}
                    active={isActiveNavPath(pathname, item.to, item.exact)}
                    collapsed={collapsed}
                    onClick={onNavigate}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

export function Sidebar({ open, onClose, collapsed, onToggleCollapsed, width }: Props) {
  const location = useLocation();
  const { settings } = useAppSettings() ?? {};
  const school = settings?.sections.school;
  const schoolName = getSchoolDisplayName(school, "School Connect");
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
        className={`app-shell-sidebar fixed inset-y-0 left-0 z-40 flex w-[var(--sidebar-width)] transform flex-col overflow-x-hidden overflow-y-auto overscroll-contain text-white shadow-2xl transition-transform duration-200 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{
          "--sidebar-width": `${sidebarWidth}px`,
          background: "var(--sc-primary)",
        } as CSSProperties}
      >
        <div className={`flex items-center ${collapsed ? "px-2 pt-3" : "px-3 pt-3"}`}>
          {!collapsed ? (
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-sm font-bold leading-tight text-white">{schoolName}</p>
            </div>
          ) : (
            <p className="sr-only">{schoolName}</p>
          )}
        </div>

        <nav className="mt-2 grid flex-1 content-start gap-1.5 overflow-x-hidden overflow-y-auto px-2 pb-3">
          <SidebarSection
            product={product}
            pathname={location.pathname}
            collapsed={collapsed}
            onNavigate={onClose}
          />
        </nav>
        <div className={`${collapsed ? "px-2 py-2.5" : "px-3 py-2.5"}`}>
          <button
            type="button"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="no-print hidden h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/10 text-white transition hover:bg-white/15 hover:text-white lg:inline-flex"
            onClick={onToggleCollapsed}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <ChevronLeftRegular className={`h-4 w-4 transition ${collapsed ? "" : "rotate-180"}`} />
          </button>
        </div>
      </aside>
    </>
  );
}
