import { NavLink, Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

export function OwnerShell() {
  const { user, loading, logout } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-500">Loading?</p>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (!user.isPlatformOwner) return <Navigate to="/dashboard" replace />;

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      {/* Top banner */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white">
              <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5z" />
                <path d="M9 12l2 2 4-5" />
              </svg>
            </span>
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
        <nav className="mx-auto max-w-6xl px-4 pb-0">
          <div className="flex gap-0.5 border-b border-transparent">
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

      {/* Page content */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}

