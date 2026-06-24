import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { EmptyReportState } from "../components/reports/EmptyReportState";
import { ReportFilters } from "../components/reports/ReportFilters";
import { StudentReportCard } from "../components/reports/StudentReportCard";
import { StudentReportDetail } from "../components/reports/StudentReportDetail";
import { fetchReportContext, fetchReports } from "../client/reportsClient";
import { fetchSettings } from "../client/settingsClient";
import { issueReport, bulkIssueReports, BulkIssueMissingContactError, type BlockedStudent, type IssueReportResult } from "../client/issueReportClient";
import { getSchoolDisplayName } from "../components/layout/branding";
import { buildParentReportReleaseMessage } from "../shared/reportReleaseMessage";
import type {
  ReportContext,
  ReportFilters as Filters,
  ReportsResponse,
  StudentReportCard as Card,
} from "../shared/types/reports";

const DEFAULT_FILTERS: Filters = {
  schoolCode: "",
  classId: "",
  streamId: "",
  assessmentType: "TERM_SUMMARY",
};

const PANE_KEY = "reports-left-pane-width";
const MIN_LEFT = 280;
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

// Modal shown when single-issue or bulk-issue is blocked due to missing contacts
function MissingContactModal({
  blocked,
  onClose,
}: {
  blocked: BlockedStudent[];
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Missing parent contacts"
    >
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">Cannot issue reports</h2>
            <p className="mt-1 text-sm text-red-700">
              {blocked.length} student{blocked.length !== 1 ? "s are" : " is"} missing parent contact details.
            </p>
          </div>
          <button type="button" className="text-slate-400 hover:text-slate-600" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <ul className="mb-5 max-h-64 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200">
          {blocked.map((s) => (
            <li key={s.studentId} className="flex items-center justify-between gap-3 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">{s.studentName}</p>
                <p className="text-xs text-slate-500">{s.admissionNumber} · {s.className} {s.streamName}</p>
                <p className="text-xs text-red-600">{s.contactSummary}</p>
              </div>
              <a
                href={`/students?studentId=${encodeURIComponent(s.studentId)}`}
                className="shrink-0 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100"
              >
                Edit contact
              </a>
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <button type="button" className="btn btn-secondary flex-1" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export function ReportsPage() {
  const [searchParams] = useSearchParams();
  const urlParams = useRef({
    schoolCode: searchParams.get("schoolCode"),
    classId: searchParams.get("classId"),
    streamId: searchParams.get("streamId"),
    termId: searchParams.get("termId"),
    academicYearId: searchParams.get("academicYearId"),
    assessmentType: searchParams.get("assessmentType") as Filters["assessmentType"] | null,
  }).current;

  const [context, setContext] = useState<ReportContext | null>(null);
  const [filters, setFilters] = useState<Filters>(() => ({
    ...DEFAULT_FILTERS,
    ...(urlParams.schoolCode ? { schoolCode: urlParams.schoolCode } : {}),
    classId: urlParams.classId ?? DEFAULT_FILTERS.classId,
    streamId: urlParams.streamId ?? DEFAULT_FILTERS.streamId,
    ...(urlParams.termId ? { termId: urlParams.termId } : {}),
    ...(urlParams.academicYearId ? { academicYearId: urlParams.academicYearId } : {}),
    ...(urlParams.assessmentType ? { assessmentType: urlParams.assessmentType } : {}),
  }));
  const [report, setReport] = useState<ReportsResponse | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [hmEditOpen, setHmEditOpen] = useState(false);
  const [error, setError] = useState("");
  const [issuing, setIssuing] = useState(false);
  const [issueResult, setIssueResult] = useState<IssueReportResult | null>(null);
  const [issueError, setIssueError] = useState("");
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Bulk issue state
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkIssuing, setBulkIssuing] = useState(false);
  const [bulkError, setBulkError] = useState("");

  // Missing contact modal
  const [blockedStudents, setBlockedStudents] = useState<BlockedStudent[] | null>(null);

  useEffect(() => {
    Promise.all([fetchReportContext(), fetchSettings()])
      .then(([loaded, settings]) => {
        setContext(loaded);
        const activeYear =
          loaded.academicYears.find((year) => year.name === settings.sections.academic.activeAcademicYear) ??
          loaded.academicYears.find((year) => year.isActive) ??
          loaded.academicYears[0];
        const activeTerm =
          loaded.terms.find((term) => term.name === settings.sections.academic.activeTerm) ??
          loaded.terms.find((term) => term.isActive) ??
          loaded.terms[0];
        const firstClass = loaded.classes[0];
        setFilters((current) => ({
          ...current,
          academicYearId: urlParams.academicYearId ?? activeYear?.id,
          termId: urlParams.termId ?? activeTerm?.id,
          classId: urlParams.classId ?? firstClass?.id ?? "",
          assessmentType: urlParams.assessmentType ?? settings.sections.academic.defaultAssessmentType,
        }));
      })
      .catch((caught: Error) => setError(caught.message));
  }, []);

  useEffect(() => {
    if (!filters.classId) return;
    fetchReports(filters)
      .then((loaded) => {
        setReport(loaded);
        setBulkSelected(new Set());
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
  const classAverage = useMemo(() => {
    const averages = report?.cards.map((card) => card.average).filter((value): value is number => value != null) ?? [];
    if (averages.length === 0) return null;
    return Math.round((averages.reduce((sum, value) => sum + value, 0) / averages.length) * 10) / 10;
  }, [report]);

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

  async function handleIssueReport() {
    if (!selectedCard || !filters.classId) return;

    // Preflight: block if student is missing contacts
    if (selectedCard.contactReadiness !== "READY") {
      setBlockedStudents([{
        studentId: selectedCard.studentId,
        studentName: selectedCard.studentName,
        admissionNumber: selectedCard.admissionNumber,
        className: selectedCard.className,
        streamName: selectedCard.streamName,
        contactReadiness: selectedCard.contactReadiness,
        contactSummary: selectedCard.contactSummary,
      }]);
      return;
    }

    setIssuing(true);
    setIssueError("");
    setIssueResult(null);
    try {
      const result = await issueReport({
        schoolCode: filters.schoolCode,
        studentId: selectedCard.studentId,
        classId: filters.classId,
        streamId: filters.streamId,
        academicYearId: filters.academicYearId,
        termId: filters.termId,
        assessmentType: filters.assessmentType,
      });
      setIssueResult(result);
    } catch (caught) {
      setIssueError(caught instanceof Error ? caught.message : "Failed to issue report.");
    } finally {
      setIssuing(false);
    }
  }

  async function handleBulkIssue() {
    if (bulkSelected.size === 0 || !filters.classId) return;
    setBulkIssuing(true);
    setBulkError("");
    try {
      await bulkIssueReports({
        studentIds: [...bulkSelected],
        classId: filters.classId,
        streamId: filters.streamId,
        academicYearId: filters.academicYearId,
        termId: filters.termId,
        assessmentType: filters.assessmentType,
      });
      // Refresh to get updated issuedStudentIds
      const loaded = await fetchReports(filters);
      setReport(loaded);
      setBulkSelected(new Set());
      setBulkMode(false);
    } catch (caught) {
      if (caught instanceof Error && "blockedStudents" in caught) {
        setBlockedStudents((caught as BulkIssueMissingContactError).blockedStudents);
      } else {
        setBulkError(caught instanceof Error ? caught.message : "Failed to bulk issue reports.");
      }
    } finally {
      setBulkIssuing(false);
    }
  }

  function toggleBulkStudent(id: string) {
    setBulkSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllBulk() {
    setBulkSelected(new Set(report?.cards.map((c) => c.studentId) ?? []));
  }

  async function copyText(text: string, field: string) {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  }

  const messageTemplate = issueResult
    ? buildParentReportReleaseMessage({
        studentName: issueResult.studentName,
        termName: issueResult.term,
        schoolName: getSchoolDisplayName(report?.settings.school, "the school"),
        reportLink: issueResult.parentLink,
      })
    : "";

  const counts = report?.readinessCounts;

  return (
    <main className="grid gap-4">
      {blockedStudents ? (
        <MissingContactModal
          blocked={blockedStudents}
          onClose={() => setBlockedStudents(null)}
        />
      ) : null}

      <header className="page-header flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-blue-600">
            Report Generation
          </p>
          <h1 className="text-xl font-bold tracking-tight text-slate-950 sm:text-2xl">Academic reports</h1>
          <p className="mt-1 text-sm text-slate-600">
            Generate and inspect report cards from finalized stored marks.
          </p>
        </div>
        <div className="no-print flex flex-wrap justify-end gap-2">
          <button
            type="button"
            className="btn btn-secondary"
            disabled={!selectedCard}
            onClick={() => setHmEditOpen((open) => !open)}
          >
            HM Edit
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!selectedCard}
            onClick={() => window.print()}
          >
            Print / Save PDF
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={!selectedCard || issuing}
            onClick={() => void handleIssueReport()}
          >
            {issuing ? "Issuing..." : "Issue Report Link"}
          </button>
          <button
            type="button"
            className={`btn ${bulkMode ? "btn-primary" : "btn-secondary"}`}
            onClick={() => { setBulkMode((m) => !m); setBulkSelected(new Set()); }}
          >
            {bulkMode ? "Cancel Bulk" : "Bulk Issue"}
          </button>
          <a className="btn btn-secondary" href="/imports/marks">
            Marks Import
          </a>
          <a className="btn btn-primary" href="/reports/release">
            Release Center
          </a>
        </div>
      </header>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 shadow-sm">
          {error}
        </div>
      ) : null}

      {issueError ? (
        <div className="no-print rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 shadow-sm">
          {issueError}
        </div>
      ) : null}

      {bulkError ? (
        <div className="no-print rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 shadow-sm">
          {bulkError}
        </div>
      ) : null}

      {issueResult ? (
        <div className="no-print rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-emerald-800">
              Report link issued for {issueResult.studentName}
            </p>
            <button
              type="button"
              className="text-xs text-emerald-600 hover:text-emerald-800"
              onClick={() => setIssueResult(null)}
            >
              Dismiss
            </button>
          </div>
          <div className="grid gap-2">
            <div className="flex items-center gap-2 rounded-lg bg-white/70 px-3 py-2">
              <span className="min-w-0 flex-1 truncate font-mono text-xs text-slate-700">{issueResult.parentLink}</span>
              <button
                type="button"
                className="shrink-0 rounded px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
                onClick={() => void copyText(issueResult.parentLink, "link")}
              >
                {copiedField === "link" ? "Copied!" : "Copy link"}
              </button>
            </div>
            <div className="flex items-start gap-2 rounded-lg bg-white/70 px-3 py-2">
              <span className="min-w-0 flex-1 text-xs text-slate-600 leading-relaxed">{messageTemplate}</span>
              <button
                type="button"
                className="shrink-0 rounded px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
                onClick={() => void copyText(messageTemplate, "msg")}
              >
                {copiedField === "msg" ? "Copied!" : "Copy message"}
              </button>
            </div>
            <div className="flex items-center gap-2 px-3">
              <span className="text-xs text-slate-500">Reference code:</span>
              <span className="font-mono text-sm font-bold text-slate-700">{issueResult.referenceCode}</span>
              <button
                type="button"
                className="rounded px-2 py-0.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
                onClick={() => void copyText(issueResult.referenceCode, "ref")}
              >
                {copiedField === "ref" ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Readiness summary counts */}
      {counts ? (
        <div className="no-print grid grid-cols-3 gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:grid-cols-4 md:grid-cols-7" aria-label="Readiness summary">
          {[
            { label: "Total", value: counts.total, color: "text-slate-700" },
            { label: "With Reports", value: counts.withReports, color: "text-blue-700" },
            { label: "No Reports", value: counts.noReports, color: "text-amber-600" },
            { label: "Ready to Issue", value: counts.readyToIssue, color: "text-emerald-700" },
            { label: "Missing Contact", value: counts.blockedContact, color: "text-red-700" },
            { label: "Issued", value: counts.issued, color: "text-purple-700" },
            { label: "Not Issued", value: counts.notIssued, color: "text-slate-500" },
          ].map(({ label, value, color }) => (
            <div key={label} className="text-center">
              <p className={`text-xl font-black ${color}`}>{value}</p>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
            </div>
          ))}
        </div>
      ) : null}

      <ReportFilters
        context={context}
        filters={filters}
        onChange={setFilters}
        readinessCounts={counts}
      />

      {bulkMode ? (
        <div className="no-print rounded-2xl border border-blue-200 bg-blue-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold text-blue-800">
              Bulk Issue Mode — {bulkSelected.size} of {report?.cards.length ?? 0} selected
            </p>
            <div className="flex gap-2">
              <button type="button" className="btn btn-secondary text-xs" onClick={selectAllBulk}>
                Select All
              </button>
              <button type="button" className="btn btn-secondary text-xs" onClick={() => setBulkSelected(new Set())}>
                Clear
              </button>
              <button
                type="button"
                className="btn btn-primary text-xs"
                disabled={bulkSelected.size === 0 || bulkIssuing}
                onClick={() => void handleBulkIssue()}
              >
                {bulkIssuing ? "Issuing..." : `Issue ${bulkSelected.size} Report${bulkSelected.size !== 1 ? "s" : ""}`}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <section
        ref={containerRef}
        className="flex min-w-0 flex-col gap-4 xl:flex-row xl:items-start xl:gap-0"
      >
        {/* Left pane: compact student list */}
        <div
          className="student-card-list min-w-0 shrink-0"
          style={isDesktop ? { width: leftWidth } : undefined}
        >
          <div className="grid min-w-0 content-start gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-950">Students</h2>
              <span className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-sm font-bold text-blue-700 shadow-sm">
                {report?.cards.length ?? 0} students
              </span>
            </div>
            {report && report.cards.length === 0 ? (
              <EmptyReportState reason={report.emptyReason} />
            ) : null}
            <div className="grid min-w-0 gap-2">
              {report?.cards.map((card) => (
                <div key={card.studentId} className="relative">
                  {bulkMode ? (
                    <label className="absolute left-2 top-1/2 z-10 -translate-y-1/2">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300 text-blue-600"
                        checked={bulkSelected.has(card.studentId)}
                        onChange={() => toggleBulkStudent(card.studentId)}
                        aria-label={`Select ${card.studentName} for bulk issue`}
                      />
                    </label>
                  ) : null}
                  <div className={bulkMode ? "pl-7" : ""}>
                    <StudentReportCard
                      card={card}
                      selected={card.studentId === selectedStudentId}
                      showPositions={Boolean(report?.settings.reports.showOverallPosition)}
                      onOpen={() => setSelectedStudentId(card.studentId)}
                    />
                  </div>
                </div>
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
          <div className="rounded-full bg-slate-200 px-0.5 py-3 text-sm leading-none text-slate-400 shadow-inner transition-colors hover:bg-blue-100 hover:text-blue-500">
            ⋮
          </div>
        </div>

        {/* Right pane: report preview */}
        <div className="min-w-0 flex-1">
          <StudentReportDetail
            card={selectedCard}
            assessmentType={report?.filters.assessmentType}
            showPositions={Boolean(report?.settings.reports.showOverallPosition)}
            schoolSettings={report?.settings.school}
            reportSettings={report?.settings.reports}
            grading={report?.settings.grading}
            classAverage={classAverage}
            editOpen={hmEditOpen}
            onEditOpenChange={setHmEditOpen}
          />
        </div>
      </section>
    </main>
  );
}
