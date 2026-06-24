import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { fetchStudentWallet, topUpNfcWallet } from "../client/studentCredentialsClient";
import type { StudentWalletDetail, WalletPaymentMethod, NfcWalletTopUpResult } from "../shared/types/studentCredentials";

const inputClass =
  "premium-control h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none focus:border-blue-400 focus:bg-white";

const PAYMENT_METHODS: Array<{ value: WalletPaymentMethod; label: string }> = [
  { value: "CASH", label: "Cash" },
  { value: "MOBILE_MONEY", label: "Mobile Money" },
  { value: "PARENT_DEPOSIT", label: "Parent Deposit" },
  { value: "ADJUSTMENT", label: "Adjustment" },
];

function money(cents: number) {
  return `UGX ${Math.round(cents / 100).toLocaleString()}`;
}

export function StudentWalletTopUpPage() {
  const { studentId = "" } = useParams();
  const navigate = useNavigate();
  const [wallet, setWallet] = useState<StudentWalletDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [lookupError, setLookupError] = useState("");
  const [amountUgx, setAmountUgx] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<WalletPaymentMethod>("CASH");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<NfcWalletTopUpResult | null>(null);

  useEffect(() => {
    if (!studentId) {
      setLookupError("Missing student ID.");
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchStudentWallet(studentId)
      .then(setWallet)
      .catch((caught: Error) => setLookupError(caught.message))
      .finally(() => setLoading(false));
  }, [studentId]);

  const amountValue = useMemo(() => Number(amountUgx), [amountUgx]);

  async function handleSubmit() {
    if (!studentId) return;
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      setError("Enter a valid amount greater than zero.");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const idempotencyKey = crypto.randomUUID();
      const response = await topUpNfcWallet({
        studentId,
        amountUgx: amountValue,
        paymentMethod,
        reference: reference.trim() || undefined,
        notes: notes.trim() || undefined,
        idempotencyKey,
      });
      setResult(response);
      setAmountUgx("");
      setReference("");
      setNotes("");
      const refreshed = await fetchStudentWallet(studentId);
      setWallet(refreshed);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Top-up failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="grid gap-5">
      <header className="page-header flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-blue-600">Student Wallet</p>
          <h1 className="text-xl font-bold text-slate-950 sm:text-2xl">Add wallet money</h1>
        </div>
        <Link
          to={`/students/${encodeURIComponent(studentId)}/wallet`}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
        >
          Wallet history
        </Link>
      </header>

      {lookupError ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{lookupError}</div> : null}

      {loading ? (
        <div className="premium-card rounded-2xl p-5 text-sm text-slate-500">Loading wallet…</div>
      ) : wallet ? (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section className="grid gap-4">
            <div className="premium-card rounded-2xl p-5">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Student</p>
              <h2 className="mt-1 text-2xl font-black text-slate-950">{wallet.student.name}</h2>
              <p className="mt-1 text-sm text-slate-600">
                {wallet.student.admissionNumber} · {wallet.student.className ?? "No class"} / {wallet.student.streamName ?? "No stream"}
              </p>
              <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-blue-600">Current balance</p>
                <p className="mt-1 text-3xl font-black text-blue-900">{money(wallet.wallet?.balanceCents ?? 0)}</p>
                <p className="mt-1 text-xs text-blue-700">Manual top-up only. No payment gateway yet.</p>
              </div>
            </div>

            <section className="premium-card rounded-2xl p-5">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Top up form</p>
              <div className="mt-4 grid gap-3">
                <label className="grid gap-1 text-xs font-bold uppercase text-slate-500">
                  Amount (UGX)
                  <input
                    className={inputClass}
                    inputMode="numeric"
                    type="number"
                    min="1"
                    step="1"
                    value={amountUgx}
                    onChange={(event) => setAmountUgx(event.target.value)}
                    placeholder="e.g. 5000"
                  />
                </label>
                <label className="grid gap-1 text-xs font-bold uppercase text-slate-500">
                  Payment method
                  <select
                    className={inputClass}
                    value={paymentMethod}
                    onChange={(event) => setPaymentMethod(event.target.value as WalletPaymentMethod)}
                  >
                    {PAYMENT_METHODS.map((method) => (
                      <option key={method.value} value={method.value}>{method.label}</option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1 text-xs font-bold uppercase text-slate-500">
                  Reference
                  <input
                    className={inputClass}
                    value={reference}
                    onChange={(event) => setReference(event.target.value)}
                    placeholder="Receipt, transaction ID, note"
                  />
                </label>
                <label className="grid gap-1 text-xs font-bold uppercase text-slate-500">
                  Notes
                  <textarea
                    className="premium-control min-h-[88px] rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:bg-white"
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder="Optional internal note"
                  />
                </label>
              </div>

              {amountValue > 0 && (
                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
                  <p className="font-bold text-slate-900">Preview</p>
                  <div className="mt-2 grid grid-cols-2 gap-y-1 text-slate-700">
                    <span>Amount</span>
                    <span className="text-right font-bold">{money(Math.round(amountValue * 100))}</span>
                    <span>Balance before</span>
                    <span className="text-right">{money(wallet.wallet?.balanceCents ?? 0)}</span>
                    <span>Balance after</span>
                    <span className="text-right font-bold">{money((wallet.wallet?.balanceCents ?? 0) + Math.round(amountValue * 100))}</span>
                  </div>
                </div>
              )}

              {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

              <button
                type="button"
                className="btn btn-primary mt-4 min-h-11 w-full"
                disabled={submitting || !amountValue || amountValue <= 0}
                onClick={() => void handleSubmit()}
              >
                {submitting ? "Saving…" : "Confirm Add Wallet"}
              </button>
            </section>
          </section>

          <aside className="grid gap-4">
            <div className="premium-card rounded-2xl p-5">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Receipt</p>
              {result?.ok ? (
                <div className="mt-3 grid gap-2 text-sm">
                  <p className="font-bold text-emerald-700">Top-up successful</p>
                  <p>New balance: <span className="font-bold">{money(result.wallet?.balanceCents ?? 0)}</span></p>
                  {result.transaction?.id ? <p>Reference number: {result.transaction.id}</p> : null}
                  {result.transaction?.reference ? <p>Payment reference: {result.transaction.reference}</p> : null}
                  {result.transaction?.paymentMethod ? <p>Method: {result.transaction.paymentMethod.replaceAll("_", " ")}</p> : null}
                </div>
              ) : (
                <p className="mt-3 text-sm text-slate-500">Confirm a top-up to generate a receipt.</p>
              )}
            </div>

            <div className="premium-card rounded-2xl p-5">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Quick links</p>
              <div className="mt-3 grid gap-2">
                <Link
                  to={`/students/${encodeURIComponent(studentId)}/wallet`}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-center text-sm font-bold text-slate-700 hover:bg-slate-50"
                >
                  View wallet history
                </Link>
                <Link
                  to="/nfc/canteen"
                  className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-center text-sm font-bold text-slate-700 hover:bg-slate-50"
                >
                  Canteen Purchase
                </Link>
                <Link
                  to="/nfc/gate"
                  className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-center text-sm font-bold text-slate-700 hover:bg-slate-50"
                >
                  Gate Check
                </Link>
              </div>
            </div>
          </aside>
        </div>
      ) : null}
    </main>
  );
}
