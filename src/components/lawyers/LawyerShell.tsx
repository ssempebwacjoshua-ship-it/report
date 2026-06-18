import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { DocumentRegular, HomeRegular, NavigationRegular, PersonRegular, SettingsRegular, SignOutRegular } from "@fluentui/react-icons";
import { useAuth } from "../../contexts/AuthContext";

const navItems = [
  { to: "/lawyers/dashboard", label: "Dashboard", icon: HomeRegular, exact: true },
  { to: "/lawyers/documents", label: "Documents", icon: DocumentRegular, exact: true },
  { to: "/lawyers/onboarding", label: "Onboarding", icon: PersonRegular, exact: true },
  { to: "/lawyers/settings", label: "Settings", icon: SettingsRegular, exact: true },
] as const;

export function LawyerShell() {
  const { user, loading: authLoading, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-500">Loading...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <header className="sticky top-0 z-30 border-b border-[color:var(--sc-primary)]/15 bg-[color:var(--sc-primary)] text-white shadow-sm">
        <div className="mx-auto flex h-12 max-w-7xl items-center justify-between gap-3 px-3 sm:px-4">
          <button
            type="button"
            onClick={() => void navigate("/lawyers/dashboard")}
            className="flex min-w-0 items-center gap-3 text-left"
          >
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-white text-[color:var(--sc-primary)] shadow-sm">
              <DocumentRegular className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-black leading-tight">Smart Pages for Lawyers</p>
              <p className="truncate text-[11px] font-semibold leading-tight text-white">Built for Ugandan legal practice</p>
            </div>
          </button>

          <div className="hidden items-center gap-1 rounded-full border border-white/20 bg-white/10 p-1 md:flex">
            {navItems.map((item) => {
              const active = item.exact ? location.pathname === item.to : location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);
              return (
                <button
                  key={item.to}
                  type="button"
                  onClick={() => void navigate(item.to)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-black transition ${
                    active ? "bg-white text-[color:var(--sc-primary)] shadow-sm" : "text-white hover:bg-white/10"
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-2 sm:flex">
              <div className="grid h-8 w-8 place-items-center rounded-full border border-white/20 bg-white/10 text-white">
                <PersonRegular className="h-5 w-5" />
              </div>
              <div className="hidden min-w-0 sm:block">
                <p className="truncate text-sm font-semibold leading-tight text-white">{user.name ?? "Lawyer"}</p>
                <p className="truncate text-xs leading-tight text-white">Legal workspace</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setMenuOpen((current) => !current)}
              className="grid h-9 w-9 place-items-center rounded-lg text-white hover:bg-white/10 md:hidden"
              aria-label="Open lawyer navigation"
            >
              <NavigationRegular className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="grid h-9 w-9 place-items-center rounded-lg text-white hover:bg-white/10"
              aria-label="Sign out"
              title="Sign out"
            >
              <SignOutRegular className="h-5 w-5" />
            </button>
          </div>
        </div>

        {menuOpen ? (
          <div className="border-t border-white/15 bg-[color:var(--sc-primary-active)] md:hidden">
            <div className="mx-auto grid max-w-7xl gap-1 px-3 py-2">
              {navItems.map((item) => {
                const active = item.exact ? location.pathname === item.to : location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);
                return (
                  <button
                    key={item.to}
                    type="button"
                    onClick={() => void navigate(item.to)}
                    className={`flex items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold ${
                      active ? "bg-white text-[color:var(--sc-primary)]" : "text-white"
                    }`}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </header>

      <main className="mx-auto w-full max-w-7xl px-3 py-4 sm:px-4 lg:px-6">
        <Outlet />
      </main>
    </div>
  );
}
