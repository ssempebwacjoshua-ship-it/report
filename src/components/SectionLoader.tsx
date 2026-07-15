type SectionLoaderProps = {
  message?: string;
};

export function SectionLoader({ message = "Loading..." }: SectionLoaderProps) {
  return (
    <div role="status" aria-live="polite" className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-slate-500">
      <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-blue-100 border-t-blue-600" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}
