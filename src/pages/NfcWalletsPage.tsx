import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchNfcWallets, setWalletPin } from "../client/studentCredentialsClient";
import type { NfcWalletDashboard, NfcWalletRow } from "../shared/types/studentCredentials";

const inputClass = "premium-control h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none focus:border-blue-400 focus:bg-white";
const textareaClass = "premium-control w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-400 focus:bg-white resize-none";

function money(cents: number) {
  return `UGX ${Math.round(cents / 100).toLocaleString()}`;
}

export function NfcWalletsPage() {
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState<NfcWalletDashboard | null>(null);
  const [selected, setSelected] = useState<NfcWalletRow | null>(null);
  const [search, setSearch] = useState("");
  const [classId, setClassId] = useState("");
  const [streamId, setStreamId] = useState("");
  const [error, setError] = useState("");

  // PIN modal state
  const [pinTarget, setPinTarget] = useState<NfcWalletRow | null>(null);
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pinReason, setPinReason] = useState("");
  const [pinLoading, setPinLoading] = useState(false);
  const [pinError, setPinError] = useState("");
  const [pinSuccess, setPinSuccess] = useState(false);

  async function load() {
    const data = await fetchNfcWallets({ search, classId, streamId });
    setDashboard(data);
    setSelected((current) => {
      if (!current) return data.wallets[0] ?? null;
      // refresh selected row if still in list
      return data.wallets.find((r) => r.student.id === current.student.id) ?? current;
    });
  }

  useEffect(() => {
    void load().catch((caught: Error) => setError(caught.message));
  }, []);

  function openPinModal(row: NfcWalletRow) {
    setPinTarget(row);
    setNewPin("");
    setConfirmPin("");
    setPinReason("");
    setPinError("");
    setPinSuccess(false);
  }

  function closePinModal() {
    setPinTarget(null);
    setNewPin("");
    setConfirmPin("");
    setPinReason("");
    setPinError("");
    setPinSuccess(false);
  }

  async function handleSetPin() {
    if (!pinTarget?.wallet.id) return;
    if (!/^\d{4,6}$/.test(newPin)) { setPinError("PIN must be 4 to 6 digits."); return; }
    if (newPin !== confirmPin) { setPinError("PINs do not match."); return; }
    if (!pinReason.trim()) { setPinError("Reason is required."); return; }
    setPinLoading(true);
    setPinError("");
    try {
      await setWalletPin(pinTarget.wallet.id, newPin, pinReason.trim());
      setPinSuccess(true);
      void load(); // refresh to update pinSet indicator
    } catch (e) {
      setPinError(e instanceof Error ? e.message : "Could not set PIN.");
    } finally {
      setNewPin("");
      setConfirmPin("");
      setPinLoading(false);
    }
  }

  return (
    <main className="grid gap-5">
      <header className="page-header flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-blue-600">NFC Operations</p>
          <h1 className="text-xl font-bold text-slate-950 sm:text-2xl">NFC Wallets</h1>
        </div>
        <button
          type="button"
          className="btn btn-primary shrink-0 rounded-xl px-4 py-2 text-sm font-bold"
          onClick={() => navigate("/nfc/wallets/top-up")}
        >
          + Top Up
        </button>
      </header>
      {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
      <section className="grid gap-3 sm:grid-cols-4">
        <Metric label="Active wallets" value={dashboard?.summary.totalActiveWallets ?? 0} />
        <Metric label="Total balance" value={money(dashboard?.summary.totalBalanceCents ?? 0)} />
        <Metric label="Frozen wallets" value={dashboard?.summary.frozenWallets ?? 0} />
        <Metric label="Today spend" value={money(dashboard?.summary.todayCanteenSpendCents ?? 0)} />
      </section>
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="premium-card rounded-xl p-4">
          <div className="mb-3 grid gap-2 md:grid-cols-4">
            <input className={inputClass} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search student" />
            <input className={inputClass} value={classId} onChange={(event) => setClassId(event.target.value)} placeholder="Class ID filter" />
            <input className={inputClass} value={streamId} onChange={(event) => setStreamId(event.target.value)} placeholder="Stream ID filter" />
            <button className="btn btn-secondary" type="button" onClick={() => void load()}>Apply filters</button>
          </div>
          <div className="grid gap-2">
            {(dashboard?.wallets ?? []).map((row) => (
              <div key={row.student.id} className="rounded-xl border border-slate-200 bg-white p-3 text-sm hover:border-blue-200">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <button type="button" className="text-left" onClick={() => setSelected(row)}>
                    <p className="font-bold text-slate-950">{row.student.name} · {row.student.admissionNumber}</p>
                    <p className="mt-0.5 text-slate-500">
                      {row.student.className ?? "No class"} / {row.student.streamName ?? "No stream"} · Wallet {row.wallet.status} · Wristband {row.activeCredentialStatus}
                    </p>
                  </button>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">{money(row.wallet.balanceCents)}</span>
                    {!row.wallet.pinSet && (
                      <span className="rounded px-1.5 py-0.5 text-xs font-bold bg-amber-100 text-amber-700">No PIN</span>
                    )}
                    <button
                      type="button"
                      className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700 hover:bg-blue-100"
                      onClick={() => navigate(`/nfc/wallets/top-up?studentId=${encodeURIComponent(row.student.id)}`)}
                    >
                      Top Up
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <aside className="premium-card rounded-xl p-4">
          <h2 className="text-base font-bold text-slate-950">Wallet detail</h2>
          {selected ? (
            <div className="mt-3 grid gap-3 text-sm">
              <p className="font-bold text-slate-950">{selected.student.name}</p>
              <p className="text-slate-600">{selected.student.admissionNumber}</p>
              <p className="text-2xl font-bold text-slate-950">{money(selected.wallet.balanceCents)}</p>
              <p className="text-slate-600">Status: {selected.wallet.status}</p>
              <p className="text-slate-600">Active wristband: {selected.activeCredentialStatus}</p>

              {/* PIN status */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-bold text-slate-900">Wallet PIN</p>
                    <p className="text-xs text-slate-500">
                      {selected.wallet.pinSet
                        ? selected.wallet.pinLockedUntil
                          ? `Locked until ${new Date(selected.wallet.pinLockedUntil).toLocaleTimeString()}`
                          : "PIN set"
                        : "No PIN set — canteen charges blocked"}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="shrink-0 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100"
                    onClick={() => openPinModal(selected)}
                  >
                    {selected.wallet.pinSet ? "Reset PIN" : "Set PIN"}
                  </button>
                </div>
              </div>

              {selected.lastTransaction ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="font-bold text-slate-900">Last transaction</p>
                  <p>{selected.lastTransaction.type} · {money(selected.lastTransaction.amountCents)} · {new Date(selected.lastTransaction.createdAt).toLocaleString()}</p>
                </div>
              ) : <p className="text-slate-500">No transactions yet.</p>}
            </div>
          ) : <p className="mt-3 text-sm text-slate-500">Select a wallet to view details.</p>}
        </aside>
      </section>

      {/* PIN set/reset modal */}
      {pinTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <p className="text-base font-bold text-slate-950">
              {pinTarget.wallet.pinSet ? "Reset wallet PIN" : "Set wallet PIN"}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              {pinTarget.student.name} · {pinTarget.student.admissionNumber}
            </p>
            {pinSuccess ? (
              <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 font-bold">
                PIN {pinTarget.wallet.pinSet ? "reset" : "set"} successfully.
              </div>
            ) : (
              <div className="mt-4 grid gap-3">
                <div className="grid gap-1">
                  <label className="text-xs font-bold uppercase text-slate-500">New PIN (4–6 digits)</label>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    className={`${inputClass} text-center text-xl tracking-widest`}
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="••••"
                    autoComplete="new-password"
                  />
                </div>
                <div className="grid gap-1">
                  <label className="text-xs font-bold uppercase text-slate-500">Confirm PIN</label>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    className={`${inputClass} text-center text-xl tracking-widest`}
                    value={confirmPin}
                    onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="••••"
                    autoComplete="new-password"
                  />
                </div>
                <div className="grid gap-1">
                  <label className="text-xs font-bold uppercase text-slate-500">Reason</label>
                  <textarea
                    className={textareaClass}
                    rows={2}
                    value={pinReason}
                    onChange={(e) => setPinReason(e.target.value)}
                    placeholder="e.g. Initial PIN setup for student"
                  />
                </div>
                {pinError && (
                  <p className="text-xs text-red-600">{pinError}</p>
                )}
              </div>
            )}
            <div className="mt-4 flex gap-2">
              {!pinSuccess && (
                <button
                  type="button"
                  className="flex-1 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 transition-colors"
                  disabled={pinLoading || newPin.length < 4}
                  onClick={() => void handleSetPin()}
                >
                  {pinLoading ? "Saving…" : pinTarget.wallet.pinSet ? "Reset PIN" : "Set PIN"}
                </button>
              )}
              <button
                type="button"
                className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
                onClick={closePinModal}
              >
                {pinSuccess ? "Close" : "Cancel"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-bold uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-950">{value}</p>
    </div>
  );
}
