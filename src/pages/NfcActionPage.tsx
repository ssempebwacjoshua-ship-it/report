import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { resolveNfcToken } from "../client/studentCredentialsClient";
import type { NfcTokenMode, NfcTokenResolution } from "../shared/types/studentCredentials";

type NfcActionPageProps = {
  expectedMode: Exclude<NfcTokenMode, "PUBLIC_ID" | "ADMIN_CREDENTIAL">;
  title: string;
  description: string;
};

function blockedMessage(result: NfcTokenResolution | null, expectedMode: NfcActionPageProps["expectedMode"]) {
  if (!result) return "Checking credential and permissions...";
  if (!result.found) return "NFC credential not found.";
  if (result.mode !== expectedMode) return "Your role is not allowed to use this NFC action.";
  if (result.actionBlocked || !result.valid) return "This NFC credential is inactive or blocked.";
  return "";
}

export function NfcActionPage({ expectedMode, title, description }: NfcActionPageProps) {
  const { token = "" } = useParams();
  const [result, setResult] = useState<NfcTokenResolution | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setResult(null);
    setError("");

    resolveNfcToken(token)
      .then((resolved) => {
        if (!cancelled) setResult(resolved);
      })
      .catch((caught: Error) => {
        if (!cancelled) setError(caught.message);
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const blocked = error || blockedMessage(result, expectedMode);
  const ready = result?.found && result.valid && !result.actionBlocked && result.mode === expectedMode;

  return (
    <main className="grid gap-5">
      <header className="page-header">
        <p className="text-xs font-bold uppercase tracking-wide text-blue-600">NFC Scan</p>
        <h1 className="text-xl font-bold tracking-tight text-slate-950 sm:text-2xl">{title}</h1>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </header>

      <section className="premium-card rounded-xl p-4">
        <div className={`rounded-xl border p-4 text-sm font-semibold ${ready ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
          {ready ? "Credential verified for this action." : blocked}
        </div>

        {result?.student ? (
          <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <p className="text-xs font-bold uppercase text-slate-500">Student</p>
              <p className="font-bold text-slate-950">{result.student.name}</p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase text-slate-500">Admission No.</p>
              <p className="font-semibold text-slate-800">{result.student.admissionNumber}</p>
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
        ) : null}

        <p className="mt-4 text-xs leading-5 text-slate-500">
          This screen only resolves the neutral wristband credential and checks role context. Operational actions still require dedicated backend
          permission checks before they can write attendance, gate, or wallet records.
        </p>
      </section>
    </main>
  );
}
