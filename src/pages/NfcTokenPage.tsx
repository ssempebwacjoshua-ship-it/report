import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { resolveNfcToken } from "../client/studentCredentialsClient";
import type { NfcTokenResolution } from "../shared/types/studentCredentials";

export function NfcTokenPage() {
  const { token = "" } = useParams();
  const navigate = useNavigate();
  const [result, setResult] = useState<NfcTokenResolution | null>(null);
  const [error, setError] = useState("");

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
    return () => {
      cancelled = true;
    };
  }, [navigate, token]);

  const blocked = error || (!result ? "Checking wristband..." : result.valid ? "Student NFC credential verified." : "This NFC credential cannot be used.");

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <section className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wide text-blue-600">Safe Student ID</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">NFC wristband verification</h1>
        <div className={`mt-5 rounded-xl border p-4 text-sm font-semibold ${result?.valid ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
          {blocked}
        </div>
        {result?.student ? (
          <div className="mt-5 grid gap-3 text-sm">
            <p className="text-lg font-bold text-slate-950">{result.student.name}</p>
            <p className="text-slate-600">{result.student.admissionNumber}</p>
            <p className="text-slate-600">
              {result.student.className ?? "No class"} / {result.student.streamName ?? "No stream"}
            </p>
            <p className="text-slate-600">{result.student.schoolName}</p>
          </div>
        ) : null}
        <p className="mt-5 text-xs leading-5 text-slate-500">Public scans show limited verification data only. Wallet, attendance, and gate actions require an authenticated school user.</p>
      </section>
    </main>
  );
}
