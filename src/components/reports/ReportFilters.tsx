import type { AssessmentFilter, ReportContext, ReportFilters } from "../../shared/types/reports";

type Props = {
  context: ReportContext | null;
  filters: ReportFilters;
  onChange: (filters: ReportFilters) => void;
};

const selectClass =
  "premium-control h-9 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold normal-case text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white";

export function ReportFilters({ context, filters, onChange }: Props) {
  const streams = context?.streams.filter((stream) => stream.classId === filters.classId) ?? [];

  return (
    <div className="reports-filters premium-card rounded-2xl px-4 py-3">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
        <label className="grid gap-1 text-xs font-semibold uppercase text-slate-500">
          Class
          <select
            className={selectClass}
            value={filters.classId}
            onChange={(e) => onChange({ ...filters, classId: e.target.value, streamId: "" })}
          >
            <option value="">Select class</option>
            {context?.classes.map((klass) => (
              <option key={klass.id} value={klass.id}>{klass.name}</option>
            ))}
          </select>
        </label>

        <label className="grid gap-1 text-xs font-semibold uppercase text-slate-500">
          Stream
          <select
            className={selectClass}
            value={filters.streamId ?? ""}
            onChange={(e) => onChange({ ...filters, streamId: e.target.value })}
          >
            <option value="">All streams</option>
            {streams.map((stream) => (
              <option key={stream.id} value={stream.id}>{stream.name}</option>
            ))}
          </select>
        </label>

        <label className="grid gap-1 text-xs font-semibold uppercase text-slate-500">
          Academic Year
          <select
            className={selectClass}
            value={filters.academicYearId ?? ""}
            onChange={(e) => onChange({ ...filters, academicYearId: e.target.value })}
          >
            {context?.academicYears.map((year) => (
              <option key={year.id} value={year.id}>{year.name}</option>
            ))}
          </select>
        </label>

        <label className="grid gap-1 text-xs font-semibold uppercase text-slate-500">
          Term
          <select
            className={selectClass}
            value={filters.termId ?? ""}
            onChange={(e) => onChange({ ...filters, termId: e.target.value })}
          >
            {context?.terms.map((term) => (
              <option key={term.id} value={term.id}>{term.name}</option>
            ))}
          </select>
        </label>

        <label className="grid gap-1 text-xs font-semibold uppercase text-slate-500">
          Exam Type
          <select
            className={selectClass}
            value={filters.assessmentType}
            onChange={(e) => onChange({ ...filters, assessmentType: e.target.value as AssessmentFilter })}
          >
            <option value="TERM_SUMMARY">Term Summary</option>
            <option value="BOT">BOT</option>
            <option value="MOT">MOT / Mid Term</option>
            <option value="EOT">EOT</option>
          </select>
        </label>

        <label className="grid gap-1 text-xs font-semibold uppercase text-slate-500">
          Student Search
          <input
            className={selectClass}
            value={filters.search ?? ""}
            onChange={(e) => onChange({ ...filters, search: e.target.value })}
            placeholder="Name or admission"
          />
        </label>
      </div>
    </div>
  );
}

