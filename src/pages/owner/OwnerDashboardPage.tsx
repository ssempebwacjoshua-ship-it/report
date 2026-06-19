import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  confirmOwnerSmartPagesPayment,
  fetchOwnerDashboard,
  fetchOwnerSmartPagesPayments,
  fetchOwnerSmartPagesUsage,
  rejectOwnerSmartPagesPayment,
  type OwnerDashboardStats,
} from "../../client/ownerClient";
import type { SmartPagesAdminLedgerRow, SmartPagesPaymentRequest } from "../../shared/types/smartPages";

function StatCard({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="premium-card rounded-xl p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-black text-slate-950">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-400">{sub}</p>}
    </div>
  );
}

function formatUgx(value: number): string {
  return `UGX ${Math.round(value).toLocaleString()}`;
}

function formatTokenUsage(value: Record<string, unknown> | null | undefined): string {
  if (!value) return "-";
  const total = value.totalTokenCount ?? value.totalTokens;
  return typeof total === "number" ? total.toLocaleString() : JSON.stringify(value);
}

export function OwnerDashboardPage() {
  const [stats, setStats] = useState<OwnerDashboardStats | null>(null);
  const [payments, setPayments] = useState<SmartPagesPaymentRequest[]>([]);
  const [usage, setUsage] = useState<Array<SmartPagesAdminLedgerRow & { schoolName?: string; schoolId: string }>>([]);
  const [error, setError] = useState("");
  const [paymentError, setPaymentError] = useState("");
  const [busyPaymentId, setBusyPaymentId] = useState<string | null>(null);

  useEffect(() => {
    fetchOwnerDashboard()
      .then(setStats)
      .catch((e: Error) => setError(e.message));
    fetchOwnerSmartPagesPayments("PENDING")
      .then((data) => setPayments(data.payments))
      .catch((e: Error) => setPaymentError(e.message));
    fetchOwnerSmartPagesUsage()
      .then((data) => setUsage(data.ledger))
      .catch(() => setUsage([]));
  }, []);

  async function refreshPayments() {
    const data = await fetchOwnerSmartPagesPayments("PENDING");
    setPayments(data.payments);
  }

  async function decidePayment(paymentId: string, action: "confirm" | "reject") {
    setBusyPaymentId(paymentId);
    setPaymentError("");
    try {
      if (action === "confirm") await confirmOwnerSmartPagesPayment(paymentId);
      else await rejectOwnerSmartPagesPayment(paymentId);
      await refreshPayments();
    } catch (e) {
      setPaymentError(e instanceof Error ? e.message : "Could not update payment.");
    } finally {
      setBusyPaymentId(null);
    }
  }

  if (error) {
    return (
      <div className="premium-card rounded-xl p-5">
        <p className="text-sm font-bold text-red-700">Could not load dashboard</p>
        <p className="mt-1 text-xs text-slate-500">{error}</p>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <div>
        <h2 className="text-lg font-black text-slate-950">Overview</h2>
        <p className="text-sm text-slate-500">Real-time stats across all schools.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total schools" value={stats ? stats.totalSchools : "?"} />
        <StatCard label="Active subscriptions" value={stats ? stats.activeSchools : "?"} />
        <StatCard label="Expired / suspended" value={stats ? stats.expiredSchools + stats.suspendedSchools : "?"} />
        <StatCard label="No subscription" value={stats ? stats.noSubscriptionSchools : "?"} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <StatCard label="Total users (all schools)" value={stats ? stats.totalUsers : "?"} />
        <div className="premium-card rounded-xl p-4 flex items-center gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Quick links</p>
            <div className="mt-2 flex flex-col gap-1">
              <Link to="/owner/schools" className="text-sm font-semibold text-blue-600 hover:underline">Manage schools ?</Link>
              <Link to="/owner/users" className="text-sm font-semibold text-blue-600 hover:underline">Manage users ?</Link>
            </div>
          </div>
        </div>
      </div>

      {stats?.recentSchools && stats.recentSchools.length > 0 && (
        <section className="premium-card rounded-xl p-4">
          <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">Recently onboarded schools</p>
          <ul className="divide-y divide-slate-100">
            {stats.recentSchools.map((s) => (
              <li key={s.id} className="flex items-center justify-between py-2 text-sm">
                <span className="font-semibold text-slate-900">{s.name}</span>
                <span className="font-mono text-xs text-slate-400">{s.code}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="premium-card rounded-xl p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Smart Pages payment review</p>
            <h3 className="text-base font-black text-slate-950">Pending Mobile Money confirmations</h3>
          </div>
          <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700">{payments.length} pending</span>
        </div>
        {paymentError ? <p className="mb-3 rounded-lg bg-red-50 p-2 text-sm text-red-700">{paymentError}</p> : null}
        {payments.length === 0 ? (
          <p className="text-sm text-slate-500">No pending Smart Pages payments.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2">School</th>
                  <th className="px-3 py-2">Network</th>
                  <th className="px-3 py-2">Merchant</th>
                  <th className="px-3 py-2">Transaction</th>
                  <th className="px-3 py-2">Payer phone</th>
                  <th className="px-3 py-2">Amount</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.map((payment) => (
                  <tr key={payment.id}>
                    <td className="px-3 py-2 font-semibold text-slate-900">{payment.schoolName ?? payment.schoolId}</td>
                    <td className="px-3 py-2">{payment.network}</td>
                    <td className="px-3 py-2 font-mono text-xs">{payment.merchantCode}</td>
                    <td className="px-3 py-2 font-mono text-xs">{payment.transactionId ?? "Not submitted"}</td>
                    <td className="px-3 py-2">{payment.payerPhone ?? "-"}</td>
                    <td className="px-3 py-2 font-bold">{formatUgx(payment.amountUgx)}</td>
                    <td className="px-3 py-2">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                          disabled={busyPaymentId === payment.id || !payment.transactionId}
                          onClick={() => void decidePayment(payment.id, "confirm")}
                        >
                          Confirm
                        </button>
                        <button
                          type="button"
                          className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-bold text-red-700 disabled:opacity-50"
                          disabled={busyPaymentId === payment.id}
                          onClick={() => void decidePayment(payment.id, "reject")}
                        >
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="premium-card rounded-xl p-4">
        <div className="mb-3">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Internal Smart Pages usage</p>
          <h3 className="text-base font-black text-slate-950">Model, token, cost, and margin estimates</h3>
        </div>
        {usage.length === 0 ? (
          <p className="text-sm text-slate-500">No Smart Pages usage recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2">School</th>
                  <th className="px-3 py-2">Operation</th>
                  <th className="px-3 py-2">Credits</th>
                  <th className="px-3 py-2">Model</th>
                  <th className="px-3 py-2">Tokens</th>
                  <th className="px-3 py-2">Gemini cost</th>
                  <th className="px-3 py-2">Margin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {usage.slice(0, 12).map((row) => (
                  <tr key={row.id ?? `${row.schoolId}-${row.createdAt}`}>
                    <td className="px-3 py-2 font-semibold text-slate-900">{row.schoolName ?? row.schoolId}</td>
                    <td className="px-3 py-2">{row.operation}</td>
                    <td className="px-3 py-2">{row.creditsUsed}</td>
                    <td className="px-3 py-2 font-mono text-xs">{row.model || "-"}</td>
                    <td className="px-3 py-2 font-mono text-xs">{formatTokenUsage(row.tokenUsage)}</td>
                    <td className="px-3 py-2">{row.geminiCostEstimateUgx == null ? "-" : formatUgx(row.geminiCostEstimateUgx)}</td>
                    <td className="px-3 py-2">{row.marginEstimateUgx == null ? "-" : formatUgx(row.marginEstimateUgx)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Surface the fake-number warning as a dummy ? this card pulls real API data */}
      {stats === null && !error && (
        <div className="text-center py-8 text-sm text-slate-400">Loading...</div>
      )}
    </div>
  );
}

