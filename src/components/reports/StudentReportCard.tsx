import type { StudentReportCard as Card } from "../../shared/types/reports";

type Props = {
  card: Card;
  selected: boolean;
  onOpen: () => void;
};

export function StudentReportCard({ card, selected, onOpen }: Props) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`grid min-h-48 gap-4 rounded-2xl border p-5 text-left shadow-sm transition ${
        selected ? "border-blue-300 bg-gradient-to-br from-blue-50 to-emerald-50 ring-2 ring-blue-100" : "border-slate-200 bg-white hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-base font-bold text-slate-950">{card.studentName}</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">{card.admissionNumber}</p>
        </div>
        <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-bold text-blue-700">{card.overallPosition ? `#${card.overallPosition}` : "-"}</span>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <span className="rounded-xl bg-slate-50 p-3">
          <b className="block text-lg text-slate-950">{card.marksFound}</b>
          Marks
        </span>
        <span className="rounded-xl bg-slate-50 p-3">
          <b className="block text-lg text-slate-950">{card.average ?? "-"}</b>
          Avg
        </span>
        <span className="rounded-xl bg-slate-50 p-3">
          <b className="block text-lg text-slate-950">{card.grade ?? "-"}</b>
          Grade
        </span>
      </div>
      <div className="flex items-center justify-between text-xs text-slate-600">
        <span>
          {card.className} / {card.streamName}
        </span>
        <span className={`rounded-full px-2.5 py-1 font-bold ${card.readiness === "READY" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
          {card.readiness.replaceAll("_", " ")}
        </span>
      </div>
    </button>
  );
}
