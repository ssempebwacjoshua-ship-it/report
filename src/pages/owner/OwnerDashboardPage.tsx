import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchOwnerDashboard, type OwnerDashboardStats } from "../../client/ownerClient";

function StatCard({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="premium-card rounded-xl p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-black text-slate-950">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-400">{sub}</p>}
    </div>
  );
}

export function OwnerDashboardPage() {
  const [stats, setStats] = useState<OwnerDashboardStats | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchOwnerDashboard()
      .then(setStats)
      .catch((e: Error) => setError(e.message));
  }, []);

  if (error) {
    return (
      <div className="premium-card rounded-xl p-5">
        <p className="text-sm font-bold text-red-700">Could not load dashboard</p>
        <p className="mt-1 text-xs text-slate-500">{error}</p>
      </div>
    );
  }

  const dash = stats ? stats.totalSchools : "—";

  return (
    <div className="grid gap-6">
      <div>
        <h2 className="text-lg font-black text-slate-950">Overview</h2>
        <p className="text-sm text-slate-500">Real-time stats across all schools.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total schools" value={stats ? stats.totalSchools : "—"} />
        <StatCard label="Active subscriptions" value={stats ? stats.activeSchools : "—"} />
        <StatCard label="Expired / suspended" value={stats ? stats.expiredSchools + stats.suspendedSchools : "—"} />
        <StatCard label="No subscription" value={stats ? stats.noSubscriptionSchools : "—"} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <StatCard label="Total users (all schools)" value={stats ? stats.totalUsers : "—"} />
        <div className="premium-card rounded-xl p-4 flex items-center gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Quick links</p>
            <div className="mt-2 flex flex-col gap-1">
              <Link to="/owner/schools" className="text-sm font-semibold text-blue-600 hover:underline">Manage schools →</Link>
              <Link to="/owner/users" className="text-sm font-semibold text-blue-600 hover:underline">Manage users →</Link>
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

      {/* Surface the fake-number warning as a dummy — this card pulls real API data */}
      {stats === null && !error && (
        <div className="text-center py-8 text-sm text-slate-400">Loading...</div>
      )}
    </div>
  );
}
