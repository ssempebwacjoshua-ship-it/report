import { NavLink, Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { BrandedLoader } from "../BrandedLoader";
import { SupportWidget } from "../support/SupportWidget";

export function OwnerShell() {
  const { user, loading, logout } = useAuth();

  if (loading) {
    return <BrandedLoader message="Loading owner console..." />;
  }

  if (!user) return <Navigate to="/login" replace />;
  if (!user.isPlatformOwner) return <Navigate to="/dashboard" replace />;

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-none items-center justify-between gap-4 px-3 py-3 sm:px-4 lg:px-6">
          <div className="flex items-center gap-3">
            <img
              src="/ssamenj-logo.png"
              alt="SSAMENJ"
              className="h-8 w-8 rounded-lg border border-slate-200 bg-white object-contain p-0.5 shadow-sm"
            />
            <span className="text-sm font-black text-slate-900">Platform Owner Console</span>
            <span className="hidden rounded border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-700 sm:inline">Owner access</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-slate-400 sm:block">{user.name}</span>
            <button
              type="button"
              onClick={logout}
              className="text-xs font-semibold text-slate-500 hover:text-red-600 hover:underline"
            >
              Sign out
            </button>
          </div>
        </div>
        <nav className="mx-auto w-full max-w-none px-3 pb-0 sm:px-4 lg:px-6">
          <div className="flex gap-1 overflow-x-auto border-b border-transparent pb-0.5">
            <NavLink
              to="/owner"
              end
              className={({ isActive }) =>
                `border-b-2 px-3 py-2.5 text-xs font-bold transition-colors ${isActive ? "border-blue-600 text-blue-700" : "border-transparent text-slate-500 hover:text-slate-800"}`
              }
            >
              Overview
            </NavLink>
            <NavLink
              to="/owner/schools"
              className={({ isActive }) =>
                `border-b-2 px-3 py-2.5 text-xs font-bold transition-colors ${isActive ? "border-blue-600 text-blue-700" : "border-transparent text-slate-500 hover:text-slate-800"}`
              }
            >
              Schools
            </NavLink>
            <NavLink
              to="/owner/readers"
              className={({ isActive }) =>
                `border-b-2 px-3 py-2.5 text-xs font-bold transition-colors ${isActive ? "border-blue-600 text-blue-700" : "border-transparent text-slate-500 hover:text-slate-800"}`
              }
            >
              Reader Management
            </NavLink>
            <NavLink
              to="/owner/users"
              className={({ isActive }) =>
                `border-b-2 px-3 py-2.5 text-xs font-bold transition-colors ${isActive ? "border-blue-600 text-blue-700" : "border-transparent text-slate-500 hover:text-slate-800"}`
              }
            >
              Users
            </NavLink>
          </div>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-none flex-1 px-3 py-4 sm:px-4 lg:px-6 lg:py-6">
        <Outlet />
      </main>
      <SupportWidget />
    </div>
  );
}
