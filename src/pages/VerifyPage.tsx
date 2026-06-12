import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

type VerifyResult = {
  found: boolean;
  status: "ISSUED" | "REVOKED" | "SUPERSEDED" | null;
  referenceCode: string;
  schoolName: string;
  studentInitials: string;
  academicYear: string;
  term: string;
  assessmentType: string;
  issuedAt: string;
  issuedByName: string | null;
  message?: string;
};

const STATUS_STYLES: Record<string, { label: string; classes: string }> = {
  ISSUED: { label: "Valid", classes: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  REVOKED: { label: "Revoked", classes: "bg-red-100 text-red-800 border-red-200" },
  SUPERSEDED: { label: "Superseded", classes: "bg-amber-100 text-amber-800 border-amber-200" },
};

export function VerifyPage() {
  const { code } = useParams<{ code: string }>();
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");

  useEffect(() => {
    if (!code) return;
    fetch(`/api/verify/${encodeURIComponent(code)}`)
      .then(async (res) => {
        const body = (await res.json()) as VerifyResult;
        if (!res.ok && !body.found) {
          setResult(body);
          return;
        }
        setResult(body);
      })
      .catch(() => setFetchError("Could not connect to the verification server. Please try again."))
      .finally(() => setLoading(false));
  }, [code]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <p className="text-xs font-bold uppercase tracking-wide text-blue-600">School Connect Reports</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">Report Verification</h1>
          <p className="mt-1 text-sm text-slate-500">
            Verify the authenticity of a school report using its reference code.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4">
            <p className="text-xs font-medium text-slate-500">Reference Code</p>
            <p className="font-mono text-lg font-bold tracking-widest text-slate-800">{code}</p>
          </div>

          {loading ? (
            <p className="text-sm text-slate-500">Verifying…</p>
          ) : fetchError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{fetchError}</div>
          ) : !result?.found ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="font-semibold text-slate-700">Not found</p>
              <p className="mt-1 text-sm text-slate-500">
                No report exists with this reference code. Please check the code and try again.
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              <div className={`inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-bold ${STATUS_STYLES[result.status ?? ""]?.classes ?? ""}`}>
                {STATUS_STYLES[result.status ?? ""]?.label ?? result.status}
              </div>

              {result.status === "REVOKED" && (
                <p className="text-sm text-red-600">
                  This report has been revoked by the school. It is no longer considered valid.
                </p>
              )}
              {result.status === "SUPERSEDED" && (
                <p className="text-sm text-amber-700">
                  A newer version of this report has been issued. This reference is kept for historical purposes.
                </p>
              )}

              <dl className="grid gap-2 text-sm">
                <div className="flex justify-between border-b border-slate-100 py-1.5">
                  <dt className="text-slate-500">School</dt>
                  <dd className="font-medium text-slate-800">{result.schoolName}</dd>
                </div>
                <div className="flex justify-between border-b border-slate-100 py-1.5">
                  <dt className="text-slate-500">Student</dt>
                  <dd className="font-medium text-slate-800">{result.studentInitials}</dd>
                </div>
                <div className="flex justify-between border-b border-slate-100 py-1.5">
                  <dt className="text-slate-500">Academic Year</dt>
                  <dd className="font-medium text-slate-800">{result.academicYear}</dd>
                </div>
                <div className="flex justify-between border-b border-slate-100 py-1.5">
                  <dt className="text-slate-500">Term</dt>
                  <dd className="font-medium text-slate-800">{result.term}</dd>
                </div>
                <div className="flex justify-between border-b border-slate-100 py-1.5">
                  <dt className="text-slate-500">Assessment</dt>
                  <dd className="font-medium text-slate-800">{result.assessmentType}</dd>
                </div>
                <div className="flex justify-between py-1.5">
                  <dt className="text-slate-500">Issued</dt>
                  <dd className="font-medium text-slate-800">
                    {new Date(result.issuedAt).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                    {result.issuedByName ? ` by ${result.issuedByName}` : ""}
                  </dd>
                </div>
              </dl>
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-slate-400">
          This verification is provided by {result?.schoolName ?? "the school"} through School Connect Reports.
        </p>
      </div>
    </div>
  );
}
