import type { AssessmentFilter, ReportContext, ReportFilters } from "../../shared/types/reports";

type Props = {
  context: ReportContext | null;
  filters: ReportFilters;
  onChange: (filters: ReportFilters) => void;
};

export function ReportFilters({ context, filters, onChange }: Props) {
  const streams = context?.streams.filter((stream) => stream.classId === filters.classId) ?? [];

  return (
    <div className="reports-filters rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-slate-950">Report filters</h2>
          <p className="text-sm text-slate-500">Choose the academic scope before opening cards.</p>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
      <label className="grid gap-1 text-xs font-semibold uppercase text-slate-500">
        Class
        <select
          className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold normal-case text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
          value={filters.classId}
          onChange={(event) => onChange({ ...filters, classId: event.target.value, streamId: "" })}
        >
          <option value="">Select class</option>
          {context?.classes.map((klass) => (
            <option key={klass.id} value={klass.id}>
              {klass.name}
            </option>
          ))}
        </select>
      </label>

      <label className="grid gap-1 text-xs font-semibold uppercase text-slate-500">
        Stream
        <select
          className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold normal-case text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
          value={filters.streamId ?? ""}
          onChange={(event) => onChange({ ...filters, streamId: event.target.value })}
        >
          <option value="">All streams</option>
          {streams.map((stream) => (
            <option key={stream.id} value={stream.id}>
              {stream.name}
            </option>
          ))}
        </select>
      </label>

      <label className="grid gap-1 text-xs font-semibold uppercase text-slate-500">
        Academic Year
        <select
          className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold normal-case text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
          value={filters.academicYearId ?? ""}
          onChange={(event) => onChange({ ...filters, academicYearId: event.target.value })}
        >
          {context?.academicYears.map((year) => (
            <option key={year.id} value={year.id}>
              {year.name}
            </option>
          ))}
        </select>
      </label>

      <label className="grid gap-1 text-xs font-semibold uppercase text-slate-500">
        Term
        <select
          className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold normal-case text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
          value={filters.termId ?? ""}
          onChange={(event) => onChange({ ...filters, termId: event.target.value })}
        >
          {context?.terms.map((term) => (
            <option key={term.id} value={term.id}>
              {term.name}
            </option>
          ))}
        </select>
      </label>

      <label className="grid gap-1 text-xs font-semibold uppercase text-slate-500">
        Exam Type
        <select
          className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold normal-case text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
          value={filters.assessmentType}
          onChange={(event) => onChange({ ...filters, assessmentType: event.target.value as AssessmentFilter })}
        >
          <option value="ALL">BOT + EOT</option>
          <option value="BOT">BOT</option>
          <option value="EOT">EOT</option>
        </select>
      </label>

      <label className="grid gap-1 text-xs font-semibold uppercase text-slate-500">
        Student Search
        <input
          className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold normal-case text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
          value={filters.search ?? ""}
          onChange={(event) => onChange({ ...filters, search: event.target.value })}
          placeholder="Name or admission"
        />
      </label>
      </div>
    </div>
  );
}
