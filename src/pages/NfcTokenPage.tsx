import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { resolveNfcToken, reactivateStudentCredential } from "../client/studentCredentialsClient";
import type { NfcTokenResolution } from "../shared/types/studentCredentials";

export function NfcTokenPage() {
  const { token = "" } = useParams();
  const navigate = useNavigate();
  const [result, setResult] = useState<NfcTokenResolution | null>(null);
  const [error, setError] = useState("");
  const [reactivateReason, setReactivateReason] = useState("");
  const [reactivateLoading, setReactivateLoading] = useState(false);
  const [reactivateError, setReactivateError] = useState("");
  const [reactivated, setReactivated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    resolveNfcToken(token)
      .then((resolved) => {
        if (cancelled) return;
        setResult(resolved);
        if (resolved.valid && !resolved.actionBlocked && resolved.mode !== "PUBLIC_ID" && resolved.targetPath) {
          navigate(resolved.targetPath, { replace: true });
        }
      })
      .catch((caught: Error) => {
        if (!cancelled) setError(caught.message);
      });
    return () => { cancelled = true; };
  }, [navigate, token]);

  async function handleReactivate() {
    if (!result?.credential?.id || !reactivateReason.trim()) return;
    setReactivateLoading(true);
    setReactivateError("");
    try {
      await reactivateStudentCredential(result.credential.id, reactivateReason.trim());
      setReactivated(true);
    } catch (e) {
      setReactivateError(e instanceof Error ? e.message : "Could not re-enable credential.");
    } finally {
      setReactivateLoading(false);
    }
  }

  const statusMessage = error || !result
    ? "Checking wristband..."
    : result.valid
      ? "Student NFC credential verified."
      : "This NFC credential cannot be used.";

  // Show re-enable only when: authenticated (student data present), blocked, deactivated, credential ID known
  const canReactivate =
    !reactivated &&
    result?.actionBlocked &&
    result?.credentialStatus === "DEACTIVATED" &&
    !!result?.credential?.id &&
    !!result?.student;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <section className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wide text-blue-600">Safe Student ID</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">NFC wristband verification</h1>
        <div className={`mt-5 rounded-xl border p-4 text-sm font-semibold ${reactivated || result?.valid ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
          {reactivated ? "Credential re-enabled. The wristband is now active." : statusMessage}
        </div>
        {result?.student ? (
          <div className="mt-5 grid gap-3 text-sm">
            <p className="text-lg font-bold text-slate-950">{result.student.name}</p>
            <p className="text-slate-600">{result.student.admissionNumber}</p>
            <p className="text-slate-600">{result.student.className ?? "No class"} / {result.student.streamName ?? "No stream"}</p>
            <p className="text-slate-600">{result.student.schoolName}</p>
          </div>
        ) : null}
        {canReactivate && (
          <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-bold text-slate-900">Re-enable this wristband</p>
            <p className="mt-1 text-xs text-slate-500">This credential is deactivated. Administrators can re-enable it with a reason.</p>
            <textarea
              className="mt-3 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 resize-none min-h-[72px]"
              value={reactivateReason}
              onChange={(e) => setReactivateReason(e.target.value)}
              placeholder="Reason required (e.g. Card found and verified)"
            />
            {reactivateError && <p className="mt-2 text-xs text-red-600">{reactivateError}</p>}
            <button
              type="button"
              onClick={() => void handleReactivate()}
              disabled={reactivateLoading || !reactivateReason.trim()}
              className="mt-3 w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 transition-colors"
            >
              {reactivateLoading ? "Enabling…" : "Re-enable wristband"}
            </button>
          </div>
        )}
        <p className="mt-5 text-xs leading-5 text-slate-500">Public scans show limited verification data only. Wallet, attendance, and gate actions require an authenticated school user.</p>
      </section>
    </main>
  );
}
