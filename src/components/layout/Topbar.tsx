import { useNavigate, useLocation } from "react-router-dom";
import { NavigationRegular, PersonRegular, SignOutRegular } from "@fluentui/react-icons";
import { useAuth } from "../../contexts/AuthContext";
import { getProductFromPath, productSwitcherItems } from "./navConfig";

type Props = {
  onMenuClick: () => void;
};

export function Topbar({ onMenuClick }: Props) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const currentProduct = getProductFromPath(location.pathname);

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  function switchProduct(nextProduct: "reportLab" | "smartPages") {
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
          className="grid h-9 w-9 place-items-center rounded-lg text-white/90 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-0"
        >
          <NavigationRegular className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-1 rounded-full border border-white/20 bg-white/10 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">
          <button
            type="button"
            onClick={() => switchProduct("reportLab")}
            className={`rounded-full px-3 py-1.5 text-xs font-black transition ${
              currentProduct === "reportLab"
                ? "bg-white text-[color:var(--sc-primary-active)] shadow-sm"
                : "text-white/90 hover:bg-white/10 hover:text-white"
            }`}
          >
            Report Lab
          </button>
          <button
            type="button"
            onClick={() => switchProduct("smartPages")}
            className={`rounded-full px-3 py-1.5 text-xs font-black transition ${
              currentProduct === "smartPages"
                ? "bg-white text-[color:var(--sc-primary-active)] shadow-sm"
                : "text-white/90 hover:bg-white/10 hover:text-white"
            }`}
          >
            Smart Pages
          </button>
        </div>

      </div>

      <div className="flex items-center gap-2.5">
        <div className="flex items-center gap-2.5">
          <div className="grid h-8 w-8 place-items-center rounded-full border border-white/25 bg-white/15 text-white shadow-sm">
            <PersonRegular className="h-5 w-5" />
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-semibold leading-tight text-white">{user?.name ?? "Admin"}</p>
            <p className="text-xs leading-tight text-white/80">Administrator</p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="ml-1 grid h-8 w-8 place-items-center rounded-lg text-white/90 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-0"
          title="Sign out"
          aria-label="Sign out"
        >
          <SignOutRegular className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}
