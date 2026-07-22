import { Link, useLocation } from "react-router-dom";
import { isActiveNavPath } from "../layout/navConfig";

const REPORTS_TABS = [
  { to: "/reports", label: "Reports", exact: true },
  { to: "/imports/marks", label: "Marks Import", exact: true },
  { to: "/marksheets", label: "Marksheets", exact: true },
  { to: "/reports/release", label: "Release", exact: true },
  { to: "/promotions", label: "Promotions", exact: true },
] as const;

export function ReportsSectionTabs() {
  const { pathname } = useLocation();

  return (
    <nav aria-label="Reports section tabs" className="flex flex-wrap gap-1.5 border-b border-slate-200">
      {REPORTS_TABS.map((tab) => {
        const active = isActiveNavPath(pathname, tab.to, tab.exact);
        return (
          <Link
            key={tab.to}
            to={tab.to}
            aria-current={active ? "page" : undefined}
            className={`border-b-2 px-1.5 py-2 text-sm font-bold transition-colors ${
              active
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-900"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
