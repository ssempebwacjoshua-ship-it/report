import { Link, useLocation } from "react-router-dom";

const tabs = [
  { label: "Overview", to: "/inventory" },
  { label: "Items", to: "/inventory/items" },
  { label: "Reporting Day", to: "/inventory/reporting" },
  { label: "Reconciliation", to: "/inventory/reconciliation" },
] as const;

function isActive(pathname: string, to: string) {
  return to === "/inventory" ? pathname === to : pathname === to || pathname.startsWith(`${to}/`);
}

export function InventorySectionTabs() {
  const location = useLocation();
  return (
    <nav aria-label="Inventory section tabs" className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
      {tabs.map((tab) => {
        const active = isActive(location.pathname, tab.to);
        return (
          <Link
            key={tab.to}
            to={tab.to}
            aria-current={active ? "page" : undefined}
            className={`rounded-t-lg border-b-2 px-3 py-1.5 text-sm font-semibold transition ${
              active
                ? "border-[color:var(--sc-primary)] text-[color:var(--sc-primary)]"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
