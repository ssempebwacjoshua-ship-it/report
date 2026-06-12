import { useEffect, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { fetchSettings } from "../../client/settingsClient";

const SIDEBAR_WIDTH_KEY = "school-connect-sidebar-width";
const DEFAULT_SIDEBAR_WIDTH = 280;
const MIN_SIDEBAR_WIDTH = 220;
const MAX_SIDEBAR_WIDTH = 340;

export function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
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

  useEffect(() => {
    fetchSettings()
      .then((settings) => {
        document.documentElement.dataset.appDensity = settings.sections.appearance.appDensity;
        document.documentElement.dataset.appFontSize = settings.sections.appearance.fontSize;
        const widthBySetting = { compact: 240, standard: 280, wide: 320 };
        const hasManualWidth = localStorage.getItem(SIDEBAR_WIDTH_KEY);
        if (!hasManualWidth) setSidebarWidth(widthBySetting[settings.sections.appearance.sidebarWidth]);
      })
      .catch(() => {});
  }, []);

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

  return (
    <div
      className="min-h-screen bg-slate-50 text-slate-950 lg:grid"
      style={{ gridTemplateColumns: `${sidebarWidth}px minmax(0,1fr)` }}
    >
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        width={sidebarWidth}
        onResizeStart={startSidebarResize}
      />
      <div className="min-w-0">
        <Topbar onMenuClick={() => setSidebarOpen(true)} />
        <div className="mx-auto w-full max-w-[1540px] px-4 py-4 md:px-8">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
