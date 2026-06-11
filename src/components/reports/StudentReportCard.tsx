import type { StudentReportCard as Card } from "../../shared/types/reports";

type Props = {
  card: Card;
  selected: boolean;
  showPositions: boolean;
  onOpen: () => void;
};

const contactLabels = {
  READY: "Contact ready",
  NO_RECIPIENT: "No report recipient",
  MISSING_PHONE_EMAIL: "Missing phone/email",
};

const contactClasses = {
  READY: "text-emerald-700 hover:text-emerald-800",
  NO_RECIPIENT: "text-red-700 hover:text-red-800",
  MISSING_PHONE_EMAIL: "text-amber-700 hover:text-amber-800",
};

export function StudentReportCard({ card, selected, showPositions, onOpen }: Props) {
  const primaryLabel =
    showPositions && card.overallPosition != null
      ? `#${card.overallPosition} ${card.studentName}`
      : card.studentName;

  return (
    <div
      className={`group rounded-2xl border transition-all duration-200 ${
        selected
          ? "border-blue-300 bg-gradient-to-br from-white via-blue-50 to-emerald-50 shadow-[0_14px_30px_rgba(37,99,235,0.16)] ring-2 ring-blue-100"
          : "border-slate-200 bg-white shadow-sm hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50/50 hover:shadow-md"
      }`}
    >
      <button
        type="button"
        onClick={onOpen}
        className="grid w-full grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 px-3 pb-1 pt-3 text-left"
      >
        <p className="truncate text-sm font-black text-slate-950">{primaryLabel}</p>
        <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-black text-blue-700">
          {card.grade ?? "-"}
        </span>
      </button>
      <div className="flex items-center justify-between gap-3 px-3 pb-3 text-xs font-semibold text-slate-500">
        <button type="button" onClick={onOpen} className="truncate text-left">
          {card.admissionNumber}
        </button>
        <a
          href={`/students?studentId=${encodeURIComponent(card.studentId)}`}
          className={`shrink-0 font-black underline-offset-2 hover:underline ${contactClasses[card.contactReadiness]}`}
        >
          {contactLabels[card.contactReadiness]}
        </a>
      </div>
    </div>
  );
}
