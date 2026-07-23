import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchInventoryOverview } from "../client/inventoryClient";
import { InventorySectionTabs } from "../../../components/inventory/InventorySectionTabs";
import { SectionLoader } from "../../../components/SectionLoader";
import type { InventoryOverviewResponse } from "../shared/types";

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-black text-slate-950">{value}</p>
    </div>
  );
}

function CompactEmptyState({
  message,
  actionLabel,
  actionTo,
}: {
  message: string;
  actionLabel?: string;
  actionTo?: string;
}) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-3">
      <p className="text-sm text-slate-600">{message}</p>
      {actionLabel && actionTo ? (
        <Link className="mt-2 inline-flex text-sm font-semibold text-[color:var(--sc-primary)]" to={actionTo}>
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}

export function InventoryPage() {
  const [data, setData] = useState<InventoryOverviewResponse | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchInventoryOverview().then(setData).catch((caught: Error) => setError(caught.message));
  }, []);

  if (!data && !error) {
    return <SectionLoader message="Loading inventory overview..." />;
  }

  return (
    <main className="grid gap-4">
      <InventorySectionTabs />
      <header className="page-header">
        <p className="text-xs font-bold uppercase tracking-wide text-blue-600">Inventory</p>
        <h1 className="text-xl font-bold tracking-tight text-slate-950 sm:text-2xl">Stock and reporting-day operations</h1>
        <p className="mt-1 text-sm text-slate-600">
          Track school supplies, stock movements, and the items students bring during reporting day in one operational workspace.
        </p>
      </header>

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      {data ? (
        <>
          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <SummaryCard label="Items tracked" value={data.summary.itemsTracked} />
            <SummaryCard label="Low stock" value={data.summary.lowStock} />
            <SummaryCard label="Reporting today" value={data.summary.reportingToday} />
            <SummaryCard label="Items brought today" value={data.summary.itemsBroughtToday} />
            <SummaryCard label="Adjustments today" value={data.summary.adjustmentsToday} />
          </section>

          <section className="grid gap-4 xl:grid-cols-[1.3fr_0.9fr]">
            <div className="premium-card rounded-2xl p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-base font-bold text-slate-950">Recent stock movements</h2>
                <Link className="text-sm font-semibold text-[color:var(--sc-primary)]" to="/inventory/items">Open items</Link>
              </div>
              <div className="space-y-2">
                {data.recentMovements.length === 0 ? (
                  <CompactEmptyState
                    message="No stock movements yet."
                    actionLabel="Receive stock"
                    actionTo="/inventory/items"
                  />
                ) : data.recentMovements.map((movement) => (
                  <div key={movement.id} className="rounded-xl border border-slate-200 px-3 py-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold text-slate-900">{movement.itemName}</p>
                      <span className="text-xs font-bold uppercase text-slate-500">{movement.type}</span>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">
                      {movement.quantity} via {movement.source}
                      {movement.studentName ? ` • ${movement.studentName}` : ""}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-4">
              <div className="premium-card rounded-2xl p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h2 className="text-base font-bold text-slate-950">Low stock</h2>
                  <Link className="text-sm font-semibold text-[color:var(--sc-primary)]" to="/inventory/reconciliation">Review issues</Link>
                </div>
                <div className="space-y-2">
                  {data.lowStockItems.length === 0 ? (
                    <CompactEmptyState message="No low-stock alerts right now." />
                  ) : data.lowStockItems.map((item) => (
                    <div key={item.id} className="rounded-xl border border-slate-200 px-3 py-2">
                      <p className="font-semibold text-slate-900">{item.name}</p>
                      <p className="text-sm text-slate-600">{item.onHandQuantity} {item.unit} on hand • minimum {item.minimumStock}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="premium-card rounded-2xl p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h2 className="text-base font-bold text-slate-950">Reporting day</h2>
                  <Link className="text-sm font-semibold text-[color:var(--sc-primary)]" to="/inventory/reporting">Open reporting day</Link>
                </div>
                <div className="space-y-2">
                  {data.reportingToday.length === 0 ? (
                    <CompactEmptyState
                      message="No reporting-day registrations recorded yet."
                      actionLabel="Open reporting day"
                      actionTo="/inventory/reporting"
                    />
                  ) : data.reportingToday.map((record) => (
                    <div key={record.id} className="rounded-xl border border-slate-200 px-3 py-2">
                      <p className="font-semibold text-slate-900">{record.studentName}</p>
                      <p className="text-sm text-slate-600">{record.admissionNumber} • {record.items.length} item(s) brought</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </>
      ) : null}
    </main>
  );
}
