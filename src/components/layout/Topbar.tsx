import { Icon } from "./Icon";

type Props = {
  onMenuClick: () => void;
};

export function Topbar({ onMenuClick }: Props) {
  return (
    <header className="app-shell-topbar sticky top-0 z-20 flex h-20 items-center justify-between border-b border-slate-200 bg-white/95 px-4 shadow-sm backdrop-blur md:px-8">
      <div className="flex items-center gap-4">
        <button type="button" onClick={onMenuClick} aria-label="Open navigation" className="rounded-xl p-2 text-slate-900 hover:bg-slate-100">
          <Icon name="menu" className="h-6 w-6" />
        </button>
        <div className="hidden items-center gap-2 text-sm font-semibold text-slate-950 sm:flex">
          Uganda High School
          <Icon name="chevron" className="h-4 w-4" />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button type="button" aria-label="Notifications" className="relative rounded-xl p-2 text-slate-700 hover:bg-slate-100">
          <Icon name="bell" className="h-5 w-5" />
          <span className="absolute right-1 top-1 grid h-4 w-4 place-items-center rounded-full bg-red-500 text-[10px] font-bold text-white">3</span>
        </button>
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-blue-500 to-blue-700 text-white shadow-md">
            <Icon name="user" className="h-5 w-5" />
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-semibold text-slate-950">School Admin</p>
            <p className="text-xs text-slate-500">Administrator</p>
          </div>
          <Icon name="chevron" className="hidden h-4 w-4 text-slate-700 sm:block" />
        </div>
      </div>
    </header>
  );
}
