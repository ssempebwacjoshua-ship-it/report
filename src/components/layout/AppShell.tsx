import { useState } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

export function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 lg:grid lg:grid-cols-[18rem_minmax(0,1fr)]">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="min-w-0">
        <Topbar onMenuClick={() => setSidebarOpen(true)} />
        <div className="mx-auto w-full max-w-[1540px] px-4 py-4 md:px-8">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
