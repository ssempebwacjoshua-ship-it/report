import { NavLink } from "react-router-dom";
import { Icon } from "./Icon";

type Props = {
  open: boolean;
  onClose: () => void;
};

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: "home" as const },
  { to: "/dashboard#students", label: "Students", icon: "students" as const },
  { to: "/reports", label: "Report Generation", icon: "file" as const },
  { to: "/imports/marks", label: "Marks Import", icon: "upload" as const },
  { to: "/dashboard#settings", label: "Settings", icon: "settings" as const },
];

export function Sidebar({ open, onClose }: Props) {
  return (
    <>
      <button
        type="button"
        aria-label="Close navigation"
        className={`fixed inset-0 z-30 bg-slate-950/40 transition lg:hidden ${open ? "block" : "hidden"}`}
        onClick={onClose}
      />
      <aside
        className={`app-shell-sidebar fixed inset-y-0 left-0 z-40 flex w-72 transform flex-col bg-gradient-to-b from-blue-950 via-blue-900 to-sky-900 p-5 text-white shadow-2xl transition lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/15 ring-1 ring-white/25">
            <Icon name="shield" className="h-7 w-7" />
          </div>
          <div>
            <p className="text-xl font-bold leading-tight">School Connect</p>
            <p className="text-sm text-blue-100">Reports First</p>
          </div>
        </div>

        <nav className="mt-10 grid gap-2">
          {navItems.map((item) => (
            <NavLink
              key={item.label}
              to={item.to}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition ${
                  isActive
                    ? "bg-blue-500 text-white shadow-lg shadow-blue-950/30"
                    : "text-blue-50 hover:bg-white/10 hover:text-white"
                }`
              }
            >
              <Icon name={item.icon} className="h-5 w-5" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto rounded-2xl bg-blue-950/70 p-4 shadow-inner ring-1 ring-white/10">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-full bg-white text-blue-700">
              <Icon name="user" className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold">School Admin</p>
              <p className="text-xs text-blue-100">Main Administrator</p>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between text-sm text-blue-50">
            <span>Uganda High School</span>
            <Icon name="chevron" className="h-4 w-4" />
          </div>
        </div>
      </aside>
    </>
  );
}
