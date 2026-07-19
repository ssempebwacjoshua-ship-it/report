import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { hasPermission } from "../../shared/permissions";

type BottomNavItem = {
  label: string;
  to: string;
  match: string;
  permission?: string;
};

const gateItems: BottomNavItem[] = [
  { label: "Scan", to: "/nfc/gate#gate-scan", match: "/nfc/gate" },
  { label: "Pass-outs", to: "/nfc/gate#gate-pass-outs", match: "/nfc/gate" },
  { label: "Visitors", to: "/nfc/gate#gate-visitors", match: "/nfc/gate" },
  { label: "Recent", to: "/nfc/gate#gate-recent", match: "/nfc/gate" },
];

const canteenItems: BottomNavItem[] = [
  { label: "Charge", to: "/nfc/canteen#canteen-charge", match: "/nfc/canteen" },
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
  const items = getItemsForRole(user?.role).filter((item) => !item.permission || hasPermission(user?.role, item.permission));

  if (items.length === 0) return null;

  return (
    <nav
      aria-label="Dedicated role navigation"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200/80 bg-white/95 px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2 shadow-[0_-12px_30px_rgba(15,23,42,0.12)] backdrop-blur"
    >
      <div className="mx-auto grid max-w-xl grid-cols-4 gap-1">
        {items.map((item) => {
          const active = location.pathname === item.match || (item.match === "/nfc/gate" && location.pathname.startsWith("/gate/nfc/"));
          return (
            <Link
              key={item.label}
              to={item.to}
              className={`rounded-2xl px-2 py-2 text-center text-[11px] font-black transition ${
                active
                  ? "bg-slate-950 text-white shadow-sm"
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
