import { useEffect, useState, type CSSProperties } from "react";
import type { Dispatch, SetStateAction } from "react";
import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { InstallPrompt } from "../pwa/InstallPrompt";
import { SupportWidget } from "../support/SupportWidget";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { SettingsProvider, useAppSettings } from "./SettingsContext";
import { hasPermission } from "../../shared/permissions";
import { ConnectivityProvider } from "../../hooks/useConnectivityStatus";
import { BrandedLoader } from "../BrandedLoader";
import { rememberDedicatedPwaLaunchPath } from "../../pwa/standaloneMode";
import { useDedicatedPwaNavigationGuard } from "../../pwa/useDedicatedPwaNavigationGuard";

const SIDEBAR_WIDTH_KEY = "school-connect-sidebar-width";
const DEFAULT_SIDEBAR_WIDTH = 232;
const MIN_SIDEBAR_WIDTH = 220;
const MAX_SIDEBAR_WIDTH = 240;
const SIDEBAR_COLLAPSED_KEY = "school-connect-sidebar-collapsed";

export function AppShell() {
  const { user, loading: authLoading } = useAuth();

  if (authLoading) {
    return <BrandedLoader message="Loading SSAMENJ..." />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!hasPermission(user.role, "app.admin")) {
    return <AppShellWorkspaceGate />;
  }

  return <AppShellAuthenticated />;
}

function AppShellAuthenticated() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true";
    } catch {
      return false;
    }
  });
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    try {
      const saved = Number(localStorage.getItem(SIDEBAR_WIDTH_KEY));
      return saved >= MIN_SIDEBAR_WIDTH && saved <= MAX_SIDEBAR_WIDTH
        ? saved
        : DEFAULT_SIDEBAR_WIDTH;
    } catch {
      return DEFAULT_SIDEBAR_WIDTH;
    }
  });

  function toggleSidebar() {
    const isDesktop = window.matchMedia("(min-width: 1024px)").matches;
    if (isDesktop) {
      setSidebarCollapsed((current) => {
        const next = !current;
        try {
          localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
        } catch {
          /* noop */
        }
        return next;
      });
      return;
    }
    setSidebarOpen((current) => !current);
  }

  return (
    <SettingsProvider>
      <AppShellWorkspaceGate
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        sidebarCollapsed={sidebarCollapsed}
        setSidebarCollapsed={setSidebarCollapsed}
        sidebarWidth={sidebarWidth}
        setSidebarWidth={setSidebarWidth}
        setSidebarOpenAndClose={toggleSidebar}
      />
    </SettingsProvider>
  );
}

function AppShellWorkspaceGate({
  sidebarOpen = false,
  setSidebarOpen = () => undefined,
  sidebarCollapsed = false,
  setSidebarCollapsed = () => undefined,
  sidebarWidth = DEFAULT_SIDEBAR_WIDTH,
  setSidebarWidth = () => undefined,
  setSidebarOpenAndClose = () => undefined,
}: {
  sidebarOpen?: boolean;
  setSidebarOpen?: Dispatch<SetStateAction<boolean>>;
  sidebarCollapsed?: boolean;
  setSidebarCollapsed?: Dispatch<SetStateAction<boolean>>;
  sidebarWidth?: number;
  setSidebarWidth?: Dispatch<SetStateAction<number>>;
  setSidebarOpenAndClose?: () => void;
}) {
  const settingsState = useAppSettings();

  if (settingsState?.loading) {
    return <BrandedLoader message="Loading school workspace..." />;
  }

  if (settingsState?.error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="max-w-sm rounded-2xl border border-slate-200 bg-white px-5 py-4 text-center shadow-sm">
          <p className="text-sm font-semibold text-slate-950">Could not load school workspace.</p>
          <p className="mt-1 text-sm text-slate-500">{settingsState.error}</p>
          <button
            type="button"
            onClick={() => {
              void settingsState.refreshSettings();
            }}
            className="btn btn-primary mt-4 rounded-2xl px-4 py-2 text-sm font-black"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <AppShellInner
      sidebarOpen={sidebarOpen}
      setSidebarOpen={setSidebarOpen}
      sidebarCollapsed={sidebarCollapsed}
      setSidebarCollapsed={setSidebarCollapsed}
      sidebarWidth={sidebarWidth}
      setSidebarWidth={setSidebarWidth}
      setSidebarOpenAndClose={setSidebarOpenAndClose}
    />
  );
}

function AppShellInner({
  sidebarOpen,
  setSidebarOpen,
  sidebarCollapsed,
  setSidebarCollapsed,
  sidebarWidth,
  setSidebarWidth,
  setSidebarOpenAndClose,
}: {
  sidebarOpen: boolean;
  setSidebarOpen: Dispatch<SetStateAction<boolean>>;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: Dispatch<SetStateAction<boolean>>;
  sidebarWidth: number;
  setSidebarWidth: Dispatch<SetStateAction<number>>;
  setSidebarOpenAndClose: () => void;
}) {
  const { settings } = useAppSettings() ?? {};
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [deviceId] = useState(() => {
    const key = "schoolconnect_nfc_device_id";
    try {
      const existing = localStorage.getItem(key);
      if (existing) return existing;
      const created = crypto.randomUUID();
      localStorage.setItem(key, created);
      return created;
    } catch {
      return "web-shell";
    }
  });

  useEffect(() => {
    if (!settings) return;
    const widthBySetting = { compact: 220, standard: 232, wide: 240 };
    const hasManualWidth = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    if (!hasManualWidth) setSidebarWidth(widthBySetting[settings.sections.appearance.sidebarWidth]);
  }, [settings, setSidebarWidth]);

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(sidebarCollapsed));
    } catch {
      /* noop */
    }
  }, [sidebarCollapsed]);

  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [sidebarOpen]);

  useEffect(() => {
    setSidebarOpen(false);
    document.body.style.overflow = "";
  }, [location.pathname, setSidebarOpen]);

  useEffect(() => {
    if (user?.role === "SECURITY" || user?.role === "GATE_SECURITY" || user?.role === "CANTEEN" || user?.role === "CASHIER") {
      rememberDedicatedPwaLaunchPath(location.pathname);
    }
  }, [location.pathname, user?.role]);

  useDedicatedPwaNavigationGuard(user?.role);

  useEffect(() => {
    if (!user) return;
    if (location.pathname !== "/login") return;
    navigate("/", { replace: true });
  }, [location.pathname, navigate, user]);

  return (
    <ConnectivityProvider schoolId={user?.schoolId} deviceId={deviceId}>
      <div
        className="app-shell-root min-h-screen overflow-x-hidden bg-slate-50 text-slate-950 lg:h-screen lg:overflow-hidden"
        style={{
          "--sidebar-width": `${sidebarCollapsed ? 72 : sidebarWidth}px`,
        } as CSSProperties}
      >
        <Sidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          collapsed={sidebarCollapsed}
          onToggleCollapsed={() => setSidebarCollapsed((current) => !current)}
          width={sidebarWidth}
        />
        <div className="app-shell-content flex min-w-0 flex-col lg:h-screen lg:min-h-0">
          <Topbar onMenuClick={setSidebarOpenAndClose} />
          <main className="app-page mx-auto min-h-0 w-full max-w-[1540px] flex-1 overflow-y-auto">
            <Outlet />
          </main>
        </div>
        <InstallPrompt />
        <SupportWidget />
      </div>
    </ConnectivityProvider>
  );
}
