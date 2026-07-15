type SectionLoaderProps = {
  message?: string;
};

export function SectionLoader({ message = "Loading..." }: SectionLoaderProps) {
  return (
    <div className="grid min-h-64 w-full place-items-center rounded-2xl border border-slate-200 bg-white/80 px-4 py-8 text-center shadow-sm">
      <div role="status" aria-live="polite" className="grid justify-items-center gap-3">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-blue-100 border-t-blue-600" aria-hidden="true" />
        <span className="text-sm font-semibold text-slate-500">{message}</span>
      </div>
    </div>
  );
}
