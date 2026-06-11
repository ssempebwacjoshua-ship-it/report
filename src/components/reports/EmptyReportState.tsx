type Props = {
  reason: string | null;
};

export function EmptyReportState({ reason }: Props) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600 shadow-sm">
      <p className="font-semibold text-slate-900">No report cards to show</p>
      <p className="mt-2">{reason ?? "Select filters to load report cards."}</p>
    </div>
  );
}
