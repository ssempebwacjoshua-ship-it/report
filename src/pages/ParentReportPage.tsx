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
      {/* Screen-only action card — hidden in print via .no-print */}
      <div className="no-print flex min-h-screen flex-col items-center justify-center px-4 py-8">
        {(status === "REVOKED" || status === "SUPERSEDED") && (
          <div
            className={`mb-4 w-full max-w-sm rounded-xl border px-4 py-3 text-sm ${
              status === "REVOKED"
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-amber-200 bg-amber-50 text-amber-800"
            }`}
          >
            {status === "REVOKED"
              ? "This report link has been revoked by the school. Please contact the school for more information."
              : "A newer version of this report has been issued. This copy is kept for reference only."}
          </div>
        )}

        <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-center text-xs font-bold uppercase tracking-wide text-blue-600">
            {branding.schoolName}
          </p>

          <div className="mt-2 flex justify-center">
            {status === "REVOKED" ? (
              <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700">Revoked</span>
            ) : status === "SUPERSEDED" ? (
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700">Superseded</span>
            ) : (
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">Valid</span>
            )}
          </div>

          <div className="mt-4 text-center">
            <h1 className="text-xl font-bold text-slate-900">{card.studentName}</h1>
            <p className="mt-1 text-sm text-slate-500">
              {card.className} · {card.academicYear} {card.term}
            </p>
          </div>

          <div className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-center">
            <p className="text-xs font-medium text-slate-500">Reference Code</p>
            <p className="font-mono text-base font-bold tracking-widest text-slate-800">{referenceCode}</p>
            <p className="mt-1 text-xs text-slate-400">
              Issued {issuedDate}
              {issuedByName ? ` by ${issuedByName}` : ""}
            </p>
          </div>

          <div className="mt-6 flex flex-col gap-3">
            <button type="button" className="btn btn-primary w-full py-3 text-base" onClick={handlePrint}>
              Print Report
            </button>
            <button type="button" className="btn btn-secondary w-full py-3 text-base" onClick={handlePrint}>
              Download PDF
            </button>
          </div>

          <div className="mt-4 text-center">
            <button
              type="button"
              className="text-xs text-slate-400 underline-offset-2 hover:text-slate-600 hover:underline"
              onClick={() => void copyRef()}
            >
              {copied ? "Copied!" : "Copy reference code"}
            </button>
          </div>
        </div>
      </div>

      {/* Print-only container — hidden on screen via .print-only CSS class */}
      {/* No wrapper divs here: extra height causes 2-page overflow on mobile print */}
      <div className="print-only">
        <StudentReportDetail
          card={card}
          assessmentType={snapshot.filters.assessmentType as "BOT" | "MOT" | "EOT" | "TERM_SUMMARY"}
          showPositions={settings.reports.showOverallPosition}
          schoolSettings={settings.school}
          reportSettings={settings.reports}
          grading={settings.grading}
        />
      </div>
    </div>
  );
}
