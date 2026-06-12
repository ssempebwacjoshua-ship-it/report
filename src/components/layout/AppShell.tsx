import { useEffect, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { SettingsProvider, useAppSettings } from "./SettingsContext";

const SIDEBAR_WIDTH_KEY = "school-connect-sidebar-width";
const DEFAULT_SIDEBAR_WIDTH = 248;
const MIN_SIDEBAR_WIDTH = 224;
const MAX_SIDEBAR_WIDTH = 272;
const SIDEBAR_COLLAPSED_KEY = "school-connect-sidebar-collapsed";

export function AppShell() {
  const { user, loading: authLoading } = useAuth();

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-500">Loading…</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
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
      <AppShellInner
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
  useEffect(() => {
    if (!settings) return;
    const widthBySetting = { compact: 224, standard: 248, wide: 272 };
    const hasManualWidth = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    if (!hasManualWidth) setSidebarWidth(widthBySetting[settings.sections.appearance.sidebarWidth]);
  }, [settings]);

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

  return (
    <div
      className="min-h-screen bg-slate-50 text-slate-950 lg:grid"
      style={{ gridTemplateColumns: `${sidebarCollapsed ? 72 : sidebarWidth}px minmax(0,1fr)` }}
    >
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        collapsed={sidebarCollapsed}
        onToggleCollapsed={() => setSidebarCollapsed((current) => !current)}
        width={sidebarWidth}
      />
      <div className="min-w-0">
        <Topbar onMenuClick={setSidebarOpenAndClose} sidebarCollapsed={sidebarCollapsed} />
        <div className="mx-auto w-full max-w-[1540px] px-4 py-4 md:px-8">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
