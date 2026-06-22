import { useRef, useState } from "react";
import { NfcScanPanel } from "../components/nfc/NfcScanPanel";
import { useNfcScanner, type ScanResult } from "../hooks/useNfcScanner";
import { chargeNfcCanteen, resolveWalletStudent } from "../client/studentCredentialsClient";
import type { NfcCanteenChargeResult, NfcWalletStudentResolution } from "../shared/types/studentCredentials";

const inputClass =
  "premium-control h-12 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none focus:border-blue-400 focus:bg-white";

function money(cents: number) {
  return `UGX ${Math.round(cents / 100).toLocaleString()}`;
}

function chargeBlockedMessage(reason?: string) {
  switch (reason) {
    case "insufficient balance": return "Insufficient wallet balance";
    case "wallet frozen": return "Wallet is frozen";
    case "lost or deactivated wristband": return "Wristband is lost or deactivated";
    case "unknown token": return "Tag not found";
    case "inactive student": return "Student is inactive";
    default: return reason ?? "Charge blocked";
  }
}

type Phase = "setup" | "pin" | "done";

type PendingCharge = {
  tokenOrUid: string;
  idempotencyKey?: string;
  deviceId?: string;
  student: NfcWalletStudentResolution;
};

export function NfcCanteenChargePage() {
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [phase, setPhase] = useState<Phase>("setup");
  const [pending, setPending] = useState<PendingCharge | null>(null);
  const [pin, setPin] = useState("");
  const [chargeLoading, setChargeLoading] = useState(false);
  const [chargeError, setChargeError] = useState("");
  const [result, setResult] = useState<NfcCanteenChargeResult | null>(null);

  // Stable refs so scanner callbacks see current values
  const amountRef = useRef(amount);
  amountRef.current = amount;
  const descRef = useRef(description);
  descRef.current = description;

  const handleScan = async ({ tokenOrUid, idempotencyKey, deviceId }: ScanResult) => {
    const amountUgx = Number(amountRef.current);
    if (!amountUgx || amountUgx <= 0) throw new Error("Enter an amount before scanning.");
    // Resolve student+wallet so we can show their info before asking for PIN
    const studentData = await resolveWalletStudent({ tokenOrUid });
    setPending({ tokenOrUid, idempotencyKey, deviceId, student: studentData });
    setPin("");
    setChargeError("");
    setPhase("pin");
  };

  const scanner = useNfcScanner({ onScan: handleScan });

  async function submitCharge() {
    if (!pending || !pin) return;
    const amountUgx = Number(amount);
    if (!amountUgx || amountUgx <= 0) { setChargeError("Invalid amount."); return; }
    setChargeLoading(true);
    setChargeError("");
    try {
      const data = await chargeNfcCanteen({
        tokenOrUid: pending.tokenOrUid,
        amountCents: Math.round(amountUgx * 100),
        pin,
        description: description || undefined,
        idempotencyKey: pending.idempotencyKey,
        deviceId: pending.deviceId,
      });
      setResult(data);
      setPhase("done");
      if (data.ok) {
        setAmount("");
        setDescription("");
      }
    } catch (e) {
      setChargeError(e instanceof Error ? e.message : "Charge failed.");
    } finally {
      setPin(""); // always clear PIN after attempt regardless of outcome
      setChargeLoading(false);
    }
  }

  function reset() {
    setPhase("setup");
    setPending(null);
    setPin("");
    setChargeError("");
    setResult(null);
    scanner.stopScanner();
  }

  return (
    <main className="grid gap-5">
      <header className="page-header">
        <p className="text-xs font-bold uppercase tracking-wide text-blue-600">NFC Operations</p>
        <h1 className="text-xl font-bold text-slate-950 sm:text-2xl">Canteen Charge</h1>
      </header>

      <section className="grid gap-4 lg:grid-cols-[380px_minmax(0,1fr)]">
        {/* Left column */}
        <div className="flex flex-col gap-4">
          {/* Amount + description — always visible */}
          <div className="premium-card rounded-xl p-4 grid gap-3">
            <label className="grid gap-1 text-xs font-bold uppercase text-slate-500">
              Amount (UGX)
              <input
                className={`${inputClass} text-lg font-bold`}
                inputMode="numeric"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="e.g. 2000"
                disabled={phase !== "setup"}
              />
            </label>
            <label className="grid gap-1 text-xs font-bold uppercase text-slate-500">
              Item / description
              <input
                className={inputClass}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Lunch"
                disabled={phase !== "setup"}
              />
            </label>
            {phase === "setup" && !Number(amount) && (
              <p className="text-xs text-amber-600">Enter an amount, then scan the student tag.</p>
            )}
          </div>

          {/* Phase: setup — show NFC scanner */}
          {phase === "setup" && (
            <NfcScanPanel
              state={scanner.state}
              error={scanner.error}
              isOnline={scanner.isOnline}
              isWebNfcAvailable={scanner.isWebNfcAvailable}
              onStart={scanner.startScanner}
              onStop={scanner.stopScanner}
              onManualSubmit={scanner.submitManual}
              scanLabel="Scan Student Tag"
            />
          )}

          {/* Phase: pin — show student card + PIN entry */}
          {phase === "pin" && pending && (
            <div className="premium-card rounded-xl p-4 grid gap-4">
              <div className="rounded-xl border border-blue-100 bg-blue-50 p-3">
                <p className="text-xs font-bold uppercase text-blue-600">Student identified</p>
                <p className="mt-1 font-bold text-slate-950">{pending.student.student?.name ?? "Unknown"}</p>
                {pending.student.student && (
                  <p className="text-xs text-slate-600">
                    {pending.student.student.admissionNumber} · {pending.student.student.className ?? "No class"}
                  </p>
                )}
                {pending.student.wallet && (
                  <p className="mt-1 text-sm font-bold text-slate-900">
                    Balance: {money(pending.student.wallet.balanceCents)}
                    {pending.student.wallet.status === "FROZEN" && (
                      <span className="ml-2 text-xs font-normal text-red-600">(frozen)</span>
                    )}
                  </p>
                )}
              </div>

              <div className="grid gap-2">
                <label className="text-xs font-bold uppercase text-slate-500">Student enters PIN</label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  className={`${inputClass} text-center text-xl tracking-widest`}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="••••"
                  // eslint-disable-next-line jsx-a11y/no-autofocus
                  autoFocus
                  autoComplete="off"
                />
              </div>

              {chargeError && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{chargeError}</div>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  className="flex-1 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 transition-colors"
                  disabled={pin.length < 4 || chargeLoading}
                  onClick={() => void submitCharge()}
                >
                  {chargeLoading ? "Processing…" : `Charge ${money(Math.round(Number(amount) * 100))}`}
                </button>
                <button
                  type="button"
                  className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
                  onClick={reset}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Phase: done — new charge button */}
          {phase === "done" && (
            <button
              type="button"
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
              onClick={reset}
            >
              New charge
            </button>
          )}
        </div>

        {/* Right: result panel */}
        <aside className="premium-card rounded-xl p-4">
          <h2 className="text-base font-bold text-slate-950">Charge result</h2>
          {result ? (
            <div className="mt-3 grid gap-3 text-sm">
              <div className={`rounded-xl border p-4 font-bold text-base ${result.ok ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`}>
                {result.ok ? "Charge successful" : chargeBlockedMessage(result.reason)}
              </div>
              {!result.ok && result.reason === "insufficient balance" && (
                <p className="text-xs text-red-600">
                  The student wallet does not have enough canteen credit.{" "}
                  <a href="/nfc/wallets/top-up" className="underline">Add credit</a> on the Wallet Top-Up page.
                </p>
              )}
              {result.student && (
                <p className="font-bold text-slate-950">{result.student.name} · {result.student.admissionNumber}</p>
              )}
              {result.student && (
                <p className="text-slate-600 text-xs">{result.student.className ?? "No class"} / {result.student.streamName ?? "No stream"}</p>
              )}
              {result.wallet && (
                <p className="text-slate-700">Balance: {money(result.wallet.balanceCents)} · {result.wallet.status}</p>
              )}
              {result.transaction && (
                <p className="text-slate-700">
                  Charged: {money(Math.abs(result.transaction.amountCents))}
                  {result.transaction.description ? ` · ${result.transaction.description}` : ""}
                </p>
              )}
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-500">
              {phase === "setup" && "Enter an amount, then tap the student's NFC tag. The student will enter their PIN before the charge is processed."}
              {phase === "pin" && "Waiting for PIN entry…"}
            </p>
          )}
        </aside>
      </section>
    </main>
  );
}
