import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { fetchStudentWallet } from "../client/studentCredentialsClient";
import { SectionLoader } from "../components/SectionLoader";
import type { StudentWalletDetail } from "../shared/types/studentCredentials";

function money(cents: number) {
  return `UGX ${Math.round(cents / 100).toLocaleString()}`;
}

function prettyType(type: string) {
  return type.replaceAll("_", " ");
}

export function StudentWalletPage() {
  const { studentId = "" } = useParams();
  const navigate = useNavigate();
  const [wallet, setWallet] = useState<StudentWalletDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!studentId) {
      setError("Missing student ID.");
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchStudentWallet(studentId)
      .then(setWallet)
      .catch((caught: Error) => setError(caught.message))
      .finally(() => setLoading(false));
  }, [studentId]);

  if (loading) {
    return <SectionLoader message="Loading wallet..." />;
  }

  return (
    <main className="grid gap-5">
      <header className="page-header flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-blue-600">Student Wallet</p>
          <h1 className="text-xl font-bold text-slate-950 sm:text-2xl">Wallet balance and history</h1>
        </div>
        <button
          type="button"
          className="btn btn-primary shrink-0 rounded-xl px-4 py-2 text-sm font-bold"
          onClick={() => navigate(`/students/${encodeURIComponent(studentId)}/wallet/top-up`)}
        >
          Add Wallet
        </button>
      </header>

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

      {wallet ? (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section className="grid gap-4">
            <div className="premium-card rounded-2xl p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Current balance</p>
                  <h2 className="mt-1 text-2xl font-black text-slate-950">{money(wallet.wallet?.balanceCents ?? 0)}</h2>
                  <p className="mt-1 text-sm text-slate-600">{wallet.student.name}</p>
                  <p className="text-xs text-slate-500">
                    {wallet.student.admissionNumber} · {wallet.student.className ?? "No class"} / {wallet.student.streamName ?? "No stream"}
                  </p>
                </div>
                <div className="rounded-2xl bg-blue-50 px-3 py-2 text-right">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-blue-600">Status</p>
                  <p className="text-sm font-bold text-blue-800">{wallet.wallet?.status ?? "No wallet"}</p>
                </div>
              </div>
            </div>

            <section className="premium-card rounded-2xl p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Transaction history</p>
                  <h3 className="mt-1 text-lg font-bold text-slate-950">Recent wallet activity</h3>
                </div>
                <Link
                  to={`/students/${encodeURIComponent(studentId)}/wallet/top-up`}
                  className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-bold text-blue-700 hover:bg-blue-100"
                >
                  Add funds
                </Link>
              </div>

              <div className="mt-4 grid gap-3">
                {wallet.transactions.length ? wallet.transactions.map((tx) => (
                  <article key={tx.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-bold text-slate-950">{prettyType(tx.type)}</p>
                        <p className="mt-0.5 text-xs text-slate-500">{new Date(tx.createdAt).toLocaleString()}</p>
                      </div>
                      <p className="text-right font-bold text-slate-950">{money(tx.amountCents)}</p>
                    </div>
                    <div className="mt-3 grid gap-1 text-xs text-slate-600">
                      <p>Balance after: {money(tx.balanceAfterCents ?? 0)}</p>
                      {tx.paymentMethod ? <p>Method: {prettyType(tx.paymentMethod)}</p> : null}
                      {tx.reference ? <p>Reference: {tx.reference}</p> : null}
                      {tx.description ? <p>Notes: {tx.description}</p> : null}
                    </div>
                  </article>
                )) : (
                  <p className="rounded-xl border border-dashed border-slate-200 bg-white p-4 text-sm text-slate-500">
                    No wallet transactions yet.
                  </p>
                )}
              </div>
            </section>
          </section>

          <aside className="premium-card rounded-2xl p-5">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Quick actions</p>
            <div className="mt-3 grid gap-2">
              <Link
                to={`/students/${encodeURIComponent(studentId)}/wallet/top-up`}
                className="rounded-xl bg-blue-600 px-4 py-3 text-center text-sm font-bold text-white hover:bg-blue-700"
              >
                Add Wallet
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
          </aside>
        </div>
      ) : null}
    </main>
  );
}
