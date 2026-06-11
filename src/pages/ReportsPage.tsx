import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EmptyReportState } from "../components/reports/EmptyReportState";
import { ReportFilters } from "../components/reports/ReportFilters";
import { StudentReportCard } from "../components/reports/StudentReportCard";
import { StudentReportDetail } from "../components/reports/StudentReportDetail";
import { fetchReportContext, fetchReports } from "../client/reportsClient";
import type {
  ReportContext,
  ReportFilters as Filters,
  ReportsResponse,
  StudentReportCard as Card,
} from "../shared/types/reports";

const DEFAULT_FILTERS: Filters = {
  schoolCode: "SCU-PREVIEW",
  classId: "",
  streamId: "",
  assessmentType: "ALL",
};

const PANE_KEY = "reports-left-pane-width";
const MIN_LEFT = 300;
const MIN_RIGHT = 480;

function useDesktopMatch() {
  const [matches, setMatches] = useState(
    () => window.matchMedia("(min-width: 1280px)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1280px)");
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return matches;
}

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
        const activeYear =
          loaded.academicYears.find((year) => year.isActive) ?? loaded.academicYears[0];
        const activeTerm =
          loaded.terms.find((term) => term.isActive) ?? loaded.terms[0];
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
        setSelectedStudentId((current) =>
          loaded.cards.some((card) => card.studentId === current)
            ? current
            : (loaded.cards[0]?.studentId ?? ""),
        );
      })
      .catch((caught: Error) => setError(caught.message));
  }, [filters]);

  const selectedCard: Card | null = useMemo(
    () => report?.cards.find((card) => card.studentId === selectedStudentId) ?? null,
    [report, selectedStudentId],
  );

  // ── Resizable split pane ──────────────────────────────────────────────────
  const isDesktop = useDesktopMatch();

  const [leftWidth, setLeftWidth] = useState<number>(() => {
    try {
      const saved = Number(localStorage.getItem(PANE_KEY));
      return saved >= MIN_LEFT ? saved : 380;
    } catch {
      return 380;
    }
  });

  const containerRef = useRef<HTMLElement>(null);
  const dragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(0);
  const currentWidth = useRef(leftWidth);

  const onHandleMouseDown = useCallback((e: React.MouseEvent) => {
    dragging.current = true;
    dragStartX.current = e.clientX;
    dragStartWidth.current = currentWidth.current;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    e.preventDefault();
  }, []);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current || !containerRef.current) return;
      const containerWidth = containerRef.current.getBoundingClientRect().width;
      const delta = e.clientX - dragStartX.current;
      // 10 = handle div width (w-2.5)
      const maxLeft = containerWidth - MIN_RIGHT - 10;
      const newWidth = Math.max(MIN_LEFT, Math.min(dragStartWidth.current + delta, maxLeft));
      currentWidth.current = newWidth;
      setLeftWidth(newWidth);
    };

    const onMouseUp = () => {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      try {
        localStorage.setItem(PANE_KEY, String(currentWidth.current));
      } catch { /* noop */ }
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <main className="grid gap-4">
      <header className="page-header flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-blue-600">
            Report Generation
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">Academic reports</h1>
          <p className="mt-1 text-sm text-slate-600">
            Generate and inspect report cards from finalized stored marks.
          </p>
        </div>
        <a
          className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-sm hover:bg-blue-700"
          href="/imports/marks"
        >
          Marks import
        </a>
      </header>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 shadow-sm">
          {error}
        </div>
      ) : null}

      <ReportFilters context={context} filters={filters} onChange={setFilters} />

      <section
        ref={containerRef}
        className="flex min-w-0 flex-col gap-4 xl:flex-row xl:items-start xl:gap-0"
      >
        {/* Left pane: student cards */}
        <div
          className="student-card-list min-w-0 shrink-0"
          style={isDesktop ? { width: leftWidth } : undefined}
        >
          <div className="grid min-w-0 content-start gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-950">Student cards</h2>
              <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700">
                {report?.cards.length ?? 0} cards
              </span>
            </div>
            {report && report.cards.length === 0 ? (
              <EmptyReportState reason={report.emptyReason} />
            ) : null}
            <div className="grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
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
        </div>

        {/* Resize handle — desktop only, hidden on print */}
        <div
          role="separator"
          aria-label="Resize panels"
          className="no-print hidden w-2.5 shrink-0 cursor-col-resize select-none items-center justify-center self-stretch xl:flex"
          onMouseDown={onHandleMouseDown}
        >
          <div className="h-16 w-px rounded-full bg-slate-200 transition-colors hover:bg-blue-300" />
        </div>

        {/* Right pane: report preview */}
        <div className="min-w-0 flex-1">
          <StudentReportDetail card={selectedCard} />
        </div>
      </section>
    </main>
  );
}
