import type { StudentReportCard as Card } from "../../shared/types/reports";

type Props = {
  card: Card;
  selected: boolean;
  showPositions: boolean;
  onOpen: () => void;
};

function readinessDot(readiness: Card["readiness"]) {
  if (readiness === "READY") return "bg-emerald-500";
  if (readiness === "MISSING_MARKS" || readiness === "NO_FINALIZED_MARKS") return "bg-amber-500";
  return "bg-slate-400";
}

export function StudentReportCard({ card, selected, showPositions, onOpen }: Props) {
  const primaryLabel =
    showPositions && card.overallPosition != null
      ? `#${card.overallPosition} ${card.studentName}`
      : card.studentName;

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`group grid w-full grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 rounded-2xl border px-3 py-3 text-left transition-all duration-200 ${
        selected
          ? "border-blue-300 bg-gradient-to-br from-white via-blue-50 to-emerald-50 shadow-[0_14px_30px_rgba(37,99,235,0.16)] ring-2 ring-blue-100"
          : "border-slate-200 bg-white shadow-sm hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50/50 hover:shadow-md"
      }`}
    >
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <span className={`h-2 w-2 shrink-0 rounded-full ${readinessDot(card.readiness)}`} />
          <p className="truncate text-sm font-black text-slate-950">{primaryLabel}</p>
        </div>
        <p className="mt-1 truncate pl-4 text-xs font-semibold text-slate-500">{card.admissionNumber}</p>
      </div>
      <div className="text-right">
        <span className="inline-flex rounded-full bg-blue-100 px-2.5 py-1 text-xs font-black text-blue-700">
          {card.grade ?? "-"}
        </span>
        <p className="mt-1 text-xs font-bold text-slate-500">Avg {card.average ?? "-"}</p>
      </div>
    </button>
  );
}
