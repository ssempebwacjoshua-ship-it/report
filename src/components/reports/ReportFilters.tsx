import type { AssessmentFilter, ReadinessCounts, ReadinessFilter, ReportContext, ReportFilters } from "../../shared/types/reports";

type Props = {
  context: ReportContext | null;
  filters: ReportFilters;
  onChange: (filters: ReportFilters) => void;
  readinessCounts?: ReadinessCounts;
};

const selectClass =
  "premium-control h-9 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold normal-case text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white";

type FilterPill = { value: ReadinessFilter; label: string; countKey: keyof ReadinessCounts };

const FILTER_PILLS: FilterPill[] = [
  { value: "ALL",             label: "All",                  countKey: "total" },
  { value: "WITH_REPORTS",    label: "With Reports",         countKey: "withReports" },
  { value: "NO_REPORTS",      label: "No Reports",           countKey: "noReports" },
  { value: "READY_TO_ISSUE",  label: "Ready to Issue",       countKey: "readyToIssue" },
  { value: "BLOCKED_CONTACT", label: "Missing Contact",      countKey: "blockedContact" },
  { value: "ISSUED",          label: "Issued",               countKey: "issued" },
  { value: "NOT_ISSUED",      label: "Not Issued",           countKey: "notIssued" },
];

const PILL_ACTIVE: Record<ReadinessFilter, string> = {
  ALL:             "bg-slate-800 text-white border-slate-800",
  WITH_REPORTS:    "bg-blue-600 text-white border-blue-600",
  NO_REPORTS:      "bg-amber-500 text-white border-amber-500",
  READY_TO_ISSUE:  "bg-emerald-600 text-white border-emerald-600",
  BLOCKED_CONTACT: "bg-red-600 text-white border-red-600",
  ISSUED:          "bg-purple-600 text-white border-purple-600",
  NOT_ISSUED:      "bg-slate-500 text-white border-slate-500",
};

export function ReportFilters({ context, filters, onChange, readinessCounts }: Props) {
  const streams = context?.streams.filter((stream) => stream.classId === filters.classId) ?? [];
  const active = filters.readinessFilter ?? "ALL";

  return (
    <div className="reports-filters premium-card rounded-2xl px-4 py-3 space-y-3">
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

      {/* Readiness filter pills */}
      <div className="flex flex-wrap gap-2" role="group" aria-label="Report readiness filter">
        {FILTER_PILLS.map(({ value, label, countKey }) => {
          const count = readinessCounts?.[countKey];
          const isActive = active === value;
          return (
            <button
              key={value}
              type="button"
              aria-pressed={isActive}
              onClick={() => onChange({ ...filters, readinessFilter: value })}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold transition-all ${
                isActive
                  ? PILL_ACTIVE[value]
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              {label}
              {count !== undefined ? (
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-black leading-none ${isActive ? "bg-white/25 text-white" : "bg-slate-100 text-slate-600"}`}>
                  {count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
