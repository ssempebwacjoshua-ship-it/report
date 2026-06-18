import { useEffect, useState } from "react";
import { getAnalytics, type AnalyticsSummary } from "../../client/documentOsClient";

export function AnalyticsPage() {
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);

  useEffect(() => {
    getAnalytics().then(setAnalytics).catch(() => setAnalytics(null));
  }, []);

  const totals = analytics?.totals ?? { documents: 0, views: 0, downloads: 0, shares: 0 };

  return (
    <main className="grid gap-4">
      <header className="page-header">
        <p className="text-xs font-bold uppercase tracking-wide text-blue-600">Analytics Service</p>
        <h1 className="text-xl font-bold text-slate-950">Document Analytics</h1>
        <p className="mt-1 text-sm text-slate-500">Track views, downloads, shares, and popular documents.</p>
      </header>
      <section className="grid gap-3 sm:grid-cols-4">
        {Object.entries(totals).map(([key, value]) => (
          <div key={key} className="premium-card rounded-xl p-4">
            <p className="text-xs font-bold uppercase text-slate-500">{key}</p>
            <p className="mt-2 text-2xl font-black text-slate-950">{value}</p>
          </div>
        ))}
      </section>
      <section className="grid gap-3 lg:grid-cols-2">
        <AnalyticsList title="Most viewed" rows={analytics?.mostViewed ?? []} valueKey="views" />
        <AnalyticsList title="Most downloaded" rows={analytics?.mostDownloaded ?? []} valueKey="downloads" />
      </section>
      <section className="premium-card rounded-xl p-4">
        <h2 className="font-bold text-slate-950">Most active collections</h2>
        <div className="mt-3 grid gap-2">
          {(analytics?.mostActiveCollections ?? []).map((row) => (
            <div key={row.collectionId} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 p-3">
              <div>
                <p className="text-sm font-semibold text-slate-800">{row.name}</p>
                <p className="text-xs text-slate-500">{row.recordCount} records - {row.bulkJobCount} jobs</p>
              </div>
              <span className="font-black text-blue-700">{row.activityScore}</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

function AnalyticsList({ title, rows, valueKey }: { title: string; rows: Array<Record<string, any>>; valueKey: "views" | "downloads" }) {
  return (
    <div className="premium-card rounded-xl p-4">
      <h2 className="font-bold text-slate-950">{title}</h2>
      <div className="mt-3 grid gap-2">
        {rows.map((row) => (
          <div key={row.documentId} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 p-3">
            <p className="text-sm font-semibold text-slate-800">{row.title}</p>
            <span className="font-black text-blue-700">{row[valueKey]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

