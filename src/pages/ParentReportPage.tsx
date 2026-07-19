import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getApiBaseUrl } from "../client/apiBase";
import { SectionLoader } from "../components/SectionLoader";
import { getSchoolBranding } from "../components/layout/branding";
import { StudentReportDetail } from "../components/reports/StudentReportDetail";
import type { StudentReportCard } from "../shared/types/reports";
import type { GradingScaleSettings, ReportPersonalizationSettings, ReportSettings, SchoolProfileSettings } from "../shared/types/settings";
import type { ReportComments } from "../shared/utils/reportComments";

const API_BASE = getApiBaseUrl();

type Snapshot = {
  card: StudentReportCard;
  settings: {
    school: SchoolProfileSettings;
    reports: ReportSettings;
    personalization: ReportPersonalizationSettings | null;
    grading: GradingScaleSettings;
  };
  filters: { assessmentType: string };
  reportComments?: ReportComments;
};

type ParentReportData = {
  status: "ISSUED" | "REVOKED" | "SUPERSEDED";
  referenceCode: string;
  issuedAt: string;
  issuedByName: string | null;
  school: { name: string };
  snapshot: Snapshot;
};

type ApiErrorBody = { message?: string; code?: string; error?: string };

export function ParentReportPage() {
  const { token, code } = useParams<{ token?: string; code?: string }>();
  const [data, setData] = useState<ParentReportData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const apiPath = code ? `/api/p/short/${code}` : token ? `/api/p/${token}` : null;

  useEffect(() => {
    if (!apiPath) return;
    fetch(`${API_BASE}${apiPath}`)
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
  }, [apiPath]);

  function handlePrint() {
    if (apiPath) {
      fetch(`${API_BASE}${apiPath}/downloaded`, { method: "POST" }).catch(() => {});
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
    return <SectionLoader message="Loading report..." />;
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
      <div className="no-print mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        {(status === "REVOKED" || status === "SUPERSEDED") && (
          <div
            className={`w-full rounded-2xl border px-4 py-3 text-sm shadow-sm ${
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

        <div className="rounded-[1.75rem] border border-slate-200 bg-white/90 p-4 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">
                  {branding.schoolName}
                </p>
                {status === "REVOKED" ? (
                  <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700">Revoked</span>
                ) : status === "SUPERSEDED" ? (
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700">Superseded</span>
                ) : (
                  <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">Valid</span>
                )}
              </div>

              <div>
                <h1 className="text-2xl font-bold text-slate-950 sm:text-3xl">{card.studentName}</h1>
                <p className="mt-1 text-sm text-slate-500">
                  {card.className} • {card.academicYear} {card.term}
                </p>
              </div>

              <div className="flex flex-wrap gap-3 text-sm text-slate-500">
                <div className="rounded-xl bg-slate-50 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Reference Code</p>
                  <p className="font-mono text-base font-bold tracking-[0.18em] text-slate-800">{referenceCode}</p>
                </div>
                <div className="rounded-xl bg-slate-50 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Issued</p>
                  <p className="font-semibold text-slate-700">{issuedDate}</p>
                  <p className="text-xs text-slate-400">{issuedByName ? `By ${issuedByName}` : "School record"}</p>
                </div>
              </div>
            </div>

            <div className="flex w-full flex-col gap-3 lg:w-72">
              <button type="button" className="btn btn-primary w-full py-3 text-base" onClick={handlePrint}>
                Print Report
              </button>
              <button type="button" className="btn btn-secondary w-full py-3 text-base" onClick={handlePrint}>
                Download PDF
              </button>
              <button
                type="button"
                className="text-sm text-slate-500 underline-offset-2 hover:text-slate-700 hover:underline"
                onClick={() => void copyRef()}
              >
                {copied ? "Copied!" : "Copy reference code"}
              </button>
            </div>
          </div>
        </div>

        <div className="report-parent-preview">
          <StudentReportDetail
            card={card}
            assessmentType={snapshot.filters.assessmentType as "BOT" | "MOT" | "EOT" | "TERM_SUMMARY"}
            showPositions={settings.reports.showOverallPosition}
            schoolSettings={settings.school}
            reportSettings={settings.reports}
            personalization={settings.personalization ?? undefined}
            grading={settings.grading}
            initialComments={snapshot.reportComments}
          />
        </div>
      </div>

      <div className="print-only">
        <StudentReportDetail
          card={card}
          assessmentType={snapshot.filters.assessmentType as "BOT" | "MOT" | "EOT" | "TERM_SUMMARY"}
          showPositions={settings.reports.showOverallPosition}
          schoolSettings={settings.school}
          reportSettings={settings.reports}
          personalization={settings.personalization ?? undefined}
          grading={settings.grading}
          initialComments={snapshot.reportComments}
        />
      </div>
    </div>
  );
}
