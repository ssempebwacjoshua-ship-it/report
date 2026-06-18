import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { Icon } from "./Icon";
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
    <header className="app-shell-topbar sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur-xl md:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Open navigation"
          className="grid h-9 w-9 place-items-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-950"
        >
          <Icon name="menu" className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => switchProduct("reportLab")}
            className={`rounded-full px-3 py-1.5 text-xs font-black transition ${
              currentProduct === "reportLab"
                ? "bg-white text-blue-700 shadow-sm"
                : "text-slate-600 hover:text-slate-950"
            }`}
          >
            Report Lab
          </button>
          <button
            type="button"
            onClick={() => switchProduct("smartPages")}
            className={`rounded-full px-3 py-1.5 text-xs font-black transition ${
              currentProduct === "smartPages"
                ? "bg-white text-blue-700 shadow-sm"
                : "text-slate-600 hover:text-slate-950"
            }`}
          >
            Smart Pages
          </button>
        </div>

      </div>

      <div className="flex items-center gap-2.5">
        <div className="flex items-center gap-2.5">
          <div className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-blue-500 to-blue-700 text-white shadow-sm">
            <Icon name="user" className="h-4 w-4" />
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-semibold leading-tight text-slate-950">{user?.name ?? "Admin"}</p>
            <p className="text-xs leading-tight text-slate-500">Administrator</p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="ml-1 grid h-8 w-8 place-items-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-950"
          title="Sign out"
          aria-label="Sign out"
        >
          <Icon name="log-out" className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
