import { Link, useLocation } from "react-router-dom";
import { isActiveNavPath } from "../layout/navConfig";

export type NfcSectionTab = {
  to: string;
  label: string;
  exact?: boolean;
};

export function NfcSectionTabs({ tabs }: { tabs: NfcSectionTab[] }) {
  const { pathname } = useLocation();

  return (
    <nav aria-label="NFC section tabs" className="flex flex-wrap gap-1.5 border-b border-slate-200">
      {tabs.map((tab) => {
        const active = isActiveNavPath(pathname, tab.to, tab.exact ?? true);
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
