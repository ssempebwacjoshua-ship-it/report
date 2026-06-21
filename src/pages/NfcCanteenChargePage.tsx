import { useState } from "react";
import { useParams } from "react-router-dom";
import { chargeNfcCanteen } from "../client/studentCredentialsClient";
import type { NfcCanteenChargeResult } from "../shared/types/studentCredentials";

const inputClass = "premium-control h-12 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none focus:border-blue-400 focus:bg-white";

function money(cents: number) {
  return `UGX ${Math.round(cents / 100).toLocaleString()}`;
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
      {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="premium-card rounded-xl p-4">
          <label className="grid gap-1 text-xs font-bold uppercase text-slate-500">
            Tap Wristband / Scan
            <input className={`${inputClass} h-20 text-lg font-bold`} value={tokenOrUid} onChange={(event) => setTokenOrUid(event.target.value)} placeholder="Tap wristband or paste /nfc/t token" />
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
          <button className="btn btn-primary mt-4 min-h-12 w-full sm:w-auto" type="button" onClick={() => void charge()} disabled={!tokenOrUid.trim() || !Number(amount)}>
            Confirm charge
          </button>
        </div>
        <aside className="premium-card rounded-xl p-4">
          <h2 className="text-base font-bold text-slate-950">Charge result</h2>
          {result ? (
            <div className="mt-3 grid gap-3 text-sm">
              <div className={`rounded-xl border p-3 font-bold ${result.ok ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`}>
                {result.ok ? "Charge successful" : result.reason ?? "Charge blocked"}
              </div>
              {result.student ? <p className="font-bold text-slate-950">{result.student.name} · {result.student.admissionNumber}</p> : null}
              {result.wallet ? <p className="text-slate-700">Wallet balance: {money(result.wallet.balanceCents)} · {result.wallet.status}</p> : null}
              {result.transaction ? <p className="text-slate-700">{money(Math.abs(result.transaction.amountCents))} · {result.transaction.description ?? "Canteen charge"}</p> : null}
            </div>
          ) : <p className="mt-3 text-sm text-slate-500">Tap, enter amount, then confirm. No charge happens on tap alone.</p>}
        </aside>
      </section>
    </main>
  );
}
