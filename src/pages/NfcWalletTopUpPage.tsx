import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { resolveWalletStudent, topUpNfcWallet } from "../client/studentCredentialsClient";
import { fetchStudents } from "../client/studentsClient";
import type {
  NfcStudentSummary,
  NfcWalletStudentResolution,
  NfcWalletTopUpResult,
  WalletPaymentMethod,
} from "../shared/types/studentCredentials";
import type { StudentListItem } from "../shared/types/students";

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
  const [params] = useSearchParams();
  const preselectedStudentId = params.get("studentId") ?? "";

  // ── Student lookup ────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<StudentListItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [resolution, setResolution] = useState<NfcWalletStudentResolution | null>(null);
  const [resolving, setResolving] = useState(false);
  const [lookupError, setLookupError] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Form state ────────────────────────────────────────────────────────────
  const [amountUgx, setAmountUgx] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<WalletPaymentMethod>("CASH");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  // ── Submission state ─────────────────────────────────────────────────────
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<NfcWalletTopUpResult | null>(null);
  const [submitError, setSubmitError] = useState("");

  // ── Pre-select student from URL param ────────────────────────────────────
  useEffect(() => {
    if (!preselectedStudentId) return;
    setResolving(true);
    resolveWalletStudent({ studentId: preselectedStudentId })
      .then((r) => setResolution(r))
      .catch((e: Error) => setLookupError(e.message))
      .finally(() => setResolving(false));
  }, [preselectedStudentId]);

  function handleSearchInput(value: string) {
    setSearchQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!value.trim()) { setSearchResults([]); return; }
    debounceRef.current = setTimeout(() => {
      setSearching(true);
      fetchStudents({ search: value.trim(), isActive: "true" })
        .then((r) => setSearchResults(r.students.slice(0, 8)))
        .catch(() => setSearchResults([]))
        .finally(() => setSearching(false));
    }, 280);
  }

  function selectStudent(student: StudentListItem) {
    setSearchQuery(`${student.studentName} — ${student.admissionNumber}`);
    setSearchResults([]);
    setLookupError("");
    setResult(null);
    setResolving(true);
    resolveWalletStudent({ studentId: student.id })
      .then((r) => setResolution(r))
      .catch((e: Error) => setLookupError(e.message))
      .finally(() => setResolving(false));
  }

  async function handleTopUp() {
    if (!resolution) return;
    const amount = parseFloat(amountUgx);
    if (!isFinite(amount) || amount <= 0) {
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
        setAmountUgx("");
        setReference("");
        setNotes("");
        // Update displayed balance from response
        if (topUpResult.wallet && resolution.wallet) {
          setResolution((prev) => prev && topUpResult.wallet
            ? { ...prev, wallet: { id: topUpResult.wallet.id, balanceCents: topUpResult.wallet.balanceCents, status: topUpResult.wallet.status } }
            : prev
          );
        }
      }
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Top-up failed.");
    } finally {
      setSubmitting(false);
    }
  }

  function handlePrint() {
    window.print();
  }

  function resetPage() {
    setResolution(null);
    setResult(null);
    setSearchQuery("");
    setAmountUgx("");
    setReference("");
    setNotes("");
    setSubmitError("");
    setLookupError("");
  }

  const canSubmit = !!resolution && parseFloat(amountUgx) > 0 && !submitting;

  return (
    <main className="grid gap-5">
      <header className="page-header">
        <p className="text-xs font-bold uppercase tracking-wide text-blue-600">NFC Operations</p>
        <h1 className="text-xl font-bold text-slate-950 sm:text-2xl">Wallet Top-Up</h1>
        <p className="mt-1 text-sm text-slate-500">Add canteen credit to a student wallet.</p>
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        {/* ── Left column: lookup + form ─────────────────────────────── */}
        <div className="grid gap-4">

          {/* Section 1: Student lookup */}
          <section className="premium-card rounded-xl p-5">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">1. Find Student</h2>
            <div className="relative mt-3">
              <input
                type="text"
                className={`${inputClass} w-full`}
                placeholder="Search by name, admission number, class…"
                value={searchQuery}
                onChange={(e) => handleSearchInput(e.target.value)}
                disabled={resolving}
              />
              {searching && <p className="mt-1 text-xs text-slate-400">Searching…</p>}
              {resolving && <p className="mt-1 text-xs text-slate-400">Loading student…</p>}
              {searchResults.length > 0 && (
                <ul className="absolute left-0 right-0 top-full z-10 mt-1 max-h-52 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
                  {searchResults.map((s) => (
                    <li key={s.id}>
                      <button
                        type="button"
                        className="w-full px-3 py-2 text-left text-sm hover:bg-blue-50"
                        onClick={() => selectStudent(s)}
                      >
                        <p className="font-bold text-slate-950">{s.studentName}</p>
                        <p className="text-xs text-slate-500">{s.admissionNumber} — {s.className}/{s.streamName}</p>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {lookupError && <p className="mt-2 text-xs text-red-600">{lookupError}</p>}
          </section>

          {/* Section 2: Student card */}
          {resolution && (
            <StudentCard student={resolution.student} wallet={resolution.wallet} />
          )}

          {/* Section 3: Top-up form */}
          {resolution && !result && (
            <section className="premium-card rounded-xl p-5">
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">3. Top-Up Amount</h2>
              <div className="mt-3 grid gap-3">
                <label className="grid gap-1 text-xs font-bold uppercase text-slate-500">
                  Amount (UGX)
                  <input
                    type="number"
                    min="1"
                    step="500"
                    className={inputClass}
                    placeholder="e.g. 5000"
                    value={amountUgx}
                    onChange={(e) => setAmountUgx(e.target.value)}
                  />
                </label>
                <label className="grid gap-1 text-xs font-bold uppercase text-slate-500">
                  Payment method
                  <select
                    className={inputClass}
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as WalletPaymentMethod)}
                  >
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1 text-xs font-bold uppercase text-slate-500">
                  Reference (optional)
                  <input
                    type="text"
                    className={inputClass}
                    placeholder="Mobile money transaction ID, receipt no."
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                  />
                </label>
                <label className="grid gap-1 text-xs font-bold uppercase text-slate-500">
                  Notes (optional)
                  <input
                    type="text"
                    className={inputClass}
                    placeholder="Internal note"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </label>
              </div>

              {/* Section 4: Confirmation preview */}
              {parseFloat(amountUgx) > 0 && resolution.wallet && (
                <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm">
                  <p className="font-bold text-blue-800">Confirm top-up</p>
                  <div className="mt-2 grid grid-cols-2 gap-1 text-blue-700">
                    <span>Amount</span><span className="font-bold">{money(Math.round(parseFloat(amountUgx) * 100))}</span>
                    <span>Balance before</span><span>{money(resolution.wallet.balanceCents)}</span>
                    <span>Balance after</span><span className="font-bold">{money(resolution.wallet.balanceCents + Math.round(parseFloat(amountUgx) * 100))}</span>
                  </div>
                </div>
              )}
              {parseFloat(amountUgx) > 0 && !resolution.wallet && (
                <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">
                  This student has no wallet yet — one will be created automatically.
                </div>
              )}

              {submitError && <p className="mt-2 text-xs text-red-600">{submitError}</p>}

              <button
                type="button"
                className="btn btn-primary mt-4 min-h-11 w-full"
                onClick={() => void handleTopUp()}
                disabled={!canSubmit}
              >
                {submitting ? "Processing…" : "Add Canteen Credit"}
              </button>
            </section>
          )}
        </div>

        {/* ── Right column: receipt ───────────────────────────────────── */}
        <aside>
          {result?.ok ? (
            <SuccessReceipt result={result} onPrint={handlePrint} onReset={resetPage} />
          ) : (
            <div className="premium-card rounded-xl p-5 text-sm text-slate-500">
              <p className="font-bold text-slate-950">Receipt</p>
              <p className="mt-2">Complete the form to see a receipt here.</p>
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}

function StudentCard({
  student,
  wallet,
}: {
  student: NfcStudentSummary;
  wallet: NfcWalletStudentResolution["wallet"];
}) {
  return (
    <section className="premium-card rounded-xl p-5">
      <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">2. Student Wallet Balance</h2>
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
        <p className="text-xs text-slate-400">Current canteen credit balance</p>
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
          <Row label="Payment method" value={result.transaction.paymentMethod.replace("_", " ")} />
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
