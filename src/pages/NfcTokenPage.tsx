import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { resolveNfcToken } from "../client/studentCredentialsClient";
import type { NfcTokenResolution } from "../shared/types/studentCredentials";

function statusTone(result: NfcTokenResolution | null) {
  if (!result?.found) return "border-red-200 bg-red-50 text-red-700";
  if (result.valid && !result.actionBlocked) return "border-emerald-200 bg-emerald-50 text-emerald-700";
  return "border-amber-200 bg-amber-50 text-amber-800";
}

function statusText(result: NfcTokenResolution | null) {
  if (!result) return "Checking credential...";
  if (!result.found) return "NFC credential not found.";
  if (result.actionBlocked) return "This NFC credential is blocked for actions.";
  if (result.valid) return "Student NFC credential verified.";
  return "This NFC credential cannot be used.";
}

export function NfcTokenPage() {
  const { token = "" } = useParams();
  const navigate = useNavigate();
  const [result, setResult] = useState<NfcTokenResolution | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setError("");
    setResult(null);

    resolveNfcToken(token)
      .then((resolved) => {
        if (cancelled) return;
        setResult(resolved);
        if (resolved.found && resolved.valid && !resolved.actionBlocked && resolved.mode !== "PUBLIC_ID" && resolved.targetPath) {
          navigate(resolved.targetPath, { replace: true });
        }
      })
      .catch((caught: Error) => {
        if (!cancelled) setError(caught.message);
      });

    return () => {
      cancelled = true;
    };
  }, [navigate, token]);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <section className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wide text-blue-600">Student Verification</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">NFC wristband</h1>

        <div className={`mt-5 rounded-xl border p-4 text-sm font-semibold ${statusTone(result)}`}>{error || statusText(result)}</div>

        {result?.student ? (
          <div className="mt-5 grid gap-3 text-sm">
            <div>
              <p className="text-xs font-bold uppercase text-slate-500">Student</p>
              <p className="text-lg font-bold text-slate-950">{result.student.name}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs font-bold uppercase text-slate-500">Admission No.</p>
                <p className="font-semibold text-slate-800">{result.student.admissionNumber}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase text-slate-500">School</p>
                <p className="font-semibold text-slate-800">{result.student.schoolName}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase text-slate-500">Class</p>
                <p className="font-semibold text-slate-800">{result.student.className ?? "Not assigned"}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase text-slate-500">Stream</p>
                <p className="font-semibold text-slate-800">{result.student.streamName ?? "Not assigned"}</p>
              </div>
            </div>
          </div>
        ) : null}

        {result?.credential ? (
          <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-bold uppercase text-slate-500">Credential URL</p>
            <p className="break-all font-mono text-sm text-slate-800">{result.credential.nfcUrl}</p>
          </div>
        ) : null}

        <p className="mt-5 text-xs leading-5 text-slate-500">
          This public page only confirms limited student identity details. Charges, attendance, and gate actions require an authenticated school user
          and backend permission checks.
        </p>
      </section>
    </main>
  );
}
