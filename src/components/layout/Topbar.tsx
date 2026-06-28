import { useNavigate, useLocation } from "react-router-dom";
import { NavigationRegular, PersonRegular, SignOutRegular, WifiOffRegular, ArrowSyncRegular, WarningRegular } from "@fluentui/react-icons";
import { useAuth } from "../../contexts/AuthContext";
import { ROLE_LABELS } from "../../shared/permissions";
import { getProductFromPath, getVisibleProductSwitcherProducts, productSwitcherItems } from "./navConfig";
import { useConnectivityStatus, type ConnectivityState } from "../../hooks/useConnectivityStatus";

type Props = {
  onMenuClick: () => void;
};

function ConnectivityBadge({ state, pendingCount }: { state: ConnectivityState; pendingCount: number }) {
  if (state === "ONLINE") return null;

  const configs: Record<ConnectivityState, { label: string; className: string; icon: React.ReactNode } | null> = {
    ONLINE: null,
    DEGRADED: {
      label: "Connection unstable",
      className: "bg-amber-500/20 border-amber-400/40 text-amber-200",
      icon: <WarningRegular className="h-3.5 w-3.5 shrink-0" />,
    },
    OFFLINE_READY: {
      label: pendingCount > 0 ? `Offline Mode Active · ${pendingCount} pending` : "Offline Mode Active",
      className: "bg-orange-500/20 border-orange-400/40 text-orange-200",
      icon: <WifiOffRegular className="h-3.5 w-3.5 shrink-0" />,
    },
    OFFLINE_NOT_READY: {
      label: "Offline – No snapshot",
      className: "bg-red-500/20 border-red-400/40 text-red-200",
      icon: <WifiOffRegular className="h-3.5 w-3.5 shrink-0" />,
    },
    SYNCING: {
      label: pendingCount > 0 ? `Syncing ${pendingCount} pending actions…` : "Syncing…",
      className: "bg-blue-500/20 border-blue-400/40 text-blue-200",
      icon: <ArrowSyncRegular className="h-3.5 w-3.5 shrink-0 animate-spin" />,
    },
    SYNC_FAILED: {
      label: "Sync failed",
      className: "bg-red-500/20 border-red-400/40 text-red-200",
      icon: <WarningRegular className="h-3.5 w-3.5 shrink-0" />,
    },
  };

  const cfg = configs[state];
  if (!cfg) return null;

  return (
    <div className={`hidden sm:flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${cfg.className}`}>
      {cfg.icon}
      <span>{cfg.label}</span>
    </div>
  );
}

export function Topbar({ onMenuClick }: Props) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const currentProduct = getProductFromPath(location.pathname);
  const visibleProducts = getVisibleProductSwitcherProducts(user?.role, location.pathname);

  const { state: connState, pendingCount } = useConnectivityStatus(
    user?.schoolId,
    typeof window !== "undefined" ? (localStorage.getItem("schoolconnect_nfc_device_id") ?? undefined) : undefined,
  );

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  function switchProduct(nextProduct: "reportLab" | "smartPages" | "nfc") {
    navigate(productSwitcherItems[nextProduct].to);
  }

  return (
    <header
      className="app-shell-topbar sticky top-0 z-20 flex items-center justify-between border-b border-white/15 px-3 shadow-[0_1px_0_rgba(255,255,255,0.08)] md:px-4"
      style={{ backgroundColor: "var(--sc-primary)" }}
    >
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Open navigation"
          className="grid h-9 w-9 place-items-center rounded-lg text-white transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-0"
        >
          <NavigationRegular className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-1 rounded-full border border-white/20 bg-white/10 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">
          {visibleProducts.map((product) => (
            <button
              key={product}
              type="button"
              onClick={() => switchProduct(product)}
              className={`rounded-full px-3 py-1.5 text-xs font-black transition ${
                currentProduct === product
                  ? "bg-white text-[color:var(--sc-primary)] shadow-sm"
                  : "text-white hover:bg-white/10 hover:text-white"
              }`}
            >
              {productSwitcherItems[product].label}
            </button>
          ))}
        </div>

        <ConnectivityBadge state={connState} pendingCount={pendingCount} />
      </div>

      <div className="flex items-center gap-2.5">
        <div className="flex items-center gap-2.5">
          <div className="grid h-8 w-8 place-items-center rounded-full border border-white/25 bg-white/15 text-white shadow-sm">
            <PersonRegular className="h-5 w-5" />
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-semibold leading-tight text-white">{user?.name ?? "Admin"}</p>
            <p className="text-xs leading-tight text-white">{user?.role ? (ROLE_LABELS[user.role] ?? user.role) : "User"}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="ml-1 grid h-8 w-8 place-items-center rounded-lg text-white transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-0"
          title="Sign out"
          aria-label="Sign out"
        >
          <SignOutRegular className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}
