import { useRef, useState } from "react";
import { NfcScanPanel } from "../components/nfc/NfcScanPanel";
import { useNfcScanner, type ScanResult } from "../hooks/useNfcScanner";
import { chargeNfcCanteen } from "../client/studentCredentialsClient";
import type { NfcCanteenChargeResult } from "../shared/types/studentCredentials";

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

export function NfcCanteenChargePage() {
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [result, setResult] = useState<NfcCanteenChargeResult | null>(null);

  // Keep stable ref to amount/description so the scanner callback sees the current values
  const amountRef = useRef(amount);
  amountRef.current = amount;
  const descRef = useRef(description);
  descRef.current = description;

  const handleScan = async ({ tokenOrUid, idempotencyKey, deviceId }: ScanResult) => {
    const amountUgx = Number(amountRef.current);
    if (!amountUgx || amountUgx <= 0) throw new Error("Enter an amount before scanning.");
    const amountCents = Math.round(amountUgx * 100);
    const data = await chargeNfcCanteen({
      tokenOrUid,
      amountCents,
      description: descRef.current || undefined,
      idempotencyKey,
      deviceId,
    });
    setResult(data);
    if (data.ok) {
      setAmount("");
      setDescription("");
    }
  };

  const scanner = useNfcScanner({ onScan: handleScan });

  return (
    <main className="grid gap-5">
      <header className="page-header">
        <p className="text-xs font-bold uppercase tracking-wide text-blue-600">NFC Operations</p>
        <h1 className="text-xl font-bold text-slate-950 sm:text-2xl">Canteen Charge</h1>
      </header>

      <section className="grid gap-4 lg:grid-cols-[380px_minmax(0,1fr)]">
        {/* Left: amount + scanner */}
        <div className="flex flex-col gap-4">
          {/* Amount and description inputs */}
          <div className="premium-card rounded-xl p-4 grid gap-3">
            <label className="grid gap-1 text-xs font-bold uppercase text-slate-500">
              Amount (UGX)
              <input
                className={`${inputClass} text-lg font-bold`}
                inputMode="numeric"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="e.g. 2000"
              />
            </label>
            <label className="grid gap-1 text-xs font-bold uppercase text-slate-500">
              Item / description
              <input
                className={inputClass}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Lunch"
              />
            </label>
            {!Number(amount) && (
              <p className="text-xs text-amber-600">Enter an amount, then scan the student tag.</p>
            )}
          </div>

          {/* NFC Scanner */}
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
        </div>

        {/* Right: result panel */}
        <aside className="premium-card rounded-xl p-4">
          <h2 className="text-base font-bold text-slate-950">Charge result</h2>
          {result ? (
            <div className="mt-3 grid gap-3 text-sm">
              <div
                className={`rounded-xl border p-4 font-bold text-base ${
                  result.ok
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-red-200 bg-red-50 text-red-700"
                }`}
              >
                {result.ok ? "Charge successful" : chargeBlockedMessage(result.reason)}
              </div>
              {!result.ok && result.reason === "insufficient balance" && (
                <p className="text-xs text-red-600">
                  The student wallet does not have enough canteen credit.{" "}
                  <a href="/nfc/wallets/top-up" className="underline">Add credit</a> on the Wallet Top-Up page.
                </p>
              )}
              {result.student && (
                <p className="font-bold text-slate-950">
                  {result.student.name} · {result.student.admissionNumber}
                </p>
              )}
              {result.student && (
                <p className="text-slate-600 text-xs">
                  {result.student.className ?? "No class"} / {result.student.streamName ?? "No stream"}
                </p>
              )}
              {result.wallet && (
                <p className="text-slate-700">
                  Balance: {money(result.wallet.balanceCents)} · {result.wallet.status}
                </p>
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
              Enter an amount above, then tap the student&apos;s NFC tag or enter it manually. No charge happens on tap alone.
            </p>
          )}
        </aside>
      </section>
    </main>
  );
}
