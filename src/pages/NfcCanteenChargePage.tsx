import { useState } from "react";
import { useParams } from "react-router-dom";
import { chargeNfcCanteen } from "../client/studentCredentialsClient";
import type { NfcCanteenChargeResult } from "../shared/types/studentCredentials";

const inputClass = "premium-control h-12 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none focus:border-blue-400 focus:bg-white";

function money(cents: number) {
  return `UGX ${Math.round(cents / 100).toLocaleString()}`;
}

function chargeBlockedMessage(reason?: string) {
  switch (reason) {
    case "insufficient balance": return "Insufficient wallet balance";
    case "wallet frozen": return "Wallet is frozen";
    case "lost or deactivated wristband": return "Wristband is lost or deactivated";
    case "unknown token": return "Wristband not found";
    case "inactive student": return "Student is inactive";
    default: return reason ?? "Charge blocked";
  }
}

export function NfcCanteenChargePage() {
  const { token = "" } = useParams();
  const [tokenOrUid, setTokenOrUid] = useState(token);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [result, setResult] = useState<NfcCanteenChargeResult | null>(null);
  const [error, setError] = useState("");

  async function charge() {
    setError("");
    setResult(null);
    try {
      const amountCents = Math.round(Number(amount) * 100);
      const data = await chargeNfcCanteen({
        tokenOrUid,
        amountCents,
        description,
        idempotencyKey: `${tokenOrUid}:${amountCents}:${description}:${Date.now()}`,
      });
      setResult(data);
      if (data.ok) {
        setTokenOrUid("");
        setAmount("");
        setDescription("");
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not charge wallet");
    }
  }

  return (
    <main className="grid gap-5">
      <header className="page-header">
        <p className="text-xs font-bold uppercase tracking-wide text-blue-600">NFC Operations</p>
        <h1 className="text-xl font-bold text-slate-950 sm:text-2xl">Canteen Charge</h1>
      </header>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="premium-card rounded-xl p-4">
          <label className="grid gap-1 text-xs font-bold uppercase text-slate-500">
            Tap Wristband / Scan
            <input
              className={`${inputClass} h-20 text-xl font-bold tracking-wide`}
              value={tokenOrUid}
              onChange={(event) => setTokenOrUid(event.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && tokenOrUid.trim() && Number(amount)) void charge(); }}
              placeholder="Tap wristband or paste token"
              autoFocus
            />
          </label>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-xs font-bold uppercase text-slate-500">
              Amount (UGX)
              <input className={inputClass} inputMode="numeric" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="2000" />
            </label>
            <label className="grid gap-1 text-xs font-bold uppercase text-slate-500">
              Item / description
              <input className={inputClass} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Lunch" />
            </label>
          </div>
          <button className="btn btn-primary mt-4 min-h-14 w-full text-base font-black" type="button" onClick={() => void charge()} disabled={!tokenOrUid.trim() || !Number(amount)}>
            Confirm charge
          </button>
          {error ? <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
        </div>

        <aside className="premium-card rounded-xl p-4">
          <h2 className="text-base font-bold text-slate-950">Charge result</h2>
          {result ? (
            <div className="mt-3 grid gap-3 text-sm">
              <div className={`rounded-xl border p-4 text-center ${result.ok ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}>
                <p className={`text-2xl font-black ${result.ok ? "text-emerald-700" : "text-red-700"}`}>
                  {result.ok ? "✓ Charged" : "✗ Blocked"}
                </p>
                {!result.ok && <p className="mt-1 text-sm font-semibold text-red-600">{chargeBlockedMessage(result.reason)}</p>}
              </div>
              {!result.ok && result.reason === "insufficient balance" && (
                <p className="text-xs text-red-600">
                  Insufficient wallet credit. <a href="/nfc/wallets/top-up" className="underline font-semibold">Top up wallet →</a>
                </p>
              )}
              {result.student ? (
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="font-bold text-slate-950">{result.student.name}</p>
                  <p className="text-xs text-slate-500">{result.student.admissionNumber}</p>
                </div>
              ) : null}
              {result.wallet ? (
                <p className="text-slate-600">Balance: <span className="font-bold text-slate-950">{money(result.wallet.balanceCents)}</span> · {result.wallet.status}</p>
              ) : null}
              {result.transaction ? (
                <p className="text-slate-600">{money(Math.abs(result.transaction.amountCents))} · {result.transaction.description ?? "Canteen charge"}</p>
              ) : null}
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-500">Tap wristband, enter amount, then confirm. No charge happens on tap alone.</p>
          )}
        </aside>
      </section>
    </main>
  );
}
