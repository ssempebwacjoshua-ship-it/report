import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { resolveNfcToken, reactivateStudentCredential } from "../client/studentCredentialsClient";
import { useAuth } from "../contexts/AuthContext";
import { hasPermission } from "../shared/permissions";
import type { NfcTokenResolution } from "../shared/types/studentCredentials";

export function NfcTokenPage() {
  const { token = "" } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
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
        if (
          resolved.valid
          && resolved.student?.id
          && canTopUp
          && resolved.targetPath === `/students/${encodeURIComponent(resolved.student.id)}/wallet/top-up`
        ) {
          navigate(resolved.targetPath, { replace: true });
        }
      })
      .catch((caught: Error) => {
        if (!cancelled) setError(caught.message);
      });
    return () => { cancelled = true; };
  }, [canTopUp, navigate, token]);

  async function handleReactivate() {
    if (!result?.credential?.id || !reactivateReason.trim()) return;
    setReactivateLoading(true);
    setReactivateError("");
    try {
      await reactivateStudentCredential(result.credential.id, reactivateReason.trim());
      setReactivated(true);
    } catch (caught) {
      setReactivateError(caught instanceof Error ? caught.message : "Could not re-enable credential.");
    } finally {
      setReactivateLoading(false);
    }
  }

  const canTopUp = hasPermission(user?.role, "nfc.wallets.topup");
  const canCanteen = hasPermission(user?.role, "nfc.canteen.charge");
  const canGate = hasPermission(user?.role, "nfc.gate.scan");
  const canAttendance = hasPermission(user?.role, "nfc.devices.manage");
  const canViewWallet = hasPermission(user?.role, "nfc.canteen.transactions.view") || canTopUp;

  const studentId = result?.student?.id ?? "";
  const statusMessage = error || !result
    ? "Checking wristband..."
    : result.valid
      ? "Student NFC token resolved."
      : "This NFC token cannot be used.";

  const canReactivate =
    !reactivated &&
    result?.actionBlocked &&
    result?.credentialStatus === "DEACTIVATED" &&
    !!result?.credential?.id &&
    !!result?.student;

  function go(path: string) {
    navigate(path);
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <section className="mx-auto grid w-full max-w-2xl gap-5">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-600">School Connect NFC</p>
          <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950">Tap actions</h1>
          <div className={`mt-4 rounded-2xl border p-4 text-sm font-semibold ${reactivated || result?.valid ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
            {reactivated ? "Credential re-enabled. The wristband is now active." : statusMessage}
          </div>

          {result?.student ? (
            <div className="mt-5 grid gap-2">
              <p className="text-lg font-black text-slate-950">{result.student.name}</p>
              <p className="text-sm text-slate-600">{result.student.admissionNumber}</p>
              <p className="text-sm text-slate-600">{result.student.className ?? "No class"} / {result.student.streamName ?? "No stream"}</p>
              {"schoolName" in result.student ? <p className="text-sm text-slate-600">{result.student.schoolName}</p> : null}
            </div>
          ) : null}

          {result?.student && result.valid && (
            <div className="mt-6 grid gap-2 sm:grid-cols-2">
              <ActionButton
                label="Add Wallet"
                enabled={canTopUp}
                onClick={() => go(`/students/${encodeURIComponent(studentId)}/wallet/top-up`)}
                hint={canTopUp ? "Manual top-up" : "No permission"}
              />
              <ActionButton
                label="Mark Attendance"
                enabled={canAttendance}
                onClick={() => go("/nfc/attendance")}
                hint="Attendance scanner"
              />
              <ActionButton
                label="Gate Check"
                enabled={canGate}
                onClick={() => go(`/gate/nfc/${encodeURIComponent(token)}`)}
                hint="Gate security scan"
              />
              <ActionButton
                label="Canteen Purchase"
                enabled={canCanteen}
                onClick={() => go(`/canteen/nfc/${encodeURIComponent(token)}`)}
                hint="Cashless canteen"
              />
              <ActionButton
                label="View Wallet"
                enabled={canViewWallet}
                onClick={() => go(`/students/${encodeURIComponent(studentId)}/wallet`)}
                hint="Balance and history"
              />
            </div>
          )}

          {canReactivate && (
            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-black text-slate-900">Re-enable this wristband</p>
              <p className="mt-1 text-xs text-slate-500">Administrators can re-enable a deactivated credential with a reason.</p>
              <textarea
                className="mt-3 min-h-[88px] w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400"
                value={reactivateReason}
                onChange={(event) => setReactivateReason(event.target.value)}
                placeholder="Reason required"
              />
              {reactivateError ? <p className="mt-2 text-xs text-red-600">{reactivateError}</p> : null}
              <button
                type="button"
                onClick={() => void handleReactivate()}
                disabled={reactivateLoading || !reactivateReason.trim()}
                className="mt-3 w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-black text-white hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400"
              >
                {reactivateLoading ? "Enabling..." : "Re-enable wristband"}
              </button>
            </div>
          )}

          <p className="mt-5 text-xs leading-5 text-slate-500">
            Wallet top-up is manual in this version. The NFC token only resolves the student. No balance or transaction data is stored on the tag.
          </p>
        </div>
      </section>
    </main>
  );
}

function ActionButton({
  label,
  enabled,
  onClick,
  hint,
}: {
  label: string;
  enabled: boolean;
  onClick: () => void;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!enabled}
      className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <p className="text-sm font-black text-slate-950">{label}</p>
      <p className="mt-1 text-xs text-slate-500">{hint}</p>
    </button>
  );
}
