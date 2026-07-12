import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { NfcSectionTabs } from "../components/nfc/NfcSectionTabs";
import { approveNfcCanteenReconciliation, closeNfcCanteenReconciliation, fetchNfcCanteenReconciliation, rejectNfcCanteenReconciliation } from "../client/studentCredentialsClient";
import { fetchStaffUsers, type StaffUser } from "../client/staffUsersClient";
import { useAuth } from "../contexts/AuthContext";
import { getCanteenQueueStatus, markLocalCanteenSaleReviewed, retryFailedCanteenSales, voidLocalCanteenSale, type CanteenQueueStatus } from "../offline/offlineStore";
import { useConnectivityStatus } from "../hooks/useConnectivityStatus";
import { hasPermission } from "../shared/permissions";
import type { OfflineQueuedEvent } from "../offline/offlineTypes";
import type { NfcCanteenReconciliationResponse } from "../shared/types/studentCredentials";

const inputClass = "premium-control h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none focus:border-blue-400 focus:bg-white";
const textareaClass = "premium-control min-h-[88px] rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-400 focus:bg-white";

function money(cents: number) {
  return `UGX ${Math.round(Math.abs(cents) / 100).toLocaleString()}`;
}

function signedMoney(cents: number) {
  const sign = cents >= 0 ? "+" : "−";
  const tone = cents >= 0 ? "text-emerald-700" : "text-red-700";
  return <span className={`font-bold ${tone}`}>{sign}{money(cents)}</span>;
}

function prettyType(type: string) {
  return type.replaceAll("_", " ");
}

function statusClass(status?: string | null) {
  switch (status) {
    case "APPROVED":
      return "bg-emerald-100 text-emerald-700";
    case "SUBMITTED":
      return "bg-blue-100 text-blue-700";
    case "REJECTED":
      return "bg-red-100 text-red-700";
    case "DRAFT":
      return "bg-slate-100 text-slate-600";
    default:
      return "bg-slate-100 text-slate-600";
  }
}

function MetricCard({ label, value, subtext }: { label: string; value: string | number | ReactNode; subtext?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-[11px] font-black uppercase tracking-wider text-slate-500">{label}</p>
      <div className="mt-1 text-xl font-black text-slate-950">{value}</div>
      {subtext ? <p className="mt-1 text-xs text-slate-500">{subtext}</p> : null}
    </div>
  );
}

function makeDefaultDate() {
  return new Date().toISOString().slice(0, 10);
}

function getDeviceId(): string {
  const key = "schoolconnect_nfc_device_id";
  let id = localStorage.getItem(key);
  if (!id) { id = crypto.randomUUID(); localStorage.setItem(key, id); }
  return id;
}

export function NfcCanteenReconciliationPage() {
  const { user } = useAuth();
  const deviceId = useMemo(getDeviceId, []);
  const { triggerSync } = useConnectivityStatus(user?.schoolId, deviceId, "canteen");
  const canSubmit = hasPermission(user?.role, "nfc.canteen.reconciliation.submit");
  const canApprove = user?.role === "ADMIN_OPERATOR";
  const [date, setDate] = useState(makeDefaultDate());
  const [cashierUserId, setCashierUserId] = useState("");
  const [shiftName, setShiftName] = useState("");
  const [declaredCashUgx, setDeclaredCashUgx] = useState("");
  const [declaredMobileMoneyUgx, setDeclaredMobileMoneyUgx] = useState("");
  const [notes, setNotes] = useState("");
  const [rejectNotes, setRejectNotes] = useState("");
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);
  const [staffError, setStaffError] = useState("");
  const [data, setData] = useState<NfcCanteenReconciliationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [localQueue, setLocalQueue] = useState<CanteenQueueStatus | null>(null);
  const [localQueueMessage, setLocalQueueMessage] = useState("");
  const [localQueueBusy, setLocalQueueBusy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);

  async function loadStaff() {
    if (!hasPermission(user?.role, "staff.manage")) return;
    try {
      const result = await fetchStaffUsers();
      setStaffUsers(result.users.filter((item) => ["CASHIER", "CANTEEN", "ADMIN_OPERATOR"].includes(item.role)));
      setStaffError("");
    } catch (caught) {
      setStaffUsers([]);
      setStaffError(caught instanceof Error ? caught.message : "Could not load staff users.");
    }
  }

  async function load() {
    setLoading(true);
    setError("");
    try {
      const result = await fetchNfcCanteenReconciliation({
        date,
        cashierUserId: cashierUserId || undefined,
        shiftName: shiftName || undefined,
      });
      setData(result);
      setDeclaredCashUgx((current) => current || Math.round(result.summary.declaredCashCents / 100).toString());
      setDeclaredMobileMoneyUgx((current) => current || Math.round(result.summary.declaredMobileMoneyCents / 100).toString());
      if (result.reconciliation) {
        setNotes(result.reconciliation.notes ?? "");
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load reconciliation.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  async function loadLocalQueue() {
    if (!user?.schoolId) return;
    setLocalQueue(await getCanteenQueueStatus(user.schoolId));
  }

  useEffect(() => {
    void loadStaff();
  }, [user?.role]);

  useEffect(() => {
    void load();
  }, [date, cashierUserId, shiftName]);

  useEffect(() => {
    void loadLocalQueue();
  }, [user?.schoolId]);

  const varianceCents = useMemo(() => {
    const declaredCash = Math.round(Number(declaredCashUgx || 0) * 100);
    const declaredMobileMoney = Math.round(Number(declaredMobileMoneyUgx || 0) * 100);
    const expectedTopUps = data?.summary.totalTopUpsCents ?? 0;
    return declaredCash + declaredMobileMoney - expectedTopUps;
  }, [data?.summary.totalTopUpsCents, declaredCashUgx, declaredMobileMoneyUgx]);

  const varianceRequiresNotes = varianceCents !== 0;
  const selectedRecord = data?.reconciliation ?? null;
  const locked = selectedRecord?.status === "APPROVED" || selectedRecord?.status === "SUBMITTED";

  async function handleClose() {
    if (!data) return;
    if (!canSubmit) return;
    if (varianceRequiresNotes && !notes.trim()) {
      setError("Notes are required when variance is not zero.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await closeNfcCanteenReconciliation({
        date,
        cashierUserId: cashierUserId || null,
        shiftName: shiftName || null,
        declaredCashUgx: Number(declaredCashUgx || 0),
        declaredMobileMoneyUgx: Number(declaredMobileMoneyUgx || 0),
        notes: notes.trim() || null,
      });
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not close reconciliation.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleApprove() {
    if (!selectedRecord?.id) return;
    setApproving(true);
    setError("");
    try {
      await approveNfcCanteenReconciliation(selectedRecord.id);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not approve reconciliation.");
    } finally {
      setApproving(false);
    }
  }

  async function handleReject() {
    if (!selectedRecord?.id || !rejectNotes.trim()) return;
    setRejecting(true);
    setError("");
    try {
      await rejectNfcCanteenReconciliation(selectedRecord.id, rejectNotes.trim());
      setRejectNotes("");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not reject reconciliation.");
    } finally {
      setRejecting(false);
    }
  }

  async function handleRetryLocalFailed() {
    if (!user?.schoolId) return;
    setLocalQueueBusy(true);
    setLocalQueueMessage("");
    try {
      const before = await getCanteenQueueStatus(user.schoolId);
      await retryFailedCanteenSales(user.schoolId);
      await triggerSync();
      const after = await getCanteenQueueStatus(user.schoolId);
      setLocalQueue(after);
      setLocalQueueMessage(after.failed || after.conflict
        ? `Retry complete, but ${after.failed} failed and ${after.conflict} conflict sales still need review.`
        : `Retry complete. ${before.failed + before.pending} local sales were processed or queued.`);
    } catch (caught) {
      setLocalQueueMessage(caught instanceof Error ? caught.message : "Retry failed.");
    } finally {
      setLocalQueueBusy(false);
    }
  }

  async function handleMarkReviewed(item: OfflineQueuedEvent) {
    if (!canApprove) return;
    if (!window.confirm("Mark this local canteen sale as reviewed and keep its local record? It will no longer block register updates.")) return;
    await markLocalCanteenSaleReviewed(item.localId);
    await loadLocalQueue();
  }

  async function handleVoidLocal(item: OfflineQueuedEvent) {
    if (!canApprove) return;
    if (!window.confirm("Void this unsynced local canteen sale on this device? Use this only for test/stale rows that should never sync.")) return;
    await voidLocalCanteenSale(item.localId);
    await loadLocalQueue();
  }

  const summary = data?.summary;
  const attentionItems = localQueue?.items.filter((item) => item.syncStatus === "FAILED" || item.syncStatus === "CONFLICT") ?? [];

  return (
    <main className="grid gap-5">
      <header className="page-header flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-600">Wallets</p>
          <h1 className="text-xl font-bold text-slate-950 sm:text-2xl">Reconcile</h1>
          <p className="mt-1 text-sm text-slate-500">Review wallet movement, close the day, and approve the final reconciliation.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/nfc/canteen" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">Canteen Purchase</Link>
          <Link to="/nfc/wallets" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">Wallets</Link>
        </div>
      </header>

      <NfcSectionTabs
        tabs={[
          { to: "/nfc/wallets", label: "Wallets" },
          { to: "/nfc/wallets/top-up", label: "Top Up" },
          { to: "/nfc/wallets/transactions", label: "Transactions" },
          { to: "/nfc/wallets/reconcile", label: "Reconcile" },
        ]}
      />

      <section className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:grid-cols-4">
        <label className="grid gap-1 text-xs font-black uppercase text-slate-500">
          Date
          <input className={inputClass} type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </label>
        <label className="grid gap-1 text-xs font-black uppercase text-slate-500">
          Cashier / operator
          {staffUsers.length ? (
            <select className={inputClass} value={cashierUserId} onChange={(event) => setCashierUserId(event.target.value)}>
              <option value="">All staff</option>
              {staffUsers.map((staff) => (
                <option key={staff.id} value={staff.id}>
                  {staff.name} ({staff.role})
                </option>
              ))}
            </select>
          ) : (
            <input
              className={inputClass}
              value={cashierUserId}
              onChange={(event) => setCashierUserId(event.target.value)}
              placeholder="User ID filter"
            />
          )}
        </label>
        <label className="grid gap-1 text-xs font-black uppercase text-slate-500">
          Shift name
          <input className={inputClass} value={shiftName} onChange={(event) => setShiftName(event.target.value)} placeholder="Morning / Evening" />
        </label>
        <div className="flex items-end">
          <button
            type="button"
            className="h-11 w-full rounded-xl border border-blue-200 bg-blue-50 px-4 text-sm font-bold text-blue-700 hover:bg-blue-100"
            onClick={() => void load()}
          >
            Refresh
          </button>
        </div>
      </section>

      {staffError ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">{staffError}</div> : null}
      {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
      {localQueue && (localQueue.failed > 0 || localQueue.conflict > 0 || localQueue.pending > 0) ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-black">Local canteen sales on this device</p>
              <p className="mt-1 text-xs">
                Pending: <span className="font-bold">{localQueue.pending}</span>
                {" "}Failed: <span className="font-bold">{localQueue.failed}</span>
                {" "}Conflict/review: <span className="font-bold">{localQueue.conflict}</span>
              </p>
              {localQueue.lastError ? <p className="mt-1 text-xs">Last sync error: <span className="font-bold">{localQueue.lastError}</span></p> : null}
              {localQueueMessage ? <p className="mt-2 font-bold">{localQueueMessage}</p> : null}
            </div>
            <button
              type="button"
              className="rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-60"
              disabled={localQueueBusy || (localQueue.pending + localQueue.failed) === 0}
              onClick={() => void handleRetryLocalFailed()}
            >
              {localQueueBusy ? "Retrying..." : `Retry failed sale${localQueue.failed + localQueue.pending === 1 ? "" : "s"}`}
            </button>
          </div>
          {attentionItems.length ? (
            <div className="mt-3 grid gap-2">
              {attentionItems.map((item) => (
                <div key={item.localId} className="rounded-xl border border-amber-200 bg-white p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-bold">{item.syncStatus} - {item.idempotencyKey}</p>
                      <p className="mt-1 text-xs text-amber-800">{item.errorMessage ?? "No server error message recorded."}</p>
                      <p className="mt-1 text-[11px] text-slate-500">{new Date(item.createdAt).toLocaleString()}</p>
                    </div>
                    {canApprove ? (
                      <div className="flex flex-wrap gap-2">
                        <button type="button" className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700" onClick={() => void handleMarkReviewed(item)}>
                          Mark reviewed
                        </button>
                        <button type="button" className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700" onClick={() => void handleVoidLocal(item)}>
                          Void local test sale
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">Loading reconciliation...</div>
      ) : summary ? (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Opening wallet balance" value={money(summary.openingWalletBalanceCents)} />
            <MetricCard label="Total wallet top-ups" value={money(summary.totalTopUpsCents)} />
            <MetricCard label="Total canteen purchases" value={money(summary.totalCanteenChargesCents)} />
            <MetricCard label="Total reversals" value={money(summary.totalReversalsCents)} />
            <MetricCard label="Net canteen sales" value={money(summary.netCanteenPayableCents)} />
            <MetricCard label="Closing wallet balance" value={money(summary.closingWalletBalanceCents)} />
            <MetricCard label="Cash collected" value={money(summary.totalCashTopUpsCents)} />
            <MetricCard label="Mobile money collected" value={money(summary.totalMobileMoneyTopUpsCents)} />
            <MetricCard label="Variance" value={signedMoney(summary.varianceCents)} subtext={varianceRequiresNotes ? "Notes required before submit" : "Balanced"} />
          </section>

          <section className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-slate-950">Transaction breakdown</p>
                  <p className="mt-1 text-xs text-slate-500">Time, student, type, method, amount, balance after, operator, reference, and status.</p>
                </div>
                {selectedRecord ? (
                  <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-wider ${statusClass(selectedRecord.status)}`}>
                    {selectedRecord.status}
                  </span>
                ) : null}
              </div>
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead>
                    <tr className="text-left text-[11px] font-black uppercase tracking-wider text-slate-500">
                      <th className="py-2 pr-3">Time</th>
                      <th className="py-2 pr-3">Student</th>
                      <th className="py-2 pr-3">Admission</th>
                      <th className="py-2 pr-3">Type</th>
                      <th className="py-2 pr-3">Method</th>
                      <th className="py-2 pr-3">Amount</th>
                      <th className="py-2 pr-3">Balance after</th>
                      <th className="py-2 pr-3">Cashier/operator</th>
                      <th className="py-2 pr-3">Reference</th>
                      <th className="py-2 pr-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.transactions.length ? data.transactions.map((row) => (
                      <tr key={row.id} className="align-top">
                        <td className="py-2 pr-3 whitespace-nowrap text-xs text-slate-500">{new Date(row.time).toLocaleString()}</td>
                        <td className="py-2 pr-3">
                          <div className="font-bold text-slate-950">{row.student.name}</div>
                          <div className="text-xs text-slate-500">{row.student.className ?? "No class"} / {row.student.streamName ?? "No stream"}</div>
                        </td>
                        <td className="py-2 pr-3 whitespace-nowrap text-xs text-slate-500">{row.student.admissionNumber}</td>
                        <td className="py-2 pr-3 whitespace-nowrap"><span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-black uppercase tracking-wider text-slate-600">{prettyType(row.type)}</span></td>
                        <td className="py-2 pr-3 whitespace-nowrap text-xs text-slate-500">{row.method ?? "N/A"}</td>
                        <td className="py-2 pr-3 whitespace-nowrap">{signedMoney(row.amountCents)}</td>
                        <td className="py-2 pr-3 whitespace-nowrap text-xs text-slate-500">{row.balanceAfterCents === null ? "N/A" : money(row.balanceAfterCents)}</td>
                        <td className="py-2 pr-3 whitespace-nowrap text-xs text-slate-500">{row.cashierOperator ?? "N/A"}</td>
                        <td className="py-2 pr-3 whitespace-nowrap text-xs text-slate-500">{row.reference ?? "—"}</td>
                        <td className="py-2 pr-3 whitespace-nowrap"><span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-black uppercase tracking-wider text-emerald-700">{row.status}</span></td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={10} className="py-6 text-center text-sm text-slate-500">No transactions found for this selection.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <aside className="grid gap-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-sm font-black text-slate-950">Close day</p>
                <div className="mt-3 grid gap-3">
                  <label className="grid gap-1 text-xs font-black uppercase text-slate-500">
                    Declared cash (UGX)
                    <input className={inputClass} inputMode="numeric" value={declaredCashUgx} onChange={(event) => setDeclaredCashUgx(event.target.value)} placeholder="0" disabled={locked || !canSubmit} />
                  </label>
                  <label className="grid gap-1 text-xs font-black uppercase text-slate-500">
                    Declared mobile money (UGX)
                    <input className={inputClass} inputMode="numeric" value={declaredMobileMoneyUgx} onChange={(event) => setDeclaredMobileMoneyUgx(event.target.value)} placeholder="0" disabled={locked || !canSubmit} />
                  </label>
                  <label className="grid gap-1 text-xs font-black uppercase text-slate-500">
                    Notes
                    <textarea className={textareaClass} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder={varianceRequiresNotes ? "Variance requires notes" : "Optional notes"} disabled={locked || !canSubmit} />
                  </label>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                    <p className="font-bold text-slate-950">Variance</p>
                    <p className="mt-1">{signedMoney(varianceCents)}</p>
                  </div>
                  <button
                    type="button"
                    className="min-h-11 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400"
                    onClick={() => void handleClose()}
                    disabled={!canSubmit || submitting || locked || (varianceRequiresNotes && !notes.trim())}
                  >
                    {submitting ? "Submitting..." : selectedRecord?.status === "APPROVED" ? "Approved" : "Submit reconciliation"}
                  </button>
                  {!canSubmit ? <p className="text-xs text-amber-700">You do not have permission to submit reconciliations.</p> : null}
                  {locked ? <p className="text-xs text-slate-500">This reconciliation is locked.</p> : null}
                </div>
              </div>

              {selectedRecord ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-sm font-black text-slate-950">Approval</p>
                  <div className="mt-2 text-sm text-slate-600">
                    <p>Status: <span className="font-bold text-slate-950">{selectedRecord.status}</span></p>
                    <p className="mt-1">Submitted: {selectedRecord.submittedAt ? new Date(selectedRecord.submittedAt).toLocaleString() : "N/A"}</p>
                    <p>Approved: {selectedRecord.approvedAt ? new Date(selectedRecord.approvedAt).toLocaleString() : "N/A"}</p>
                  </div>
                  {canApprove && selectedRecord.status === "SUBMITTED" && (
                    <div className="mt-3 grid gap-2">
                      <button
                        type="button"
                        className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400"
                        onClick={() => void handleApprove()}
                        disabled={approving}
                      >
                        {approving ? "Approving..." : "Approve"}
                      </button>
                      <label className="grid gap-1 text-xs font-black uppercase text-slate-500">
                        Reject notes
                        <textarea className={textareaClass} value={rejectNotes} onChange={(event) => setRejectNotes(event.target.value)} placeholder="Reason for rejection" />
                      </label>
                      <button
                        type="button"
                        className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700 hover:bg-red-100 disabled:bg-slate-100 disabled:text-slate-400"
                        onClick={() => void handleReject()}
                        disabled={rejecting || !rejectNotes.trim()}
                      >
                        {rejecting ? "Rejecting..." : "Reject"}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm text-sm text-slate-500">
                  No saved reconciliation yet for this selection.
                </div>
              )}
            </aside>
          </section>
        </>
      ) : null}
    </main>
  );
}
