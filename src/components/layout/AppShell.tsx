import { useEffect, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { SettingsProvider, useAppSettings } from "./SettingsContext";

const SIDEBAR_WIDTH_KEY = "school-connect-sidebar-width";
const DEFAULT_SIDEBAR_WIDTH = 248;
const MIN_SIDEBAR_WIDTH = 224;
const MAX_SIDEBAR_WIDTH = 272;
const SIDEBAR_COLLAPSED_KEY = "school-connect-sidebar-collapsed";

export function AppShell() {
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

  function startSidebarResize(event: ReactMouseEvent) {
    const startX = event.clientX;
    const startWidth = sidebarWidth;
    let currentWidth = sidebarWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const nextWidth = Math.min(
        MAX_SIDEBAR_WIDTH,
        Math.max(MIN_SIDEBAR_WIDTH, startWidth + moveEvent.clientX - startX),
      );
      currentWidth = nextWidth;
      setSidebarWidth(nextWidth);
    };

    const onMouseUp = () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      try {
        localStorage.setItem(SIDEBAR_WIDTH_KEY, String(currentWidth));
      } catch {
        /* noop */
      }
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    event.preventDefault();
  }

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
        startSidebarResize={startSidebarResize}
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
  startSidebarResize,
}: {
  sidebarOpen: boolean;
  setSidebarOpen: Dispatch<SetStateAction<boolean>>;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: Dispatch<SetStateAction<boolean>>;
  sidebarWidth: number;
  setSidebarWidth: Dispatch<SetStateAction<number>>;
  setSidebarOpenAndClose: () => void;
  startSidebarResize: (event: ReactMouseEvent) => void;
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
        onResizeStart={startSidebarResize}
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
