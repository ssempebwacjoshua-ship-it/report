import type { StudentReportCard as Card } from "../../shared/types/reports";

type Props = {
  card: Card;
  selected: boolean;
  onOpen: () => void;
};

const contactLabels = {
  READY: "Parent contact ready",
  NO_RECIPIENT: "No report recipient",
  MISSING_PHONE_EMAIL: "Missing phone/email",
};

const contactClasses = {
  READY: "bg-emerald-100 text-emerald-700",
  NO_RECIPIENT: "bg-red-100 text-red-700",
  MISSING_PHONE_EMAIL: "bg-amber-100 text-amber-700",
};

export function StudentReportCard({ card, selected, onOpen }: Props) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`grid gap-3 rounded-2xl border p-3 text-left transition-all duration-200 ${
        selected
          ? "border-blue-300 bg-gradient-to-br from-white via-blue-50 to-emerald-50 shadow-[0_16px_34px_rgba(37,99,235,0.16)] ring-2 ring-blue-100 -translate-y-0.5"
          : "premium-card premium-card-hover"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-slate-950">{card.studentName}</p>
          <p className="mt-0.5 text-xs font-semibold text-slate-500">{card.admissionNumber}</p>
        </div>
        <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-bold text-blue-700 shrink-0">
          {card.overallPosition ? `#${card.overallPosition}` : "—"}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <span className="rounded-xl bg-slate-50 p-2">
          <b className="block text-base text-slate-950">{card.marksFound}</b>
          Marks
        </span>
        <span className="rounded-xl bg-slate-50 p-2">
          <b className="block text-base text-slate-950">{card.average ?? "—"}</b>
          Avg
        </span>
        <span className="rounded-xl bg-slate-50 p-2">
          <b className="block text-base text-slate-950">{card.grade ?? "—"}</b>
          Grade
        </span>
      </div>
      <div className="flex items-center justify-between text-xs text-slate-600">
        <span>{card.className} / {card.streamName}</span>
        <span
          className={`rounded-full px-2.5 py-1 font-bold ${
            card.readiness === "READY" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
          }`}
        >
          {card.readiness.replaceAll("_", " ")}
        </span>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className={`rounded-full px-2.5 py-1 font-bold ${contactClasses[card.contactReadiness]}`}>
          {contactLabels[card.contactReadiness]}
        </span>
        <span className="truncate text-slate-500">{card.contactSummary}</span>
      </div>
    </button>
  );
}
