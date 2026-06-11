import { useEffect, useMemo, useState } from "react";
import { EmptyReportState } from "../components/reports/EmptyReportState";
import { ReportFilters } from "../components/reports/ReportFilters";
import { StudentReportCard } from "../components/reports/StudentReportCard";
import { StudentReportDetail } from "../components/reports/StudentReportDetail";
import { fetchReportContext, fetchReports } from "../client/reportsClient";
import type { ReportContext, ReportFilters as Filters, ReportsResponse, StudentReportCard as Card } from "../shared/types/reports";

const DEFAULT_FILTERS: Filters = {
  schoolCode: "SCU-PREVIEW",
  classId: "",
  streamId: "",
  assessmentType: "ALL",
};

export function ReportsPage() {
  const [context, setContext] = useState<ReportContext | null>(null);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [report, setReport] = useState<ReportsResponse | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetchReportContext()
      .then((loaded) => {
        setContext(loaded);
        const activeYear = loaded.academicYears.find((year) => year.isActive) ?? loaded.academicYears[0];
        const activeTerm = loaded.terms.find((term) => term.isActive) ?? loaded.terms[0];
        const firstClass = loaded.classes[0];
        setFilters((current) => ({
          ...current,
          academicYearId: activeYear?.id,
          termId: activeTerm?.id,
          classId: firstClass?.id ?? "",
        }));
      })
      .catch((caught: Error) => setError(caught.message));
  }, []);

  useEffect(() => {
    if (!filters.classId) return;
    fetchReports(filters)
      .then((loaded) => {
        setReport(loaded);
        setSelectedStudentId((current) => (loaded.cards.some((card) => card.studentId === current) ? current : loaded.cards[0]?.studentId ?? ""));
      })
      .catch((caught: Error) => setError(caught.message));
  }, [filters]);

  const selectedCard: Card | null = useMemo(
    () => report?.cards.find((card) => card.studentId === selectedStudentId) ?? null,
    [report, selectedStudentId],
  );

  return (
    <main className="grid gap-6">
      <header className="page-header flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-blue-600">Report Generation</p>
          <h1 className="text-3xl font-bold tracking-tight text-slate-950">Academic reports</h1>
          <p className="mt-2 text-sm text-slate-600">Generate and inspect report cards from finalized stored marks.</p>
        </div>
        <a className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-sm hover:bg-blue-700" href="/imports/marks">
          Marks import
        </a>
      </header>

      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 shadow-sm">{error}</div> : null}

      <ReportFilters context={context} filters={filters} onChange={setFilters} />

      <section className="grid min-w-0 gap-6 xl:grid-cols-[minmax(320px,0.95fr)_minmax(0,1.35fr)]">
        <div className="student-card-list grid min-w-0 content-start gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-950">Student cards</h2>
            <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700">{report?.cards.length ?? 0} cards</span>
          </div>
          {report && report.cards.length === 0 ? <EmptyReportState reason={report.emptyReason} /> : null}
          <div className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
            {report?.cards.map((card) => (
              <StudentReportCard
                key={card.studentId}
                card={card}
                selected={card.studentId === selectedStudentId}
                onOpen={() => setSelectedStudentId(card.studentId)}
              />
            ))}
          </div>
        </div>

        <StudentReportDetail card={selectedCard} />
      </section>
    </main>
  );
}
