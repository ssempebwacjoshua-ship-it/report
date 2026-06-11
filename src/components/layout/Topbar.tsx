import { Icon } from "./Icon";

type Props = {
  onMenuClick: () => void;
};

export function Topbar({ onMenuClick }: Props) {
  return (
    <header className="app-shell-topbar sticky top-0 z-20 flex h-14 items-center justify-between border-b border-blue-900/60 bg-blue-950 px-4 md:px-8">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Open navigation"
          className="rounded-xl p-2 text-blue-200 transition hover:bg-white/10"
        >
          <Icon name="menu" className="h-5 w-5" />
        </button>
        <div className="hidden items-center gap-2 text-sm font-semibold text-blue-100 sm:flex">
          Uganda High School
          <Icon name="chevron" className="h-4 w-4 text-blue-400" />
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        <button
          type="button"
          aria-label="Notifications"
          className="relative rounded-xl p-2 text-blue-200 transition hover:bg-white/10"
        >
          <Icon name="bell" className="h-5 w-5" />
          <span className="absolute right-1.5 top-1.5 grid h-3.5 w-3.5 place-items-center rounded-full bg-red-500 text-[9px] font-bold text-white">
            3
          </span>
        </button>

        <div className="flex items-center gap-2.5">
          <div className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-blue-400 to-blue-600 text-white shadow">
            <Icon name="user" className="h-4 w-4" />
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-semibold leading-tight text-white">School Admin</p>
            <p className="text-xs leading-tight text-blue-300">Administrator</p>
          </div>
          <Icon name="chevron" className="hidden h-4 w-4 text-blue-400 sm:block" />
        </div>
      </div>
    </header>
  );
}
