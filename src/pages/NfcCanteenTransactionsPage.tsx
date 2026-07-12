import { useEffect, useState } from "react";
import { NfcSectionTabs } from "../components/nfc/NfcSectionTabs";
import { getDailySummary, listWalletTransactions, reverseWalletTransaction } from "../client/studentCredentialsClient";
import type { DailySummary, WalletTransactionRow } from "../shared/types/studentCredentials";

const inputClass =
  "premium-control h-9 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none focus:border-blue-400 focus:bg-white";

function money(cents: number) {
  return `UGX ${Math.round(Math.abs(cents) / 100).toLocaleString()}`;
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString();
}

type TxType = WalletTransactionRow["type"];

const TYPE_STYLES: Record<TxType, { bg: string; text: string; label: string }> = {
  TOP_UP:     { bg: "bg-emerald-100", text: "text-emerald-700", label: "Top-Up" },
  CHARGE:     { bg: "bg-red-100",     text: "text-red-700",     label: "Charge" },
  REVERSAL:   { bg: "bg-amber-100",   text: "text-amber-700",   label: "Reversal" },
  ADJUSTMENT: { bg: "bg-blue-100",    text: "text-blue-700",    label: "Adjustment" },
};

function TypeBadge({ type }: { type: TxType }) {
  const s = TYPE_STYLES[type] ?? { bg: "bg-slate-100", text: "text-slate-600", label: type };
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-bold ${s.bg} ${s.text}`}>{s.label}</span>
  );
}

function amountDisplay(row: WalletTransactionRow) {
  const sign = row.amountCents >= 0 ? "+" : "−";
  const color = row.amountCents >= 0 ? "text-emerald-700" : "text-red-700";
  return <span className={`font-bold ${color}`}>{sign}{money(row.amountCents)}</span>;
}

// ─── Reversal modal ───────────────────────────────────────────────────────────

function ReversalModal({
  tx,
  onConfirm,
  onClose,
}: {
  tx: WalletTransactionRow;
  onConfirm: (reason: string) => Promise<void>;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (!reason.trim()) { setError("Reason is required."); return; }
    setLoading(true);
    setError("");
    try {
      await onConfirm(reason.trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reversal failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-base font-black text-slate-950">Reverse transaction</h2>

        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">Student</span>
            <span className="font-bold">{tx.student.name} · {tx.student.admissionNumber}</span>
          </div>
          <div className="mt-1 flex justify-between">
            <span className="text-slate-500">Type</span><TypeBadge type={tx.type} />
          </div>
          <div className="mt-1 flex justify-between">
            <span className="text-slate-500">Amount</span>
            {amountDisplay(tx)}
          </div>
          <div className="mt-1 flex justify-between">
            <span className="text-slate-500">Date</span>
            <span>{fmtDate(tx.createdAt)} {fmtTime(tx.createdAt)}</span>
          </div>
        </div>

        <p className="mt-4 text-xs text-amber-700 font-bold uppercase tracking-wide">
          This will create a reversal transaction restoring {money(Math.abs(tx.amountCents))} to the wallet. It cannot be undone.
        </p>

        <label className="mt-3 grid gap-1 text-xs font-bold uppercase text-slate-500">
          Reason (required)
          <input
            type="text"
            className="premium-control h-10 rounded-xl border border-slate-200 px-3 text-sm"
            placeholder="e.g. Charged by mistake"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            autoFocus
          />
        </label>

        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            className="btn btn-primary flex-1 rounded-xl py-2.5 text-sm font-black"
            disabled={loading || !reason.trim()}
            onClick={() => void submit()}
          >
            {loading ? "Processing…" : "Confirm reversal"}
          </button>
          <button type="button" className="btn btn-secondary flex-1 rounded-xl py-2.5 text-sm" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function NfcCanteenTransactionsPage() {
  const today = new Date().toISOString().slice(0, 10);

  // Summary
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [summaryDate, setSummaryDate] = useState(today);

  // Filters
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  // List
  const [transactions, setTransactions] = useState<WalletTransactionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState("");

  // Reversal
  const [reversalTx, setReversalTx] = useState<WalletTransactionRow | null>(null);
  const [reversedIds, setReversedIds] = useState<Set<string>>(new Set());

  async function loadSummary() {
    try {
      const data = await getDailySummary({ date: summaryDate });
      setSummary(data);
    } catch { /* non-critical */ }
  }

  async function loadTransactions() {
    setLoading(true);
    setListError("");
    try {
      const data = await listWalletTransactions({
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        search: search || undefined,
        type: typeFilter || undefined,
      });
      setTransactions(data.transactions);
    } catch (e) {
      setListError(e instanceof Error ? e.message : "Failed to load transactions.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSummary();
  }, [summaryDate]);

  useEffect(() => {
    void loadTransactions();
  }, []);

  async function handleReverse(tx: WalletTransactionRow) {
    setReversalTx(tx);
  }

  async function confirmReversal(reason: string) {
    if (!reversalTx) return;
    await reverseWalletTransaction(reversalTx.id, reason);
    setReversedIds((prev) => new Set([...prev, reversalTx.id]));
    setReversalTx(null);
    void loadTransactions();
    void loadSummary();
  }

  function canReverse(row: WalletTransactionRow) {
    if (row.type === "REVERSAL") return false;
    if (reversedIds.has(row.id)) return false;
    if (row.reversalOfId) return false; // already a reversal reference
    return true;
  }

  return (
    <main className="grid gap-5">
      <header className="page-header">
        <p className="text-xs font-bold uppercase tracking-wide text-blue-600">Wallets</p>
        <h1 className="text-xl font-bold text-slate-950 sm:text-2xl">Transactions</h1>
      </header>

      <NfcSectionTabs
        tabs={[
          { to: "/nfc/wallets", label: "Wallets" },
          { to: "/nfc/wallets/top-up", label: "Top Up" },
          { to: "/nfc/wallets/transactions", label: "Transactions" },
          { to: "/nfc/wallets/reconcile", label: "Reconcile" },
        ]}
      />

      {/* ── Daily summary cards ─────────────────────────────────────────── */}
      <section>
        <div className="mb-3 flex items-center gap-3">
          <p className="text-sm font-bold text-slate-600">Summary for</p>
          <input
            type="date"
            className={inputClass}
            value={summaryDate}
            onChange={(e) => setSummaryDate(e.target.value)}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard
            label="Today's charges"
            value={summary ? money(summary.summary.totalChargesCents) : "—"}
            sub={`${summary?.summary.chargeCount ?? 0} transactions`}
            color="red"
          />
          <SummaryCard
            label="Today's top-ups"
            value={summary ? money(summary.summary.totalTopUpsCents) : "—"}
            sub={`${summary?.summary.topUpCount ?? 0} transactions`}
            color="green"
          />
          <SummaryCard
            label="Reversals"
            value={`${summary?.summary.reversalCount ?? 0}`}
            sub={summary ? money(summary.summary.totalReversalsCents) : "UGX 0"}
            color="amber"
          />
          <SummaryCard
            label="Net canteen spend"
            value={summary ? money(summary.summary.netSpendCents) : "—"}
            sub="charges minus reversals"
            color="blue"
          />
        </div>
      </section>

      {/* ── Filters ─────────────────────────────────────────────────────── */}
      <section className="premium-card rounded-xl p-4">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <label className="grid gap-1 text-xs font-bold uppercase text-slate-500">
            From
            <input type="date" className={inputClass} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </label>
          <label className="grid gap-1 text-xs font-bold uppercase text-slate-500">
            To
            <input type="date" className={inputClass} value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </label>
          <label className="grid gap-1 text-xs font-bold uppercase text-slate-500">
            Student / admission
            <input className={inputClass} placeholder="Search" value={search} onChange={(e) => setSearch(e.target.value)} />
          </label>
          <label className="grid gap-1 text-xs font-bold uppercase text-slate-500">
            Type
            <select className={inputClass} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="">All types</option>
              <option value="TOP_UP">Top-Up</option>
              <option value="CHARGE">Charge</option>
              <option value="REVERSAL">Reversal</option>
              <option value="ADJUSTMENT">Adjustment</option>
            </select>
          </label>
          <div className="flex items-end">
            <button
              type="button"
              className="btn btn-primary h-9 w-full rounded-xl text-sm font-bold"
              onClick={() => void loadTransactions()}
              disabled={loading}
            >
              {loading ? "Loading…" : "Apply"}
            </button>
          </div>
        </div>
      </section>

      {listError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{listError}</div>
      )}

      {/* ── Transaction table ────────────────────────────────────────────── */}
      <section className="premium-card rounded-xl p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <Th>Time</Th>
                <Th>Student</Th>
                <Th>Admission</Th>
                <Th>Class / Stream</Th>
                <Th>Type</Th>
                <Th>Amount</Th>
                <Th>Balance after</Th>
                <Th>Reference</Th>
                <Th>Actions</Th>
              </tr>
            </thead>
            <tbody>
              {transactions.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-sm text-slate-400">
                    {loading ? "Loading…" : "No transactions found for these filters."}
                  </td>
                </tr>
              )}
              {transactions.map((row) => (
                <tr key={row.id} className={`border-b border-slate-100 last:border-0 ${reversedIds.has(row.id) ? "opacity-50" : ""}`}>
                  <td className="px-4 py-2.5 whitespace-nowrap text-slate-500">
                    <p>{fmtTime(row.createdAt)}</p>
                    <p className="text-xs text-slate-400">{fmtDate(row.createdAt)}</p>
                  </td>
                  <td className="px-4 py-2.5 font-medium text-slate-950 whitespace-nowrap">
                    {row.student.name}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap">{row.student.admissionNumber}</td>
                  <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap">
                    {row.student.className ?? "—"} / {row.student.streamName ?? "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    <TypeBadge type={row.type} />
                    {row.reversalOfId && (
                      <p className="mt-0.5 text-xs text-slate-400">reversal</p>
                    )}
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap">{amountDisplay(row)}</td>
                  <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap">
                    {row.balanceAfterCents !== null ? money(row.balanceAfterCents) : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-slate-500 max-w-[140px] truncate">
                    {row.reference ?? row.description ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <div className="flex gap-1">
                      {canReverse(row) && (
                        <button
                          type="button"
                          className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-bold text-amber-700 hover:bg-amber-100"
                          onClick={() => void handleReverse(row)}
                        >
                          Reverse
                        </button>
                      )}
                      {reversedIds.has(row.id) && (
                        <span className="text-xs text-slate-400 italic">reversed</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {transactions.length > 0 && (
          <p className="px-4 py-2 text-xs text-slate-400 border-t border-slate-100">
            {transactions.length} transaction{transactions.length !== 1 ? "s" : ""}
          </p>
        )}
      </section>

      {/* ── Reversal modal ───────────────────────────────────────────────── */}
      {reversalTx && (
        <ReversalModal
          tx={reversalTx}
          onConfirm={confirmReversal}
          onClose={() => setReversalTx(null)}
        />
      )}
    </main>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-slate-500 whitespace-nowrap">
      {children}
    </th>
  );
}

function SummaryCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub: string;
  color: "red" | "green" | "amber" | "blue";
}) {
  const colorMap = {
    red:   "border-red-100 bg-red-50 text-red-700",
    green: "border-emerald-100 bg-emerald-50 text-emerald-700",
    amber: "border-amber-100 bg-amber-50 text-amber-700",
    blue:  "border-blue-100 bg-blue-50 text-blue-700",
  };
  return (
    <div className={`rounded-xl border p-4 ${colorMap[color]}`}>
      <p className="text-xs font-bold uppercase tracking-wide opacity-70">{label}</p>
      <p className="mt-1 text-2xl font-black">{value}</p>
      <p className="mt-0.5 text-xs opacity-60">{sub}</p>
    </div>
  );
}
