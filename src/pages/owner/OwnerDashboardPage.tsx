import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import {
  confirmOwnerSmartPagesPayment,
  fetchOwnerDashboard,
  fetchOwnerSmartPagesPayments,
  fetchOwnerSmartPagesUsage,
  rejectOwnerSmartPagesPayment,
  type OwnerDashboardStats,
} from "../../client/ownerClient";
import type { SmartPagesAdminLedgerRow, SmartPagesPaymentRequest } from "../../shared/types/smartPages";

type UsageRow = SmartPagesAdminLedgerRow & { schoolName?: string; schoolId: string };

function StatCard({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-black tracking-tight text-slate-950">{value}</p>
      {sub ? <p className="mt-1 text-xs text-slate-500">{sub}</p> : null}
    </div>
  );
}

function formatUgx(value: number): string {
  return `UGX ${Math.round(value).toLocaleString("en-UG")}`;
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("en-UG", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTokenUsage(value: Record<string, unknown> | null | undefined): string {
  if (!value) return "-";
  const total = value.totalTokenCount ?? value.totalTokens;
  return typeof total === "number" ? total.toLocaleString("en-UG") : "View details";
}

function operationLabel(operation: string): string {
  const labels: Record<string, string> = {
    EXTRACT: "Extract",
    HIGH_ACCURACY_EXTRACT: "High accuracy",
    GENERATE_DOCUMENT: "Generate",
    PUBLISH_DOCUMENT: "Publish",
    TOP_UP: "Top-up",
    REFUND: "Refund",
  };
  return labels[operation] ?? operation;
}

function statusClasses(status: string): string {
  const map: Record<string, string> = {
    CHARGED: "border-emerald-200 bg-emerald-50 text-emerald-700",
    REFUNDED: "border-blue-200 bg-blue-50 text-blue-700",
    FAILED: "border-red-200 bg-red-50 text-red-700",
    PENDING: "border-amber-200 bg-amber-50 text-amber-700",
    CONFIRMED: "border-emerald-200 bg-emerald-50 text-emerald-700",
    REJECTED: "border-red-200 bg-red-50 text-red-700",
  };
  return map[status] ?? "border-slate-200 bg-slate-50 text-slate-500";
}

function OperationChip({ operation }: { operation: string }) {
  return (
    <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-700">
      {operationLabel(operation)}
    </span>
  );
}

function StatusChip({ status }: { status: string }) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.16em] ${statusClasses(status)}`}>
      {status}
    </span>
  );
}

function MobileDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-0.5 break-words text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function UsageCard({ row }: { row: UsageRow }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="line-clamp-2 text-sm font-black leading-snug text-slate-950">{row.schoolName ?? row.schoolId}</p>
          <p className="mt-1 text-xs text-slate-500">{formatDateTime(row.createdAt)}</p>
        </div>
        <StatusChip status={row.status} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <OperationChip operation={row.operation} />
        <span className="text-xs font-semibold text-slate-500">{formatDateTime(row.createdAt)}</span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <MobileDetail label="Credits used" value={`${row.creditsUsed}`} />
        <MobileDetail label="Pages" value={`${row.pagesProcessed}`} />
        <MobileDetail label="Price UGX" value={formatUgx(row.priceUgx)} />
        <MobileDetail label="Model" value={row.model || "-"} />
        <MobileDetail label="Provider" value={row.provider || "Gemini"} />
        <MobileDetail label="Margin" value={row.marginEstimateUgx == null ? "-" : formatUgx(row.marginEstimateUgx)} />
      </div>
      <details className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
        <summary className="cursor-pointer list-none text-xs font-bold uppercase tracking-[0.18em] text-slate-600">
          View technical details
        </summary>
        <div className="mt-3 grid gap-2 text-xs text-slate-600">
          <div className="flex items-center justify-between gap-3">
            <span>Token usage</span>
            <span className="font-mono text-slate-800">{formatTokenUsage(row.tokenUsage)}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span>Gemini cost</span>
            <span className="font-mono text-slate-800">{row.geminiCostEstimateUgx == null ? "-" : formatUgx(row.geminiCostEstimateUgx)}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span>Status</span>
            <span className="font-mono text-slate-800">{row.status}</span>
          </div>
        </div>
      </details>
    </article>
  );
}

function PaymentCard({ payment, onConfirm, onReject, busy }: {
  payment: SmartPagesPaymentRequest;
  onConfirm: (id: string) => void;
  onReject: (id: string) => void;
  busy: boolean;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="line-clamp-2 text-sm font-black leading-snug text-slate-950">{payment.schoolName ?? payment.schoolId}</p>
          <p className="mt-1 text-xs text-slate-500">{formatDateTime(payment.createdAt)}</p>
        </div>
        <StatusChip status={payment.status} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <OperationChip operation="TOP_UP" />
        <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-700">{payment.network}</span>
        <span className="text-xs font-semibold text-slate-500">{formatDateTime(payment.createdAt)}</span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <MobileDetail label="Amount UGX" value={formatUgx(payment.amountUgx)} />
        <MobileDetail label="Credits" value={`${payment.credits}`} />
        <MobileDetail label="Merchant code" value={payment.merchantCode} />
        <MobileDetail label="Transaction ID" value={payment.transactionId ?? "Not submitted"} />
        <MobileDetail label="Payer phone" value={payment.payerPhone ?? "-"} />
        <MobileDetail label="Reference" value={payment.paymentReference} />
      </div>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
          disabled={busy || !payment.transactionId}
          onClick={() => onConfirm(payment.id)}
        >
          Confirm
        </button>
        <button
          type="button"
          className="rounded-xl border border-red-200 px-3 py-2 text-xs font-bold text-red-700 disabled:opacity-50"
          disabled={busy}
          onClick={() => onReject(payment.id)}
        >
          Reject
        </button>
      </div>
    </article>
  );
}

export function OwnerDashboardPage() {
  const [stats, setStats] = useState<OwnerDashboardStats | null>(null);
  const [payments, setPayments] = useState<SmartPagesPaymentRequest[]>([]);
  const [usage, setUsage] = useState<UsageRow[]>([]);
  const [error, setError] = useState("");
  const [paymentError, setPaymentError] = useState("");
  const [busyPaymentId, setBusyPaymentId] = useState<string | null>(null);
  const [usageQuery, setUsageQuery] = useState("");
  const [operationFilter, setOperationFilter] = useState<string>("");
  const [paymentQuery, setPaymentQuery] = useState("");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>("PENDING");

  useEffect(() => {
    fetchOwnerDashboard()
      .then(setStats)
      .catch((e: Error) => setError(e.message));
    fetchOwnerSmartPagesPayments(paymentStatusFilter)
      .then((data) => setPayments(data.payments))
      .catch((e: Error) => setPaymentError(e.message));
    fetchOwnerSmartPagesUsage()
      .then((data) => setUsage(data.ledger))
      .catch(() => setUsage([]));
  }, [paymentStatusFilter]);

  async function refreshPayments() {
    const data = await fetchOwnerSmartPagesPayments(paymentStatusFilter);
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

  const filteredUsage = useMemo(() => {
    const query = usageQuery.trim().toLowerCase();
    return usage.filter((row) => {
      const matchesQuery = !query || [row.schoolName, row.schoolId, row.model, row.provider, row.operation]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
      const matchesOperation = !operationFilter || row.operation === operationFilter;
      return matchesQuery && matchesOperation;
    });
  }, [operationFilter, usage, usageQuery]);

  const filteredPayments = useMemo(() => {
    const query = paymentQuery.trim().toLowerCase();
    return payments.filter((payment) => {
      const matchesQuery = !query || [payment.schoolName, payment.schoolId, payment.network, payment.merchantCode, payment.transactionId]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
      return matchesQuery;
    });
  }, [paymentQuery, payments]);

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
        <p className="text-sm font-bold text-red-700">Could not load dashboard</p>
        <p className="mt-1 text-xs text-red-700/80">{error}</p>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">Platform Owner</p>
          <h2 className="text-2xl font-black tracking-tight text-slate-950">Owner Console</h2>
          <p className="mt-1 text-sm text-slate-500">A command center for schools, users, payments, and Smart Pages usage.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/owner/schools" className="rounded-full border border-blue-200 bg-white px-4 py-2 text-sm font-bold text-blue-700 shadow-sm hover:bg-blue-50">
            Schools
          </Link>
          <Link to="/owner/users" className="rounded-full border border-blue-200 bg-white px-4 py-2 text-sm font-bold text-blue-700 shadow-sm hover:bg-blue-50">
            Users
          </Link>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total schools" value={stats ? stats.totalSchools : "?"} />
        <StatCard label="Active subscriptions" value={stats ? stats.activeSchools : "?"} />
        <StatCard label="Expired / suspended" value={stats ? stats.expiredSchools + stats.suspendedSchools : "?"} />
        <StatCard label="No subscription" value={stats ? stats.noSubscriptionSchools : "?"} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <StatCard label="Total users" value={stats ? stats.totalUsers : "?"} />
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Quick links</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Link to="/owner/schools" className="rounded-full bg-slate-50 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-100">
              Manage schools
            </Link>
            <Link to="/owner/users" className="rounded-full bg-slate-50 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-100">
              Manage users
            </Link>
          </div>
        </div>
      </div>

      {stats?.recentSchools?.length ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Recently onboarded schools</p>
          <div className="grid gap-2">
            {stats.recentSchools.map((school) => (
              <div key={school.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2">
                <p className="min-w-0 truncate font-semibold text-slate-900">{school.name}</p>
                <p className="shrink-0 font-mono text-xs text-slate-400">{school.code}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-blue-700">Smart Pages payments</p>
            <h3 className="text-lg font-black text-slate-950">Pending Mobile Money confirmations</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              type="search"
              placeholder="Search school / transaction"
              value={paymentQuery}
              onChange={(event) => setPaymentQuery(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 sm:w-64"
            />
            <select
              value={paymentStatusFilter}
              onChange={(event) => setPaymentStatusFilter(event.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400"
            >
              <option value="PENDING">Pending</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="REJECTED">Rejected</option>
              <option value="ALL">All</option>
            </select>
          </div>
        </div>
        {paymentError ? <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{paymentError}</p> : null}
        {filteredPayments.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">No Smart Pages payments found.</p>
        ) : (
          <>
            <div className="mt-4 grid gap-3 md:hidden">
              {filteredPayments.map((payment) => (
                <PaymentCard
                  key={payment.id}
                  payment={payment}
                  busy={busyPaymentId === payment.id}
                  onConfirm={(id) => void decidePayment(id, "confirm")}
                  onReject={(id) => void decidePayment(id, "reject")}
                />
              ))}
            </div>

            <div className="mt-4 hidden overflow-hidden rounded-2xl border border-slate-200 md:block">
              <div className="max-h-[30rem] overflow-auto">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3">School</th>
                      <th className="px-4 py-3 whitespace-nowrap">Status</th>
                      <th className="px-4 py-3 whitespace-nowrap">Network</th>
                      <th className="px-4 py-3 whitespace-nowrap">Merchant</th>
                      <th className="px-4 py-3 whitespace-nowrap">Transaction</th>
                      <th className="px-4 py-3 whitespace-nowrap">Payer phone</th>
                      <th className="px-4 py-3 whitespace-nowrap">Amount</th>
                      <th className="px-4 py-3 whitespace-nowrap">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {filteredPayments.map((payment) => (
                      <tr key={payment.id} className="align-top">
                        <td className="max-w-[18rem] px-4 py-3">
                          <p className="line-clamp-2 font-semibold text-slate-900">{payment.schoolName ?? payment.schoolId}</p>
                        </td>
                        <td className="px-4 py-3"><StatusChip status={payment.status} /></td>
                        <td className="px-4 py-3 whitespace-nowrap text-slate-700">{payment.network}</td>
                        <td className="px-4 py-3 whitespace-nowrap font-mono text-xs text-slate-600">{payment.merchantCode}</td>
                        <td className="max-w-[14rem] px-4 py-3 font-mono text-xs text-slate-600 truncate">{payment.transactionId ?? "Not submitted"}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-slate-700">{payment.payerPhone ?? "-"}</td>
                        <td className="px-4 py-3 whitespace-nowrap font-semibold text-slate-900">{formatUgx(payment.amountUgx)}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
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
            </div>
          </>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-blue-700">Smart Pages usage</p>
            <h3 className="text-lg font-black text-slate-950">Model, token, cost, and margin estimates</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              type="search"
              placeholder="Search school / model"
              value={usageQuery}
              onChange={(event) => setUsageQuery(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 sm:w-64"
            />
            <select
              value={operationFilter}
              onChange={(event) => setOperationFilter(event.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400"
            >
              <option value="">All operations</option>
              <option value="EXTRACT">Extract</option>
              <option value="HIGH_ACCURACY_EXTRACT">High accuracy</option>
              <option value="GENERATE_DOCUMENT">Generate</option>
              <option value="PUBLISH_DOCUMENT">Publish</option>
              <option value="TOP_UP">Top-up</option>
              <option value="REFUND">Refund</option>
            </select>
          </div>
        </div>
        {filteredUsage.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">No Smart Pages usage recorded yet.</p>
        ) : (
          <>
            <div className="mt-4 grid gap-3 md:hidden">
              {filteredUsage.slice(0, 12).map((row) => (
                <UsageCard key={row.id ?? `${row.schoolId}-${row.createdAt}`} row={row} />
              ))}
            </div>

            <div className="mt-4 hidden overflow-hidden rounded-2xl border border-slate-200 md:block">
              <div className="max-h-[32rem] overflow-auto">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3">School</th>
                      <th className="px-4 py-3 whitespace-nowrap">Operation</th>
                      <th className="px-4 py-3 whitespace-nowrap">Credits</th>
                      <th className="px-4 py-3 whitespace-nowrap">Pages</th>
                      <th className="px-4 py-3 whitespace-nowrap">Price</th>
                      <th className="px-4 py-3 whitespace-nowrap">Provider</th>
                      <th className="px-4 py-3 whitespace-nowrap">Model</th>
                      <th className="px-4 py-3 whitespace-nowrap">Tokens</th>
                      <th className="px-4 py-3 whitespace-nowrap">Gemini cost</th>
                      <th className="px-4 py-3 whitespace-nowrap">Margin</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {filteredUsage.slice(0, 12).map((row) => (
                      <tr key={row.id ?? `${row.schoolId}-${row.createdAt}`} className="align-top">
                        <td className="max-w-[18rem] px-4 py-3">
                          <p className="line-clamp-2 font-semibold text-slate-900">{row.schoolName ?? row.schoolId}</p>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-slate-700">{operationLabel(row.operation)}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-slate-700">{row.creditsUsed}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-slate-700">{row.pagesProcessed}</td>
                        <td className="px-4 py-3 whitespace-nowrap font-semibold text-slate-900">{formatUgx(row.priceUgx)}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-slate-700">{row.provider || "Gemini"}</td>
                        <td className="max-w-[12rem] px-4 py-3 truncate font-mono text-xs text-slate-600">{row.model || "-"}</td>
                        <td className="px-4 py-3 whitespace-nowrap font-mono text-xs text-slate-600">{formatTokenUsage(row.tokenUsage)}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-slate-700">{row.geminiCostEstimateUgx == null ? "-" : formatUgx(row.geminiCostEstimateUgx)}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-slate-700">{row.marginEstimateUgx == null ? "-" : formatUgx(row.marginEstimateUgx)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
