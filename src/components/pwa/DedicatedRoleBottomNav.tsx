import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { hasPermission } from "../../shared/permissions";

type BottomNavItem = {
  label: string;
  to: string;
  match: string;
  hash?: string;
  permission?: string;
};

const gateItems: BottomNavItem[] = [
  { label: "Scan", to: "/nfc/gate#gate-scan", match: "/nfc/gate", hash: "#gate-scan" },
  { label: "Pass-outs", to: "/nfc/gate#gate-pass-outs", match: "/nfc/gate", hash: "#gate-pass-outs" },
  { label: "Visitors", to: "/nfc/gate#gate-visitors", match: "/nfc/gate", hash: "#gate-visitors" },
  { label: "Recent", to: "/nfc/gate#gate-recent", match: "/nfc/gate", hash: "#gate-recent" },
];

const canteenItems: BottomNavItem[] = [
  { label: "Charge", to: "/nfc/canteen#canteen-charge", match: "/nfc/canteen", hash: "#canteen-charge" },
  { label: "Wallet", to: "/nfc/wallets/top-up", match: "/nfc/wallets/top-up", permission: "nfc.wallets.topup" },
  { label: "Transactions", to: "/nfc/wallets/transactions", match: "/nfc/wallets/transactions", permission: "nfc.canteen.transactions.view" },
  { label: "Sync", to: "/nfc/canteen/reconciliation", match: "/nfc/canteen/reconciliation", permission: "nfc.canteen.reconciliation.view" },
];

function getItemsForRole(role: string | null | undefined) {
  if (role === "SECURITY" || role === "GATE_SECURITY") return gateItems;
  if (role === "CANTEEN" || role === "CASHIER") return canteenItems;
  return [];
}

export function DedicatedRoleBottomNav() {
  const { user } = useAuth();
  const location = useLocation();
  const [hash, setHash] = useState(() => (typeof window === "undefined" ? "" : window.location.hash));
  const items = getItemsForRole(user?.role).filter((item) => !item.permission || hasPermission(user?.role, item.permission));

  useEffect(() => {
    const syncHash = () => setHash(window.location.hash);
    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, [location.pathname, location.hash]);

  if (items.length === 0) return null;

  return (
    <nav
      aria-label="Dedicated role navigation"
      className="no-print fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2 shadow-[0_-4px_24px_rgba(15,23,42,0.10)]"
    >
      <div className="mx-auto grid max-w-xl grid-cols-4 gap-1">
        {items.map((item) => {
          const pathActive = location.pathname === item.match || (item.match === "/nfc/gate" && location.pathname.startsWith("/gate/nfc/"));
          const active = pathActive && (!item.hash || hash === item.hash || (!hash && item.hash.endsWith("-scan")));
          return (
            <Link
              key={item.label}
              to={item.to}
              onClick={() => {
                if (!item.hash) return;
                window.setTimeout(() => {
                  document.getElementById(item.hash.slice(1))?.scrollIntoView({ behavior: "smooth", block: "start" });
                  setHash(item.hash ?? "");
                }, 0);
              }}
              className={`rounded-xl px-2 py-2 text-center text-[11px] font-bold transition ${
                active
                  ? "bg-blue-50 text-blue-700 ring-1 ring-blue-200"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
