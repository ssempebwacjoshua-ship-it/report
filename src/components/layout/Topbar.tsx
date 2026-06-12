import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { Icon } from "./Icon";
import { getSchoolDisplayName } from "./branding";
import { useAppSettings } from "./SettingsContext";

type Props = {
  onMenuClick: () => void;
  sidebarCollapsed: boolean;
};

export function Topbar({ onMenuClick, sidebarCollapsed }: Props) {
  const { settings } = useAppSettings() ?? {};
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const schoolName = getSchoolDisplayName(settings?.sections.school, "School Connect");

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <header className="app-shell-topbar sticky top-0 z-20 flex h-14 items-center justify-between border-b border-blue-900/60 bg-blue-950 px-4 md:px-8">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Open navigation"
          className="grid h-9 w-9 place-items-center rounded-xl text-blue-200 transition hover:bg-white/10"
        >
          <Icon name="menu" className="h-5 w-5" />
        </button>
        <div className="hidden min-w-0 items-center gap-2 text-sm font-semibold text-blue-100 sm:flex">
          <span className="truncate">{sidebarCollapsed ? "School Connect" : schoolName}</span>
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        <div className="flex items-center gap-2.5">
          <div className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-blue-400 to-blue-600 text-white shadow">
            <Icon name="user" className="h-4 w-4" />
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-semibold leading-tight text-white">{user?.name ?? "Admin"}</p>
            <p className="text-xs leading-tight text-blue-300">Administrator</p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="ml-1 grid h-8 w-8 place-items-center rounded-xl text-blue-300 transition hover:bg-white/10 hover:text-white"
          title="Sign out"
          aria-label="Sign out"
        >
          <Icon name="log-out" className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
