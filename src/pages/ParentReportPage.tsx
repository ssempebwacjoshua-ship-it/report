import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getApiBaseUrl } from "../client/apiBase";
import { getSchoolBranding } from "../components/layout/branding";
import { StudentReportDetail } from "../components/reports/StudentReportDetail";
import type { StudentReportCard } from "../shared/types/reports";
import type { GradingScaleSettings, ReportSettings, SchoolProfileSettings } from "../shared/types/settings";

const API_BASE = getApiBaseUrl();

type Snapshot = {
  card: StudentReportCard;
  settings: {
    school: SchoolProfileSettings;
    reports: ReportSettings;
    grading: GradingScaleSettings;
  };
  filters: { assessmentType: string };
};

type ParentReportData = {
  id: string;
  status: "ISSUED" | "REVOKED" | "SUPERSEDED";
  referenceCode: string;
  issuedAt: string;
  issuedByName: string | null;
  school: { name: string; code: string };
  snapshot: Snapshot;
};

type ApiErrorBody = { message?: string; code?: string; error?: string };

export function ParentReportPage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<ParentReportData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetch(`${API_BASE}/api/p/${token}`)
      .then(async (res) => {
        if (!res.ok) {
          const raw = await res.text();
          const body = raw ? (JSON.parse(raw) as ApiErrorBody) : {};
          const fallback = res.status === 410 ? "This report link is no longer available." : "Report link not found or expired.";
          throw new Error(body.message ?? body.error ?? fallback);
        }
        return res.json() as Promise<ParentReportData>;
      })
      .then(setData)
      .catch((caught: Error) => setError(caught.message))
      .finally(() => setLoading(false));
  }, [token]);

  function handlePrint() {
    if (token) {
      fetch(`${API_BASE}/api/p/${token}/downloaded`, { method: "POST" }).catch(() => {});
    }
    window.print();
  }

  async function copyRef() {
    if (!data) return;
    await navigator.clipboard.writeText(data.referenceCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-500">Loading report...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 px-4 text-center">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 shadow-sm">
          <p className="text-lg font-semibold text-red-800">Report not available</p>
          <p className="mt-2 text-sm text-red-600">{error || "This link is invalid or the report has been removed."}</p>
        </div>
      </div>
    );
  }

  const { snapshot, referenceCode, issuedAt, issuedByName, status } = data;
  const { card, settings } = snapshot;
  const branding = getSchoolBranding(settings.school);
  const issuedDate = new Date(issuedAt).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="report-parent-page min-h-screen bg-slate-50">
      <div className="no-print sticky top-0 z-10 border-b border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-blue-600">{branding.schoolName}</p>
            <p className="text-sm font-semibold text-slate-800">
              {card.studentName} - {card.academicYear} {card.term}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {status === "REVOKED" ? (
              <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700">Revoked</span>
            ) : status === "SUPERSEDED" ? (
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700">Superseded</span>
            ) : (
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">Valid</span>
            )}
            <button type="button" className="btn btn-primary text-sm" onClick={handlePrint}>
              Download / Print PDF
            </button>
          </div>
        </div>
      </div>

      {(status === "REVOKED" || status === "SUPERSEDED") && (
        <div className="no-print mx-auto mt-4 max-w-4xl px-4">
          <div
            className={`rounded-xl border px-4 py-3 text-sm ${
              status === "REVOKED" ? "border-red-200 bg-red-50 text-red-700" : "border-amber-200 bg-amber-50 text-amber-800"
            }`}
          >
            {status === "REVOKED"
              ? "This report link has been revoked by the school. Please contact the school for more information."
              : "A newer version of this report has been issued. This copy is kept for reference only."}
          </div>
        </div>
      )}

      <div className="no-print mx-auto mt-4 max-w-4xl px-4">
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <div className="flex-1">
            <p className="text-xs font-medium text-slate-500">Reference Code</p>
            <p className="font-mono text-base font-bold tracking-widest text-slate-800">{referenceCode}</p>
          </div>
          <button type="button" className="btn btn-secondary text-xs" onClick={() => void copyRef()}>
            {copied ? "Copied!" : "Copy"}
          </button>
          <div className="text-right text-xs text-slate-500">
            <p>Issued {issuedDate}</p>
            {issuedByName ? <p>by {issuedByName}</p> : null}
          </div>
        </div>
      </div>

      <div className="report-print-page mx-auto max-w-4xl px-4 py-6">
        <div className="print-only mb-4">
          <p className="text-center text-xs text-slate-500">
            {branding.schoolName} - Issued {issuedDate} - Ref: {referenceCode}
          </p>
        </div>

        <StudentReportDetail
          card={card}
          assessmentType={snapshot.filters.assessmentType as "BOT" | "MOT" | "EOT" | "TERM_SUMMARY"}
          showPositions={settings.reports.showOverallPosition}
          schoolSettings={settings.school}
          reportSettings={settings.reports}
          grading={settings.grading}
        />

        <div className="print-only mt-6 border-t border-slate-200 pt-4 text-center text-xs text-slate-400">
          Issued through {branding.schoolName} official report link - Reference: {referenceCode} - {issuedDate}
        </div>
      </div>
    </div>
  );
}
