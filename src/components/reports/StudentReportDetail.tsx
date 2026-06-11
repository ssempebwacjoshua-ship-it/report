import type { StudentReportCard } from "../../shared/types/reports";

type Props = {
  card: StudentReportCard | null;
};

export function StudentReportDetail({ card }: Props) {
  if (!card) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
        Select a student card to open the full report.
      </section>
    );
  }

  return (
    <section className="report-print-area min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-blue-600">Student Report Preview</p>
          <h2 className="mt-1 text-2xl font-bold text-slate-950">{card.studentName}</h2>
          <p className="text-sm text-slate-600">
            {card.admissionNumber} - {card.className} / {card.streamName} - {card.term} {card.academicYear}
          </p>
        </div>
        <button type="button" onClick={() => window.print()} className="no-print h-11 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white shadow-sm hover:bg-blue-700">
          Print
        </button>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 text-center text-sm lg:grid-cols-4">
        <div className="rounded-xl bg-blue-50 p-4">
          <b className="block text-2xl text-slate-950">{card.average ?? "-"}</b>
          Average
        </div>
        <div className="rounded-xl bg-violet-50 p-4">
          <b className="block text-2xl text-slate-950">{card.grade ?? "-"}</b>
          Grade
        </div>
        <div className="rounded-xl bg-emerald-50 p-4">
          <b className="block text-2xl text-slate-950">{card.overallPosition ?? "-"}</b>
          Position
        </div>
        <div className="rounded-xl bg-amber-50 p-4">
          <b className="block text-2xl text-slate-950">{card.missingMarks.length}</b>
          Missing
        </div>
      </div>

      <div className="mt-5 max-w-full overflow-x-auto rounded-xl border border-slate-200">
        <table className="report-table w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <th className="border-b border-slate-200 p-3">Subject</th>
              <th className="border-b border-slate-200 p-3">BOT</th>
              <th className="border-b border-slate-200 p-3">EOT</th>
              <th className="border-b border-slate-200 p-3">Total</th>
              <th className="border-b border-slate-200 p-3">Average</th>
              <th className="border-b border-slate-200 p-3">Grade</th>
              <th className="border-b border-slate-200 p-3">Subject Pos.</th>
              <th className="border-b border-slate-200 p-3">Missing</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {card.subjects.map((subject) => (
              <tr key={subject.subjectId}>
                <td className="p-3 font-semibold text-slate-950">{subject.subjectName}</td>
                <td className="p-3">{subject.botMarks ?? "-"}</td>
                <td className="p-3">{subject.eotMarks ?? "-"}</td>
                <td className="p-3">{subject.total ?? "-"}</td>
                <td className="p-3">{subject.average ?? "-"}</td>
                <td className="p-3 font-bold text-slate-950">{subject.grade ?? "-"}</td>
                <td className="p-3">{subject.subjectPosition ?? "-"}</td>
                <td className="p-3">{subject.missingMarks.join(", ") || "None"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
        <p className="font-semibold text-slate-950">Comments</p>
        <p className="mt-2 text-slate-600">Class teacher and head teacher comments can be entered here before export.</p>
      </div>
    </section>
  );
}
