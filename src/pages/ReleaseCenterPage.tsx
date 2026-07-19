import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  fetchReleaseStatus,
  issueBulk,
  markSent,
  markSentBulk,
  revokeIssuedReport,
  revokeBulk,
  sendReportReleasesBulk,
  type DeliveryStatus,
  type IssuedLinkData,
  type ReleaseFilters,
  type ReleaseRow,
  type ReleaseSummary,
  type ReportReleaseSendChannel,
  type ReportReleaseSendResponse,
} from "../client/releaseCenterClient";
import { fetchReportContext } from "../client/reportsClient";
import { fetchSettings as loadSettings } from "../client/settingsClient";
import { buildParentReportReleaseMessage, formatTermLabel } from "../shared/reportReleaseMessage";
import type { ReportContext } from "../shared/types/reports";

const ISSUABLE_ASSESSMENTS = ["TERM_SUMMARY", "BOT", "MOT", "EOT"] as const;
const ISSUABLE_READINESS = new Set(["READY", "MISSING_MARKS"]);

function canIssueReportLink(row: ReleaseRow, issuing: boolean) {
  return ISSUABLE_READINESS.has(row.reportReadiness) && !issuing;
}

function getIssueActionLabel(row: ReleaseRow) {
  return row.issuedReport ? "Reissue" : "Issue link";
}

function getIssueBlockedReason(row: ReleaseRow) {
  if (ISSUABLE_READINESS.has(row.reportReadiness)) return null;

  switch (row.reportReadiness) {
    case "NO_FINALIZED_MARKS":
      return "No finalized EOT marks";
    case "NO_ACTIVE_TERM":
      return "No active term";
    case "NO_STUDENTS":
      return "No students";
    case "NO_SUBJECTS":
      return "No subjects";
    default:
      return "This report is not ready to issue";
  }
}

function summarizeSkippedReasons(skipped: Array<{ studentName: string; reason: string }>) {
  if (skipped.length === 0) return "";

  const breakdown = new Map<string, number>();
  for (const item of skipped) {
    breakdown.set(item.reason, (breakdown.get(item.reason) ?? 0) + 1);
  }

  return Array.from(breakdown.entries())
    .map(([reason, count]) => `${reason} (${count})`)
    .join("; ");
}

function summarizeReportSendResult(result: ReportReleaseSendResponse) {
  const parts = [
    result.message,
    `submitted ${result.submitted}`,
    `failed ${result.failed}`,
    `duplicates skipped ${result.skippedDuplicate}`,
    `${result.missingContact} missing parent contact${result.missingContact === 1 ? "" : "s"}`,
    `${result.alreadySent} already sent`,
  ].filter(Boolean);
  return parts.join("; ");
}

// ── Status display ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<DeliveryStatus, { label: string; classes: string }> = {
  NOT_FINALIZED: { label: "Not finalized", classes: "bg-slate-100 text-slate-500" },
  MISSING_CONTACT: { label: "Missing contact", classes: "bg-red-100 text-red-700" },
  NOT_ISSUED: { label: "Not issued", classes: "bg-amber-100 text-amber-700" },
  LINK_GENERATED: { label: "Link generated", classes: "bg-blue-100 text-blue-700" },
  READY_TO_SEND: { label: "Ready to send", classes: "bg-sky-100 text-sky-700" },
  SENDING: { label: "Sending", classes: "bg-blue-100 text-blue-700" },
  FAILED: { label: "Failed", classes: "bg-red-100 text-red-700" },
  SENT_MANUALLY: { label: "Sent manually", classes: "bg-emerald-100 text-emerald-700" },
  OPENED: { label: "Opened", classes: "bg-violet-100 text-violet-700" },
  DOWNLOADED: { label: "Downloaded", classes: "bg-green-100 text-green-700" },
  REVOKED: { label: "Revoked", classes: "bg-red-100 text-red-700" },
  SUPERSEDED: { label: "Superseded", classes: "bg-slate-100 text-slate-500" },
};

function StatusPill({ status }: { status: DeliveryStatus }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, classes: "bg-slate-100 text-slate-500" };
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ${cfg.classes}`}>
      {cfg.label}
    </span>
  );
}

// ── Message builder ───────────────────────────────────────────────────────────

function buildMessage(
  row: ReleaseRow,
  link: IssuedLinkData,
  schoolName: string,
  meta: { term: string; assessmentType: string },
) {
  return buildParentReportReleaseMessage({
    studentName: row.studentName,
    termName: meta.term,
    schoolName,
    reportLink: link.parentLink,
  });
}

function buildEmailSubject(row: ReleaseRow, schoolName: string, meta: { term: string; assessmentType: string }) {
  return `${row.studentName} ${formatTermLabel(meta.term)} school report - ${schoolName}`;
}

function buildEmailBody(
  row: ReleaseRow,
  link: IssuedLinkData,
  schoolName: string,
  meta: { term: string; assessmentType: string },
) {
  return buildMessage(row, link, schoolName, meta);
}

// ── Summary cards ─────────────────────────────────────────────────────────────

function SummaryCard({ label, value, tone }: { label: string; value: number; tone: string }) {
  const toneMap: Record<string, string> = {
    slate: "bg-slate-100 text-slate-700",
    blue: "bg-blue-100 text-blue-700",
    green: "bg-emerald-100 text-emerald-700",
    red: "bg-red-100 text-red-700",
    amber: "bg-amber-100 text-amber-700",
    violet: "bg-violet-100 text-violet-700",
    sky: "bg-sky-100 text-sky-700",
  };
  return (
    <div className="rounded-xl border border-slate-100 bg-white px-4 py-3 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-1 inline-block rounded-lg px-2.5 py-1 text-2xl font-black ${toneMap[tone] ?? toneMap.slate}`}>
        {value}
      </p>
    </div>
  );
}

// ── Action row ────────────────────────────────────────────────────────────────

function RowActions({
  row,
  link,
  schoolName,
  meta,
  onIssue,
  onMarkSent,
  onRevoke,
  issuing,
}: {
  row: ReleaseRow;
  link: IssuedLinkData | null;
  schoolName: string;
  meta: { term: string; assessmentType: string };
  onIssue: () => void;
  onMarkSent: () => void;
  onRevoke: () => void;
  issuing: boolean;
}) {
  const [copied, setCopied] = useState<string | null>(null);

  async function copy(text: string, key: string) {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }

  const canIssue = canIssueReportLink(row, issuing);
  const issueBlockedReason = getIssueBlockedReason(row);
  const issuedId = link?.issuedReportId ?? row.issuedReport?.id ?? null;
  const canMarkSent = !!issuedId && row.deliveryStatus !== "REVOKED" && row.deliveryStatus !== "SUPERSEDED" && row.deliveryStatus !== "SENT_MANUALLY" && row.deliveryStatus !== "OPENED" && row.deliveryStatus !== "DOWNLOADED";
  const canRevoke = !!issuedId && (row.deliveryStatus === "LINK_GENERATED" || row.deliveryStatus === "READY_TO_SEND" || row.deliveryStatus === "SENT_MANUALLY" || row.deliveryStatus === "OPENED" || row.deliveryStatus === "DOWNLOADED");

  const contact = row.primaryContact;
  const msg = link ? buildMessage(row, link, schoolName, meta) : null;
  const waLink = link && contact?.method !== "EMAIL"
    ? `https://wa.me/${contact?.contactValue?.replace(/\D/g, "")}?text=${encodeURIComponent(msg ?? "")}`
    : null;
  const mailtoLink = link && contact?.method === "EMAIL"
    ? `mailto:${contact.contactValue}?subject=${encodeURIComponent(buildEmailSubject(row, schoolName, meta))}&body=${encodeURIComponent(buildEmailBody(row, link, schoolName, meta))}`
    : null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {canIssue && (
        <button
          type="button"
          className="btn btn-secondary py-1 text-xs"
          onClick={onIssue}
          disabled={issuing}
        >
          {issuing ? "Issuing..." : getIssueActionLabel(row)}
        </button>
      )}

      {!canIssue && issueBlockedReason && (
        <span className="text-xs font-medium text-amber-700">{issueBlockedReason}</span>
      )}

      {link && (
        <>
          <button
            type="button"
            className="btn btn-secondary py-1 text-xs"
            onClick={() => void copy(link.parentLink, "link")}
          >
            {copied === "link" ? "Copied!" : "Copy link"}
          </button>

          {contact?.method === "WHATSAPP" || contact?.method === "SMS" ? (
            <>
              <button
                type="button"
                className="btn btn-secondary py-1 text-xs"
                onClick={() => void copy(msg ?? "", "msg")}
              >
                {copied === "msg" ? "Copied!" : "Copy message"}
              </button>
              {waLink && (
                <a
                  href={waLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-success-secondary py-1 text-xs"
                >
                  Open WhatsApp
                </a>
              )}
            </>
          ) : contact?.method === "EMAIL" ? (
            <>
              <button
                type="button"
                className="btn btn-secondary py-1 text-xs"
                onClick={() => void copy(buildEmailBody(row, link, schoolName, meta), "msg")}
              >
                {copied === "msg" ? "Copied!" : "Copy email body"}
              </button>
              {mailtoLink && (
                <a href={mailtoLink} className="btn btn-success-secondary py-1 text-xs">
                  Open email
                </a>
              )}
            </>
          ) : null}

          {canMarkSent && (
            <button
              type="button"
              className="btn btn-success-secondary py-1 text-xs"
              onClick={onMarkSent}
            >
              Mark sent
            </button>
          )}
        </>
      )}

      {canRevoke && (
        <button
          type="button"
          className="btn btn-danger-light py-1 text-xs"
          onClick={onRevoke}
        >
          Revoke
        </button>
      )}
    </div>
  );
}

// ── Filters select ────────────────────────────────────────────────────────────

const selectCls =
  "premium-control h-9 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white";

// ── Main page ─────────────────────────────────────────────────────────────────

export function ReleaseCenterPage() {
  const [context, setContext] = useState<ReportContext | null>(null);
  const [schoolName, setSchoolName] = useState("School Connect");
  const [filters, setFilters] = useState<ReleaseFilters>({
    classId: "",
    assessmentType: "TERM_SUMMARY",
  });
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<ReleaseRow[]>([]);
  const [summary, setSummary] = useState<ReleaseSummary | null>(null);
  const [meta, setMeta] = useState<{ term: string; assessmentType: string; academicYear: string }>({
    term: "",
    assessmentType: "",
    academicYear: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // Tokens returned at issue time (raw, not hashed) ? keyed by studentId
  const [issuedLinks, setIssuedLinks] = useState<Map<string, IssuedLinkData>>(new Map());
  const [issuingIds, setIssuingIds] = useState<Set<string>>(new Set());
  const [bulkIssuing, setBulkIssuing] = useState(false);
  const [bulkResult, setBulkResult] = useState<string | null>(null);
  const [sendChannel, setSendChannel] = useState<ReportReleaseSendChannel>("SMS");
  const [sendScope, setSendScope] = useState<"SELECTED" | "FILTER">("SELECTED");
  const [sendPreview, setSendPreview] = useState<ReportReleaseSendResponse | null>(null);
  const [sendingReports, setSendingReports] = useState(false);
  const [assessmentMismatchWarning, setAssessmentMismatchWarning] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeFilter, setActiveFilter] = useState<"ALL" | "READY" | "MISSING_CONTACT" | "SENT" | "OPENED" | "DOWNLOADED" | "NEEDS_ATTENTION">("ALL");

  // Load context and school name once
  useEffect(() => {
    Promise.all([fetchReportContext(), loadSettings()])
      .then(([ctx, settings]) => {
        setContext(ctx);
        setSchoolName(settings.sections.school.schoolName || "School Connect");
        const activeYear = ctx.academicYears.find((y) => y.isActive) ?? ctx.academicYears[0];
        const activeTerm = ctx.terms.find((t) => t.isActive) ?? ctx.terms[0];
        const firstClass = ctx.classes[0];
        setFilters((f) => ({
          ...f,
          academicYearId: activeYear?.id,
          termId: activeTerm?.id,
          classId: firstClass?.id ?? "",
          assessmentType: settings.sections.academic.defaultAssessmentType,
        }));
      })
      .catch(() => {});
  }, []);

  // Load release status when filters change
  const loadStatus = useCallback(async (f: ReleaseFilters, q: string) => {
    if (!f.classId) return;
    setLoading(true);
    setError("");
    try {
      const result = await fetchReleaseStatus({ ...f, search: q || undefined });
      setRows(result.rows);
      setSelectedIds(new Set());
      setSummary(result.summary);
      setMeta({ term: result.meta.term, assessmentType: result.meta.assessmentType, academicYear: result.meta.academicYear });
      if (result.meta.schoolName) setSchoolName(result.meta.schoolName);

      const currentIssuableCount = result.rows.filter((row) => canIssueReportLink(row, false)).length;
      if (currentIssuableCount > 0) {
        setAssessmentMismatchWarning(null);
        return;
      }

      const otherAssessments = ISSUABLE_ASSESSMENTS.filter((assessment) => assessment !== f.assessmentType);
      const alternativeAssessment = await Promise.all(
        otherAssessments.map(async (assessmentType) => {
          const alt = await fetchReleaseStatus({ ...f, assessmentType, search: q || undefined });
          const issuableCount = alt.rows.filter((row) => canIssueReportLink(row, false)).length;
          return issuableCount > 0 ? { assessmentType, issuableCount } : null;
        }),
      ).then((matches) => matches.find(Boolean) ?? null);

      setAssessmentMismatchWarning(
        alternativeAssessment
          ? `No issuable reports were found for ${f.assessmentType ?? "the selected assessment"}. ${alternativeAssessment.assessmentType} has finalized reports. Select ${alternativeAssessment.assessmentType} to issue those links.`
          : null,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load release status.");
      setAssessmentMismatchWarning(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const visibleRows = rows.filter((row) => {
    if (activeFilter === "ALL") return true;
    if (activeFilter === "READY") return row.deliveryStatus === "READY_TO_SEND" || row.deliveryStatus === "LINK_GENERATED";
    if (activeFilter === "MISSING_CONTACT") return row.deliveryStatus === "MISSING_CONTACT";
    if (activeFilter === "SENT") return row.deliveryStatus === "SENT_MANUALLY";
    if (activeFilter === "OPENED") return row.deliveryStatus === "OPENED";
    if (activeFilter === "DOWNLOADED") return row.deliveryStatus === "DOWNLOADED";
    return ["NOT_FINALIZED", "MISSING_CONTACT", "REVOKED"].includes(row.deliveryStatus);
  });
  const selectedRows = visibleRows.filter((row) => selectedIds.has(row.studentId));
  const selectedIssuableRows = selectedRows.filter((row) => canIssueReportLink(row, issuingIds.has(row.studentId)));
  const allVisibleSelected = visibleRows.length > 0 && visibleRows.every((row) => selectedIds.has(row.studentId));
  const anySelected = selectedRows.length > 0;
  const anyIssuableSelected = selectedIssuableRows.length > 0;

  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!filters.classId) return;
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => void loadStatus(filters, search), 400);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [filters, search, loadStatus]);

  // ── Issue single student ──────────────────────────────────────────────────

  async function handleIssueOne(row: ReleaseRow) {
    setIssuingIds((prev) => new Set(prev).add(row.studentId));
    try {
      const result = await issueBulk({
        ...filters,
        studentIds: [row.studentId],
      });
      if (result.issued[0]) {
        setIssuedLinks((prev) => new Map(prev).set(row.studentId, result.issued[0]!));
        // Refresh status for this row
        void loadStatus(filters, search);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to issue report link.");
    } finally {
      setIssuingIds((prev) => {
        const next = new Set(prev);
        next.delete(row.studentId);
        return next;
      });
    }
  }

  // ── Bulk issue ────────────────────────────────────────────────────────────

  async function handleBulkIssue() {
    setBulkIssuing(true);
    setBulkResult(null);
    setError("");
    try {
      const result = await issueBulk(filters);
      const newLinks = new Map(issuedLinks);
      for (const item of result.issued) {
        newLinks.set(item.studentId, item);
      }
      setIssuedLinks(newLinks);
      const skippedSummary = summarizeSkippedReasons(result.skipped);
      setBulkResult(
        `Issued ${result.issued.length} link${result.issued.length !== 1 ? "s" : ""}${result.skipped.length ? `, skipped ${result.skipped.length}: ${skippedSummary}` : ""}.`,
      );
      void loadStatus(filters, search);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bulk issue failed.");
    } finally {
      setBulkIssuing(false);
    }
  }

  async function handleBulkIssueSelected() {
    const ids = selectedIssuableRows.map((row) => row.studentId);
    const locallyBlocked = selectedRows
      .filter((row) => !canIssueReportLink(row, issuingIds.has(row.studentId)))
      .map((row) => ({
        studentId: row.studentId,
        studentName: row.studentName,
        reason: getIssueBlockedReason(row) ?? "This report is not ready to issue",
      }));

    if (ids.length === 0) {
      setBulkResult(locallyBlocked.length ? `No links were issued. ${summarizeSkippedReasons(locallyBlocked)}.` : "No eligible rows selected.");
      return;
    }

    setBulkIssuing(true);
    setBulkResult(null);
    setError("");
    try {
      const result = await issueBulk({ ...filters, studentIds: ids });
      const combinedSkipped = [...locallyBlocked, ...result.skipped];
      const skippedSummary = summarizeSkippedReasons(combinedSkipped);
      setBulkResult(
        `Issued ${result.issued.length} link${result.issued.length !== 1 ? "s" : ""}${combinedSkipped.length ? `, skipped ${combinedSkipped.length}: ${skippedSummary}` : ""}.`,
      );
      void loadStatus(filters, search);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bulk issue failed.");
    } finally {
      setBulkIssuing(false);
    }
  }

  async function handleBulkMarkSent() {
    const ids = selectedRows.filter((row) => row.issuedReport).map((row) => row.studentId);
    if (ids.length === 0) return;
    const result = await markSentBulk({ classId: filters.classId, studentIds: ids });
    setBulkResult(`Marked ${result.updated} as sent. Skipped ${result.skipped.length}.`);
    void loadStatus(filters, search);
  }

  async function handleBulkRevoke() {
    const ids = selectedRows.filter((row) => row.issuedReport).map((row) => row.studentId);
    if (ids.length === 0) return;
    if (!window.confirm(`Revoke ${ids.length} selected report links?`)) return;
    const result = await revokeBulk({ classId: filters.classId, studentIds: ids });
    setBulkResult(`Revoked ${result.updated} links. Skipped ${result.skipped.length}.`);
    void loadStatus(filters, search);
  }

  function getSendStudentIds() {
    if (sendScope === "SELECTED") return selectedRows.map((row) => row.studentId);
    return rows
      .filter((row) => row.reportReadiness === "READY" || row.reportReadiness === "MISSING_MARKS")
      .map((row) => row.studentId);
  }

  async function previewBulkSend() {
    const studentIds = getSendStudentIds();
    if (studentIds.length === 0) {
      setBulkResult("No ready reports found for this send scope.");
      return;
    }
    setSendingReports(true);
    setBulkResult(null);
    setError("");
    try {
      const result = await sendReportReleasesBulk({
        ...filters,
        studentIds,
        channel: sendChannel,
        confirm: false,
        previewOnly: true,
      });
      setSendPreview(result);
      if (result.missingContact > 0) setBulkResult(`${result.missingContact} missing parent contact${result.missingContact === 1 ? "" : "s"}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not preview report send.");
    } finally {
      setSendingReports(false);
    }
  }

  async function confirmBulkSend() {
    const studentIds = getSendStudentIds();
    if (!sendPreview || studentIds.length === 0) return;
    if (!window.confirm(`This will send personalized report links to ${sendPreview.preview.issuableLinks - sendPreview.preview.alreadySent} parents.`)) return;
    setSendingReports(true);
    setBulkResult(null);
    setError("");
    try {
      const result = await sendReportReleasesBulk({
        ...filters,
        studentIds,
        channel: sendChannel,
        confirm: true,
      });
      setSendPreview(result);
      setBulkResult(summarizeReportSendResult(result));
      void loadStatus(filters, search);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send report links.");
    } finally {
      setSendingReports(false);
    }
  }

  // ── Mark sent ─────────────────────────────────────────────────────────────

  async function handleMarkSent(row: ReleaseRow) {
    const id = issuedLinks.get(row.studentId)?.issuedReportId ?? row.issuedReport?.id;
    if (!id) return;
    try {
      await markSent(id);
      void loadStatus(filters, search);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to mark as sent.");
    }
  }

  // ── Revoke ────────────────────────────────────────────────────────────────

  async function handleRevoke(row: ReleaseRow) {
    const id = issuedLinks.get(row.studentId)?.issuedReportId ?? row.issuedReport?.id;
    if (!id) return;
    if (!window.confirm(`Revoke the report link for ${row.studentName}? The parent will no longer be able to view it.`)) return;
    try {
      await revokeIssuedReport(id);
      setIssuedLinks((prev) => {
        const next = new Map(prev);
        next.delete(row.studentId);
        return next;
      });
      void loadStatus(filters, search);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to revoke.");
    }
  }

  // ── Export ────────────────────────────────────────────────────────────────

  function exportCsv() {
    const header = "Student,Adm No,Guardian,Method,Contact,Status,Ref Code,Link\n";
    const body = rows
      .map((row) => {
        const link = issuedLinks.get(row.studentId);
        return [
          `"${row.studentName}"`,
          row.admissionNumber,
          `"${row.primaryContact?.guardianName ?? ""}"`,
          row.primaryContact?.method ?? "",
          row.primaryContact?.contactValue ?? "",
          row.deliveryStatus,
          link?.referenceCode ?? row.issuedReport?.referenceCode ?? "",
          link?.parentLink ?? "",
        ].join(",");
      })
      .join("\n");
    const blob = new Blob([header + body], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `release-${meta.academicYear}-${meta.term}-${meta.assessmentType}.csv`.replace(/\s/g, "-");
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportSelectedCsv() {
    const selected = selectedRows;
    const header = "studentName,admissionNumber,guardianName,preferredMethod,phone,email,reportRef,reportLink,deliveryStatus,messageText\n";
    const body = selected
      .map((row) => {
        const link = issuedLinks.get(row.studentId) ?? null;
        const message = link ? buildMessage(row, link, schoolName, meta) : "Issue link first";
        return [
          `"${row.studentName}"`,
          `"${row.admissionNumber}"`,
          `"${row.primaryContact?.guardianName ?? ""}"`,
          `"${row.primaryContact?.method ?? ""}"`,
          `"${row.primaryContact?.contactValue ?? ""}"`,
          `""`,
          `"${link?.referenceCode ?? row.issuedReport?.referenceCode ?? ""}"`,
          `"${link?.parentLink ?? ""}"`,
          `"${row.deliveryStatus}"`,
          `"${message.replace(/"/g, '""')}"`,
        ].join(",");
      })
      .join("\n");
    const blob = new Blob([header + body], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "release-selected.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function copySelectedMessages() {
    const text = selectedRows
      .map((row) => {
        const link = issuedLinks.get(row.studentId) ?? null;
        if (!link) return `${row.studentName} - Issue link first`;
        return buildMessage(row, link, schoolName, meta);
      })
      .join("\n\n---\n\n");
    await navigator.clipboard.writeText(text);
  }

  const streams = context?.streams.filter((s) => s.classId === filters.classId) ?? [];
  const readyToIssueCount = rows.filter((row) => canIssueReportLink(row, issuingIds.has(row.studentId))).length;

  return (
    <main className="grid gap-5">
      {/* Header */}
      <header className="page-header flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Link to="/reports" className="text-xs font-bold text-blue-600 hover:underline">
              ? Reports
            </Link>
          </div>
          <h1 className="mt-1 text-xl font-bold tracking-tight text-slate-950 sm:text-2xl">Release Center</h1>
          <p className="mt-1 text-sm text-slate-600">
            Bulk-generate parent report links and prepare WhatsApp, SMS, or email messages.
          </p>
        </div>
        <div className="no-print flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => void handleBulkIssueSelected()}
            disabled={!anyIssuableSelected || bulkIssuing}
          >
            Issue links for selected
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => void copySelectedMessages()}
            disabled={!anySelected}
          >
            Copy selected messages
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={exportSelectedCsv}
            disabled={!anySelected}
          >
            Export selected CSV
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => void handleBulkMarkSent()}
            disabled={!anySelected}
          >
            Mark selected as sent
          </button>
          <button
            type="button"
            className="btn btn-danger-light"
            onClick={() => void handleBulkRevoke()}
            disabled={!anySelected}
          >
            Revoke selected links
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={exportCsv}
            disabled={rows.length === 0}
          >
            Export CSV
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void handleBulkIssue()}
            disabled={bulkIssuing || readyToIssueCount === 0}
          >
            {bulkIssuing ? "Issuing..." : `Issue links for all ready (${readyToIssueCount})`}
          </button>
        </div>
      </header>

      <section className="premium-card no-print rounded-2xl px-4 py-3">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-blue-600">Bulk communication</p>
            <h2 className="text-base font-bold text-slate-950">Send reports to parents</h2>
            <p className="mt-1 text-sm text-slate-600">Issues missing links, builds one message per student, and sends through Communications.</p>
          </div>
          <label className="grid gap-1 text-xs font-semibold uppercase text-slate-500">
            Channel
            <select className={selectCls} value={sendChannel} onChange={(event) => setSendChannel(event.target.value as ReportReleaseSendChannel)}>
              <option value="SMS">SMS</option>
              <option value="WHATSAPP">WhatsApp</option>
            </select>
          </label>
          <label className="grid gap-1 text-xs font-semibold uppercase text-slate-500">
            Scope
            <select className={selectCls} value={sendScope} onChange={(event) => setSendScope(event.target.value as "SELECTED" | "FILTER")}>
              <option value="SELECTED">Selected students</option>
              <option value="FILTER">All ready in current filter</option>
            </select>
          </label>
          <button type="button" className="btn btn-secondary" onClick={() => void previewBulkSend()} disabled={sendingReports || (sendScope === "SELECTED" && !anySelected)}>
            {sendingReports ? "Checking..." : "Preview send"}
          </button>
          <button type="button" className="btn btn-primary" onClick={() => void confirmBulkSend()} disabled={sendingReports || !sendPreview || sendPreview.preview.issuableLinks === sendPreview.preview.alreadySent}>
            {sendingReports ? "Sending..." : "Send reports to parents"}
          </button>
        </div>
        {sendPreview ? (
          <div className="mt-3 grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 sm:grid-cols-3 lg:grid-cols-6">
            <p>Total selected: <span className="font-bold">{sendPreview.preview.totalSelected}</span></p>
            <p>Issuable links: <span className="font-bold">{sendPreview.preview.issuableLinks}</span></p>
            <p>Missing contact: <span className="font-bold">{sendPreview.preview.missingContacts}</span></p>
            <p>Already sent: <span className="font-bold">{sendPreview.preview.alreadySent}</span></p>
            <p>SMS segments: <span className="font-bold">{sendPreview.preview.estimatedSmsSegments}</span></p>
            <p>SMS credits: <span className="font-bold">{sendPreview.preview.estimatedSmsCredits}</span></p>
          </div>
        ) : null}
      </section>

      <div className="no-print flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
        <button type="button" className="text-blue-600 underline" onClick={() => setSelectedIds(new Set(visibleRows.map((r) => r.studentId)))}>
          Select all visible rows
        </button>
        <button type="button" className="text-blue-600 underline" onClick={() => setSelectedIds(new Set())}>
          Clear selection
        </button>
        <span>{selectedIds.size} selected</span>
      </div>

      {/* Filters */}
      <div className="premium-card rounded-2xl px-4 py-3">
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
          <label className="grid gap-1 text-xs font-semibold uppercase text-slate-500">
            Class
            <select
              className={selectCls}
              value={filters.classId}
              onChange={(e) => setFilters((f) => ({ ...f, classId: e.target.value, streamId: undefined }))}
            >
              <option value="">Select class</option>
              {context?.classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-semibold uppercase text-slate-500">
            Stream
            <select
              className={selectCls}
              value={filters.streamId ?? ""}
              onChange={(e) => setFilters((f) => ({ ...f, streamId: e.target.value || undefined }))}
            >
              <option value="">All streams</option>
              {streams.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-semibold uppercase text-slate-500">
            Academic Year
            <select
              className={selectCls}
              value={filters.academicYearId ?? ""}
              onChange={(e) => setFilters((f) => ({ ...f, academicYearId: e.target.value || undefined }))}
            >
              {context?.academicYears.map((y) => (
                <option key={y.id} value={y.id}>{y.name}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-semibold uppercase text-slate-500">
            Term
            <select
              className={selectCls}
              value={filters.termId ?? ""}
              onChange={(e) => setFilters((f) => ({ ...f, termId: e.target.value || undefined }))}
            >
              {context?.terms.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-semibold uppercase text-slate-500">
            Assessment
            <select
              className={selectCls}
              value={filters.assessmentType ?? "TERM_SUMMARY"}
              onChange={(e) => setFilters((f) => ({ ...f, assessmentType: e.target.value }))}
            >
              <option value="TERM_SUMMARY">Term Summary</option>
              <option value="BOT">BOT</option>
              <option value="MOT">MOT</option>
              <option value="EOT">EOT</option>
            </select>
          </label>
          <label className="grid gap-1 text-xs font-semibold uppercase text-slate-500">
            Search
            <input
              className="premium-control h-9 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white"
              type="text"
              placeholder="Name / adm no."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
        </div>
      </div>

      {/* Errors / bulk result */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}
      {bulkResult && !error && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          {bulkResult}
        </div>
      )}
      {assessmentMismatchWarning && !error && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
          {assessmentMismatchWarning}
        </div>
      )}

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-9">
          <SummaryCard label="Total" value={summary.total} tone="slate" />
          <SummaryCard label="Finalized" value={summary.finalized} tone="blue" />
          <SummaryCard label="Links issued" value={summary.linksGenerated} tone="sky" />
          <SummaryCard label="Missing contact" value={summary.missingContacts} tone="red" />
          <SummaryCard label="Ready to send" value={summary.readyToSend} tone="amber" />
          <SummaryCard label="Sent" value={summary.sentManually} tone="green" />
          <SummaryCard label="Opened" value={summary.opened} tone="violet" />
          <SummaryCard label="Downloaded" value={summary.downloaded} tone="green" />
          <SummaryCard label="Needs attention" value={summary.needsAttention} tone="red" />
        </div>
      )}

      <div className="no-print flex flex-wrap gap-2">
        {(["ALL", "READY", "MISSING_CONTACT", "SENT", "OPENED", "DOWNLOADED", "NEEDS_ATTENTION"] as const).map((filter) => (
          <button
            key={filter}
            type="button"
            className={`rounded-full border px-3 py-1 text-xs font-semibold ${activeFilter === filter ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-600"}`}
            onClick={() => setActiveFilter(filter)}
          >
            {filter === "ALL" ? "All" : filter === "READY" ? "Ready to send" : filter === "MISSING_CONTACT" ? "Missing contact" : filter === "SENT" ? "Sent" : filter === "OPENED" ? "Opened" : filter === "DOWNLOADED" ? "Downloaded" : "Needs attention"}
          </button>
        ))}
      </div>

      {/* Table */}
      {!filters.classId ? (
        <div className="rounded-xl border border-slate-100 bg-white p-4 text-center text-xs text-slate-400">
          Select a class to see release status.
        </div>
      ) : loading ? (
        <div className="rounded-xl border border-slate-100 bg-white p-4 text-center text-xs text-slate-400">
          Loading?
        </div>
      ) : visibleRows.length === 0 ? (
        <div className="rounded-xl border border-slate-100 bg-white p-4 text-center text-xs text-slate-400">
          No students found for these filters.
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm xl:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3 text-left">
                    <input type="checkbox" checked={allVisibleSelected} onChange={() => setSelectedIds(allVisibleSelected ? new Set() : new Set(visibleRows.map((r) => r.studentId)))} />
                  </th>
                  <th className="px-4 py-3 text-left">Student</th>
                  <th className="px-4 py-3 text-left">Adm. No.</th>
                  <th className="px-4 py-3 text-left">Guardian</th>
                  <th className="px-4 py-3 text-left">Method</th>
                  <th className="px-4 py-3 text-left">Contact</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Ref</th>
                  <th className="px-4 py-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row, i) => {
                  const link = issuedLinks.get(row.studentId) ?? null;
                  const ref = link?.referenceCode ?? row.issuedReport?.referenceCode;
                  return (
                    <tr
                      key={row.studentId}
                      className={`border-b border-slate-50 last:border-0 ${i % 2 === 1 ? "bg-slate-50/40" : "bg-white"}`}
                    >
                      <td className="px-4 py-3">
                        <input type="checkbox" checked={selectedIds.has(row.studentId)} onChange={() => setSelectedIds((prev) => {
                          const next = new Set(prev);
                          if (next.has(row.studentId)) next.delete(row.studentId); else next.add(row.studentId);
                          return next;
                        })} />
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-800">{row.studentName}</td>
                      <td className="px-4 py-3 font-mono text-slate-600">{row.admissionNumber}</td>
                      <td className="px-4 py-3 text-slate-600">{row.primaryContact?.guardianName ?? <span className="text-red-400">?</span>}</td>
                      <td className="px-4 py-3">
                        {row.primaryContact ? (
                          <span className={`rounded px-1.5 py-0.5 text-xs font-bold ${
                            row.primaryContact.method === "WHATSAPP" ? "bg-green-100 text-green-700"
                            : row.primaryContact.method === "SMS" ? "bg-blue-100 text-blue-700"
                            : "bg-sky-100 text-sky-700"
                          }`}>
                            {row.primaryContact.method}
                          </span>
                        ) : <span className="text-slate-300 text-xs">?</span>}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-500 max-w-[140px] truncate">
                        {row.primaryContact?.contactValue ?? "?"}
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill status={row.deliveryStatus} />
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-500">{ref ?? "?"}</td>
                      <td className="px-4 py-3">
                        <RowActions
                          row={row}
                          link={link}
                          schoolName={schoolName}
                          meta={meta}
                          onIssue={() => void handleIssueOne(row)}
                          onMarkSent={() => void handleMarkSent(row)}
                          onRevoke={() => void handleRevoke(row)}
                          issuing={issuingIds.has(row.studentId)}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile card list */}
          <div className="grid gap-3 xl:hidden">
            {visibleRows.map((row) => {
              const link = issuedLinks.get(row.studentId) ?? null;
              const ref = link?.referenceCode ?? row.issuedReport?.referenceCode;
              return (
                <div key={row.studentId} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2">
                      <input type="checkbox" checked={selectedIds.has(row.studentId)} onChange={() => setSelectedIds((prev) => {
                        const next = new Set(prev);
                        if (next.has(row.studentId)) next.delete(row.studentId); else next.add(row.studentId);
                        return next;
                      })} />
                      <div>
                        <p className="font-bold text-slate-800">{row.studentName}</p>
                        <p className="text-xs text-slate-500">{row.admissionNumber}</p>
                      </div>
                    </div>
                    <StatusPill status={row.deliveryStatus} />
                  </div>
                  {row.primaryContact ? (
                    <p className="mt-2 text-xs text-slate-600">
                      {row.primaryContact.guardianName} ? <span className="font-semibold">{row.primaryContact.method}</span> ? {row.primaryContact.contactValue}
                    </p>
                  ) : (
                    <p className="mt-2 text-xs text-red-400">No parent contact</p>
                  )}
                  {ref && <p className="mt-1 font-mono text-xs text-slate-400">Ref: {ref}</p>}
                  <div className="mt-3">
                    <RowActions
                      row={row}
                      link={link}
                      schoolName={schoolName}
                      meta={meta}
                      onIssue={() => void handleIssueOne(row)}
                      onMarkSent={() => void handleMarkSent(row)}
                      onRevoke={() => void handleRevoke(row)}
                      issuing={issuingIds.has(row.studentId)}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </main>
  );
}

