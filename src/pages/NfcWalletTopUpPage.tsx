import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { NfcSectionTabs } from "../components/nfc/NfcSectionTabs";
import { NfcScanPanel } from "../components/nfc/NfcScanPanel";
import { useNfcScanner, type ScanResult } from "../hooks/useNfcScanner";
import { resolveWalletStudent, topUpNfcWallet } from "../client/studentCredentialsClient";
import type { NfcWalletStudentResolution, NfcWalletTopUpResult, WalletPaymentMethod } from "../shared/types/studentCredentials";

const inputClass =
  "premium-control h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none focus:border-blue-400 focus:bg-white";

function money(cents: number) {
  return `UGX ${Math.round(cents / 100).toLocaleString()}`;
}

const PAYMENT_METHODS: { value: WalletPaymentMethod; label: string }[] = [
  { value: "CASH", label: "Cash" },
  { value: "MOBILE_MONEY", label: "Mobile Money" },
  { value: "PARENT_DEPOSIT", label: "Parent Deposit" },
  { value: "ADJUSTMENT", label: "Adjustment" },
];

export function NfcWalletTopUpPage() {
  const [amountUgx, setAmountUgx] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<WalletPaymentMethod>("CASH");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [resolution, setResolution] = useState<NfcWalletStudentResolution | null>(null);
  const [loadingResolution, setLoadingResolution] = useState(false);
  const [lookupError, setLookupError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [result, setResult] = useState<NfcWalletTopUpResult | null>(null);

  const amountRef = useRef(amountUgx);
  amountRef.current = amountUgx;

  const handleScan = async ({ tokenOrUid }: ScanResult) => {
    const amount = Number(amountRef.current);
    if (!amount || amount <= 0) throw new Error("Enter an amount before scanning.");

    setLoadingResolution(true);
    setLookupError("");
    setResult(null);
    try {
      const student = await resolveWalletStudent({ tokenOrUid });
      setResolution(student);
    } finally {
      setLoadingResolution(false);
    }
  };

  const scanner = useNfcScanner({ onScan: handleScan });

  async function handleTopUp() {
    if (!resolution) return;
    const amount = Number(amountUgx);
    if (!amount || amount <= 0) {
      setSubmitError("Please enter a valid amount greater than zero.");
      return;
    }

    setSubmitting(true);
    setSubmitError("");
    setResult(null);
    try {
      const topUpResult = await topUpNfcWallet({
        studentId: resolution.student.id,
        amountUgx: amount,
        paymentMethod,
        reference: reference.trim() || undefined,
        notes: notes.trim() || undefined,
        idempotencyKey: `${resolution.student.id}:${amount}:${paymentMethod}:${Date.now()}`,
      });
      setResult(topUpResult);
      if (topUpResult.ok) {
        if (topUpResult.wallet) {
          setResolution((prev) => prev
            ? { ...prev, wallet: { id: topUpResult.wallet.id, balanceCents: topUpResult.wallet.balanceCents, status: topUpResult.wallet.status, pinSet: prev.wallet?.pinSet ?? false } }
            : prev);
        }
        setAmountUgx("");
        setReference("");
        setNotes("");
      }
    } catch (caught) {
      setSubmitError(caught instanceof Error ? caught.message : "Top-up failed.");
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setResolution(null);
    setResult(null);
    setLookupError("");
    setSubmitError("");
    setAmountUgx("");
    setReference("");
    setNotes("");
    scanner.stopScanner();
  }

  return (
    <main className="grid gap-5">
      <header className="page-header">
        <p className="text-xs font-bold uppercase tracking-wide text-blue-600">Wallets</p>
        <h1 className="text-xl font-bold text-slate-950 sm:text-2xl">Top Up</h1>
        <p className="mt-1 text-sm text-slate-500">Scan a student tag, then add wallet money manually.</p>
      </header>

      <NfcSectionTabs
        tabs={[
          { to: "/nfc/wallets", label: "Wallets" },
          { to: "/nfc/wallets/top-up", label: "Top Up" },
          { to: "/nfc/wallets/transactions", label: "Transactions" },
          { to: "/nfc/wallets/reconcile", label: "Reconcile" },
        ]}
      />

      <section className="grid gap-4 lg:grid-cols-[380px_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          <div className="premium-card rounded-xl p-4 grid gap-3">
            <label className="grid gap-1 text-xs font-bold uppercase text-slate-500">
              Amount (UGX)
              <input
                className={`${inputClass} text-lg font-bold`}
                inputMode="numeric"
                value={amountUgx}
                onChange={(e) => setAmountUgx(e.target.value)}
                placeholder="e.g. 5000"
                disabled={submitting}
              />
            </label>
            <label className="grid gap-1 text-xs font-bold uppercase text-slate-500">
              Payment method
              <select
                className={inputClass}
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as WalletPaymentMethod)}
                disabled={submitting}
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
                onChange={(e) => setReference(e.target.value)}
                placeholder="Receipt / transaction ID"
                disabled={submitting}
              />
            </label>
            <label className="grid gap-1 text-xs font-bold uppercase text-slate-500">
              Notes
              <input
                className={inputClass}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional note"
                disabled={submitting}
              />
            </label>
          </div>

          <NfcScanPanel
            state={scanner.state}
            error={lookupError || scanner.error}
            isOnline={scanner.isOnline}
            isWebNfcAvailable={scanner.isWebNfcAvailable}
            onStart={scanner.startScanner}
            onStop={scanner.stopScanner}
            onManualSubmit={scanner.submitManual}
            scanLabel="Scan Student Tag"
          />

          {loadingResolution && (
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">
              Resolving student...
            </div>
          )}
        </div>

        <aside className="grid gap-4">
          {resolution ? (
            <StudentCard student={resolution.student} wallet={resolution.wallet} />
          ) : (
            <div className="premium-card rounded-xl p-5 text-sm text-slate-500">
              <p className="font-bold text-slate-950">Student details</p>
              <p className="mt-2">Scan a tag to load the student wallet before top-up.</p>
            </div>
          )}

          {resolution && !result && (
            <section className="premium-card rounded-xl p-5">
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Confirm top-up</h2>
              <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm">
                <div className="grid grid-cols-2 gap-1 text-blue-700">
                  <span>Amount</span><span className="font-bold">{money(Math.round(Number(amountUgx || 0) * 100))}</span>
                  <span>Balance before</span><span>{money(resolution.wallet?.balanceCents ?? 0)}</span>
                  <span>Balance after</span><span className="font-bold">{money((resolution.wallet?.balanceCents ?? 0) + Math.round(Number(amountUgx || 0) * 100))}</span>
                </div>
              </div>

              {submitError && <p className="mt-2 text-xs text-red-600">{submitError}</p>}

              <button
                type="button"
                className="btn btn-primary mt-4 min-h-11 w-full"
                onClick={() => void handleTopUp()}
                disabled={submitting || Number(amountUgx) <= 0}
              >
                {submitting ? "Processing…" : "Add Wallet"}
              </button>
            </section>
          )}

          {result?.ok ? (
            <SuccessReceipt result={result} onPrint={() => window.print()} onReset={reset} />
          ) : (
            <div className="premium-card rounded-xl p-5 text-sm text-slate-500">
              <p className="font-bold text-slate-950">Receipt</p>
              <p className="mt-2">Complete a top-up to generate a receipt.</p>
            </div>
          )}

          <div className="flex gap-2">
            <Link
              to="/nfc/wallets"
              className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-center text-sm font-bold text-slate-700 hover:bg-slate-50"
            >
              Wallet List
            </Link>
            <button
              type="button"
              className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
              onClick={reset}
            >
              Reset
            </button>
          </div>
        </aside>
      </section>
    </main>
  );
}

function StudentCard({
  student,
  wallet,
}: {
  student: NfcWalletStudentResolution["student"];
  wallet: NfcWalletStudentResolution["wallet"];
}) {
  return (
    <section className="premium-card rounded-xl p-5">
      <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Student Wallet</h2>
      <div className="mt-3 grid gap-1 text-sm">
        <p className="text-lg font-bold text-slate-950">{student.name}</p>
        <p className="text-slate-600">{student.admissionNumber} — {student.className ?? "No class"} / {student.streamName ?? "No stream"}</p>
        <div className="mt-3 flex items-baseline gap-2">
          <p className="text-3xl font-black text-slate-950">
            {wallet ? money(wallet.balanceCents) : "UGX 0"}
          </p>
          {wallet?.status === "FROZEN" && (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">FROZEN</span>
          )}
          {!wallet && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">No wallet yet</span>
          )}
        </div>
      </div>
    </section>
  );
}

function SuccessReceipt({
  result,
  onPrint,
  onReset,
}: {
  result: NfcWalletTopUpResult;
  onPrint: () => void;
  onReset: () => void;
}) {
  const now = result.transaction?.createdAt
    ? new Date(result.transaction.createdAt).toLocaleString()
    : new Date().toLocaleString();

  return (
    <div className="print:shadow-none rounded-xl border border-emerald-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100">
          <span className="text-emerald-700 text-sm font-bold">✓</span>
        </div>
        <p className="text-sm font-bold text-emerald-700">{result.duplicate ? "Already processed (duplicate)" : "Top-up successful"}</p>
      </div>

      <div className="mt-4 grid gap-2 text-sm">
        {result.student && (
          <>
            <Row label="Student" value={result.student.name} />
            <Row label="Admission no." value={result.student.admissionNumber} />
          </>
        )}
        {result.transaction && (
          <Row label="Amount added" value={money(result.transaction.amountCents)} bold />
        )}
        {result.wallet && (
          <Row label="New balance" value={money(result.wallet.balanceCents)} bold />
        )}
        {result.walletBefore && result.wallet && (
          <Row label="Previous balance" value={money(result.walletBefore.balanceCents)} />
        )}
        {result.transaction?.paymentMethod && (
          <Row label="Payment method" value={result.transaction.paymentMethod.replaceAll("_", " ")} />
        )}
        {result.transaction?.reference && (
          <Row label="Reference" value={result.transaction.reference} />
        )}
        <Row label="Date / time" value={now} />
      </div>

      <div className="mt-4 flex gap-2 print:hidden">
        <button type="button" className="btn btn-secondary flex-1 rounded-xl py-2 text-sm" onClick={onPrint}>
          Print receipt
        </button>
        <button type="button" className="btn btn-primary flex-1 rounded-xl py-2 text-sm" onClick={onReset}>
          New top-up
        </button>
      </div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between gap-2 border-b border-slate-100 py-1.5 last:border-0">
      <span className="text-slate-500">{label}</span>
      <span className={bold ? "font-bold text-slate-950" : "text-slate-700"}>{value}</span>
    </div>
  );
}
