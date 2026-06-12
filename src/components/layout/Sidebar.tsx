import { Link, useLocation } from "react-router-dom";
import { Icon } from "./Icon";
import { getSchoolDisplayName, getSchoolInitials } from "./branding";
import { useAppSettings } from "./SettingsContext";
import type { CSSProperties, MouseEvent as ReactMouseEvent } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  width: number;
  onResizeStart: (event: ReactMouseEvent) => void;
};

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: "home" as const },
  { to: "/students", label: "Students", icon: "students" as const },
  { to: "/reports", label: "Report Generation", icon: "file" as const },
  { to: "/imports/marks", label: "Marks Import", icon: "upload" as const },
  { to: "/marksheets", label: "Marksheets", icon: "clipboard" as const },
  { to: "/settings", label: "Settings", icon: "settings" as const },
];

export function Sidebar({ open, onClose, width, onResizeStart }: Props) {
  const location = useLocation();
  const { settings } = useAppSettings() ?? {};
  const school = settings?.sections.school;
  const schoolName = getSchoolDisplayName(school, "School Connect");
  const initials = getSchoolInitials(schoolName);

  function isNavActive(to: string) {
    return location.pathname === to || location.pathname.startsWith(to + "/");
  }

  return (
    <>
      <button
        type="button"
        aria-label="Close navigation"
        className={`fixed inset-0 z-30 bg-slate-950/40 transition lg:hidden ${open ? "block" : "hidden"}`}
        onClick={onClose}
      />
      <aside
        style={{ "--sidebar-width": `${width}px` } as CSSProperties}
        className={`app-shell-sidebar fixed inset-y-0 left-0 z-40 flex w-72 transform flex-col bg-gradient-to-b from-blue-950 via-blue-900 to-sky-900 p-5 text-white shadow-2xl transition lg:sticky lg:top-0 lg:h-screen lg:w-[var(--sidebar-width)] lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white/15 ring-1 ring-white/25">
            {school?.logoUrl ? (
              <img src={school.logoUrl} alt={`${schoolName} logo`} className="h-8 w-8 rounded-xl bg-white/10 object-contain" />
            ) : (
              <span className="text-sm font-black text-white">{initials}</span>
            )}
          </div>
          <div>
            <p className="text-lg font-bold leading-tight">{schoolName}</p>
            <p className="text-xs text-blue-200">{school?.schoolCode ?? "SCU-PREVIEW"}</p>
          </div>
        </div>

        <nav className="mt-6 grid gap-0.5">
          {navItems.map((item) => {
            const active = isNavActive(item.to);
            return (
              <Link
                key={item.label}
                to={item.to}
                onClick={onClose}
                className={`flex items-center gap-3 rounded-xl px-4 py-2 text-sm font-semibold transition ${
                  active
                    ? "bg-blue-500 text-white shadow-lg shadow-blue-950/25 ring-1 ring-white/20"
                    : "text-blue-100 hover:bg-white/10 hover:text-white"
                }`}
              >
                <Icon
                  name={item.icon}
                  className={`h-4 w-4 shrink-0 ${active ? "text-white" : "text-blue-300"}`}
                />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto rounded-2xl bg-blue-950/70 p-4 shadow-inner ring-1 ring-white/10">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-white text-blue-700">
              <Icon name="user" className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold">School Admin</p>
              <p className="text-xs text-blue-200">Main Administrator</p>
            </div>
          </div>
          <div className="mt-3 text-xs text-blue-200">
            <span className="font-semibold">{schoolName}</span>
            <div className="mt-1">{school?.headTeacherName || "Head Teacher"}</div>
          </div>
        </div>

        <button
          type="button"
          aria-label="Resize navigation"
          className="no-print absolute inset-y-0 -right-2 hidden w-4 cursor-col-resize items-center justify-center text-blue-200/70 transition hover:text-white lg:flex"
          onMouseDown={onResizeStart}
        >
          <span className="rounded-full bg-white/10 px-0.5 py-3 text-sm leading-none shadow-inner ring-1 ring-white/10">
            ⋮
          </span>
        </button>
      </aside>
    </>
  );
}
