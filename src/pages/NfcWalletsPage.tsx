import { useEffect, useState } from "react";
import { fetchNfcWallets } from "../client/studentCredentialsClient";
import type { NfcWalletDashboard, NfcWalletRow } from "../shared/types/studentCredentials";

const inputClass = "premium-control h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none focus:border-blue-400 focus:bg-white";

function money(cents: number) {
  return `UGX ${Math.round(cents / 100).toLocaleString()}`;
}

export function NfcWalletsPage() {
  const [dashboard, setDashboard] = useState<NfcWalletDashboard | null>(null);
  const [selected, setSelected] = useState<NfcWalletRow | null>(null);
  const [search, setSearch] = useState("");
  const [classId, setClassId] = useState("");
  const [streamId, setStreamId] = useState("");
  const [error, setError] = useState("");

  async function load() {
    const data = await fetchNfcWallets({ search, classId, streamId });
    setDashboard(data);
    setSelected((current) => current ?? data.wallets[0] ?? null);
  }

  useEffect(() => {
    void load().catch((caught: Error) => setError(caught.message));
  }, []);

  return (
    <main className="grid gap-5">
      <header className="page-header">
        <p className="text-xs font-bold uppercase tracking-wide text-blue-600">NFC Operations</p>
        <h1 className="text-xl font-bold text-slate-950 sm:text-2xl">NFC Wallets</h1>
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
              <button key={row.student.id} type="button" className="rounded-xl border border-slate-200 bg-white p-3 text-left text-sm hover:border-blue-200" onClick={() => setSelected(row)}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-bold text-slate-950">{row.student.name} · {row.student.admissionNumber}</p>
                  <span className="font-bold text-slate-900">{money(row.wallet.balanceCents)}</span>
                </div>
                <p className="mt-1 text-slate-500">{row.student.className ?? "No class"} / {row.student.streamName ?? "No stream"} · Wallet {row.wallet.status} · Wristband {row.activeCredentialStatus}</p>
              </button>
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
