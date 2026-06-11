import { GRADE_BANDS } from "../../shared/constants/grades";
import type { StudentReportCard } from "../../shared/types/reports";

type Props = {
  card: StudentReportCard | null;
};

function ShieldIcon() {
  return (
    <svg
      viewBox="0 0 80 96"
      className="h-16 w-14 flex-shrink-0 print:h-9 print:w-8"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M40 4L8 16v28c0 22 14.4 42.4 32 48C57.6 86.4 72 66 72 44V16L40 4z"
        fill="rgba(255,255,255,0.12)"
        stroke="rgba(255,255,255,0.5)"
        strokeWidth="2"
      />
      <text
        x="40"
        y="58"
        textAnchor="middle"
        fontSize="18"
        fontWeight="bold"
        fill="white"
        fontFamily="Georgia, serif"
      >
        UHS
      </text>
    </svg>
  );
}

const GRADE_COLORS: Record<string, string> = {
  D1: "bg-emerald-100 text-emerald-800",
  D2: "bg-emerald-50 text-emerald-700",
  C3: "bg-blue-100 text-blue-800",
  C4: "bg-blue-50 text-blue-700",
  C5: "bg-sky-50 text-sky-700",
  C6: "bg-yellow-50 text-yellow-700",
  P7: "bg-orange-50 text-orange-700",
  P8: "bg-red-50 text-red-700",
  F9: "bg-red-100 text-red-800",
};

function GradeBadge({ grade }: { grade: string | null }) {
  if (!grade) return <span className="text-slate-400">—</span>;
  const color = GRADE_COLORS[grade] ?? "bg-slate-100 text-slate-700";
  return (
    <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-bold ${color}`}>
      {grade}
    </span>
  );
}

export function StudentReportDetail({ card }: Props) {
  if (!card) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
        Select a student card to open the full report.
      </section>
    );
  }

  const today = new Date().toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  return (
    <section className="report-print-area min-w-0">
      {/* Print button — hidden on print */}
      <div className="no-print mb-4 flex justify-end">
        <button
          type="button"
          onClick={() => window.print()}
          className="h-11 rounded-xl bg-blue-600 px-6 text-sm font-bold text-white shadow-sm hover:bg-blue-700 active:bg-blue-800"
        >
          Print / Save PDF
        </button>
      </div>

      {/* Paper sheet */}
      <div className="report-card-sheet mx-auto max-w-4xl overflow-hidden rounded-2xl bg-white shadow-[0_4px_24px_rgba(0,0,0,0.12)] ring-1 ring-slate-200">

        {/* 1. Official header */}
        <div className="report-header-bg bg-[#0f2a5e] px-8 py-6 text-white print:px-5 print:py-2">
          <div className="flex items-center gap-5 print:gap-3">
            <ShieldIcon />
            <div className="flex-1 text-center">
              <h1 className="text-2xl font-bold tracking-wide print:text-base">
                Uganda High School
              </h1>
              <p className="mt-0.5 text-sm font-medium uppercase tracking-widest text-blue-200 print:text-[8px]">
                Student Academic Report
              </p>
            </div>
            <div className="w-24 flex-shrink-0 text-right text-xs leading-relaxed text-blue-200 print:text-[8px] print:leading-tight">
              <div className="font-semibold text-white">{card.academicYear}</div>
              <div>{card.term}</div>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-3 gap-2 border-t border-blue-800 pt-4 text-center text-xs text-blue-100 print:mt-2 print:pt-2 print:text-[8px]">
            <div>
              <span className="font-semibold text-white">Class:</span> {card.className}
            </div>
            <div>
              <span className="font-semibold text-white">Stream:</span> {card.streamName}
            </div>
            <div>
              <span className="font-semibold text-white">Report Date:</span> {today}
            </div>
          </div>
        </div>

        {/* Gold accent line */}
        <div className="report-gold-line h-1 bg-[#c9a227]" />

        {/* Content */}
        <div className="px-8 py-6 print:px-5 print:py-3">

          {/* 2. Student identity */}
          <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 p-4 print:mb-2 print:p-2">
            <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-400 print:mb-1 print:text-[8px]">
              Student Information
            </h2>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm md:grid-cols-3 print:gap-y-0.5 print:text-[9px]">
              <div>
                <span className="font-semibold text-slate-600">Full Name: </span>
                <span className="font-medium text-slate-900">{card.studentName}</span>
              </div>
              <div>
                <span className="font-semibold text-slate-600">Adm. No.: </span>
                <span className="font-mono font-medium text-slate-900">{card.admissionNumber}</span>
              </div>
              <div>
                <span className="font-semibold text-slate-600">Class: </span>
                <span className="text-slate-900">{card.className}</span>
              </div>
              <div>
                <span className="font-semibold text-slate-600">Stream: </span>
                <span className="text-slate-900">{card.streamName}</span>
              </div>
              <div>
                <span className="font-semibold text-slate-600">Term: </span>
                <span className="text-slate-900">{card.term}</span>
              </div>
              <div>
                <span className="font-semibold text-slate-600">Academic Year: </span>
                <span className="text-slate-900">{card.academicYear}</span>
              </div>
              <div>
                <span className="font-semibold text-slate-600">Assessment: </span>
                <span className="text-slate-900">BOT + EOT</span>
              </div>
              <div>
                <span className="font-semibold text-slate-600">Status: </span>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${
                    card.readiness === "READY"
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-amber-100 text-amber-700"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      card.readiness === "READY" ? "bg-emerald-500" : "bg-amber-500"
                    }`}
                  />
                  {card.readiness === "READY" ? "Ready" : card.readiness.replace(/_/g, " ")}
                </span>
              </div>
            </div>
          </div>

          {/* 3. Academic summary */}
          <div className="report-summary-cards mb-6 grid grid-cols-2 gap-3 text-center lg:grid-cols-4 print:mb-2 print:gap-1.5">
            <div className="report-summary-card rounded-xl bg-blue-600 p-4 text-white print:p-2">
              <b className="block text-3xl font-bold tabular-nums print:text-lg">
                {card.average ?? "—"}
              </b>
              <span className="mt-1 block text-xs font-semibold uppercase tracking-wider text-blue-100 print:mt-0.5 print:text-[8px]">
                Average
              </span>
            </div>
            <div className="report-summary-card rounded-xl bg-[#4c1d95] p-4 text-white print:p-2">
              <b className="block text-3xl font-bold print:text-lg">{card.grade ?? "—"}</b>
              <span className="mt-1 block text-xs font-semibold uppercase tracking-wider text-purple-200 print:mt-0.5 print:text-[8px]">
                Grade
              </span>
            </div>
            <div className="report-summary-card rounded-xl bg-emerald-600 p-4 text-white print:p-2">
              <b className="block text-3xl font-bold tabular-nums print:text-lg">
                {card.overallPosition != null ? `#${card.overallPosition}` : "—"}
              </b>
              <span className="mt-1 block text-xs font-semibold uppercase tracking-wider text-emerald-100 print:mt-0.5 print:text-[8px]">
                Position
              </span>
            </div>
            <div className="report-summary-card rounded-xl bg-amber-500 p-4 text-white print:p-2">
              <b className="block text-3xl font-bold tabular-nums print:text-lg">
                {card.missingMarks.length}
              </b>
              <span className="mt-1 block text-xs font-semibold uppercase tracking-wider text-amber-100 print:mt-0.5 print:text-[8px]">
                Missing
              </span>
            </div>
          </div>

          {/* 4. Subject marks table */}
          <div className="mb-6 overflow-x-auto rounded-xl border border-slate-200 print:mb-2 print:overflow-visible">
            <table className="report-table w-full min-w-[680px] border-collapse text-sm">
              <thead>
                <tr className="report-table-header bg-[#0f2a5e] text-left text-xs font-semibold uppercase tracking-wide text-white">
                  <th className="p-3 text-center">#</th>
                  <th className="p-3">Subject</th>
                  <th className="p-3 text-center">BOT</th>
                  <th className="p-3 text-center">EOT</th>
                  <th className="p-3 text-center">Total</th>
                  <th className="p-3 text-center">Avg</th>
                  <th className="p-3 text-center">Grade</th>
                  <th className="p-3 text-center">Pos.</th>
                  <th className="p-3 text-center">Missing</th>
                </tr>
              </thead>
              <tbody>
                {card.subjects.map((subject, index) => (
                  <tr
                    key={subject.subjectId}
                    className={`border-b border-slate-100 ${index % 2 === 1 ? "bg-slate-50" : "bg-white"}`}
                  >
                    <td className="p-3 text-center text-xs text-slate-400">{index + 1}</td>
                    <td className="p-3 font-semibold text-slate-900">{subject.subjectName}</td>
                    <td className="p-3 text-center text-slate-700">{subject.botMarks ?? "—"}</td>
                    <td className="p-3 text-center text-slate-700">{subject.eotMarks ?? "—"}</td>
                    <td className="p-3 text-center font-medium text-slate-800">{subject.total ?? "—"}</td>
                    <td className="p-3 text-center font-medium text-slate-800">{subject.average ?? "—"}</td>
                    <td className="p-3 text-center">
                      <GradeBadge grade={subject.grade} />
                    </td>
                    <td className="p-3 text-center text-slate-700">{subject.subjectPosition ?? "—"}</td>
                    <td className="p-3 text-center text-xs">
                      {subject.missingMarks.length === 0 ? (
                        <span className="font-medium text-emerald-600">None</span>
                      ) : (
                        <span className="font-medium text-red-600">
                          {subject.missingMarks.join(", ")}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 5. Grading key */}
          <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 p-4 print:mb-2 print:p-2">
            <h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-400 print:mb-1 print:text-[8px]">
              Grading Key
            </h3>
            {/* grid on screen, single flex row on print */}
            <div className="grid grid-cols-3 gap-2 text-xs sm:grid-cols-5 print:flex print:flex-wrap print:gap-1">
              {GRADE_BANDS.map((band, i) => {
                const prevBand = i > 0 ? GRADE_BANDS[i - 1] : null;
                const max = prevBand ? prevBand.min - 1 : 100;
                return (
                  <div
                    key={band.grade}
                    className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 shadow-sm ring-1 ring-slate-100 print:gap-1 print:px-2 print:py-0.5 print:shadow-none print:ring-0"
                  >
                    <GradeBadge grade={band.grade} />
                    <span className="text-slate-600">
                      {band.min}–{max}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 6. Comments and signatures */}
          <div className="report-comments mb-6 print:mb-2">
            <h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-400 print:mb-1 print:text-[8px]">
              Comments &amp; Signatures
            </h3>
            <div className="grid gap-4 sm:grid-cols-3 print:gap-2">
              {(
                [
                  "Class Teacher's Comment",
                  "Head Teacher's Comment",
                  "Parent / Guardian",
                ] as const
              ).map((title) => (
                <div key={title} className="rounded-xl border border-slate-200 p-4 print:p-2">
                  <p className="mb-2 text-xs font-bold text-slate-600 print:mb-1 print:text-[8px]">
                    {title}
                  </p>
                  <div className="mb-4 min-h-[56px] rounded-lg border border-dashed border-slate-200 bg-slate-50 p-2 text-xs italic text-slate-400 print:mb-1.5 print:min-h-0 print:p-1">
                    {title === "Class Teacher's Comment" && card.comments ? card.comments : "—"}
                  </div>
                  <div className="space-y-3 text-xs text-slate-500 print:space-y-1">
                    <div className="flex items-end gap-2">
                      <span className="w-10 flex-shrink-0 print:text-[8px]">Name:</span>
                      <div className="flex-1 border-b border-slate-300" />
                    </div>
                    <div className="flex items-end gap-2">
                      <span className="w-10 flex-shrink-0 print:text-[8px]">Sign:</span>
                      <div className="flex-1 border-b border-slate-300" />
                    </div>
                    <div className="flex items-end gap-2">
                      <span className="w-10 flex-shrink-0 print:text-[8px]">Date:</span>
                      <div className="flex-1 border-b border-slate-300" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 7. Footer */}
          <div className="report-footer border-t border-slate-200 pt-4 text-center text-xs text-slate-400 print:pt-2">
            <p className="font-medium text-slate-500">
              This report was generated by School Connect Reports First.
            </p>
            <p className="mt-1 print:mt-0">
              Generated: {today}&nbsp;&nbsp;|&nbsp;&nbsp;Verification: SC-REPORT-PREVIEW
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
