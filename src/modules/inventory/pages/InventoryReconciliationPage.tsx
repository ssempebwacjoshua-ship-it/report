import { useEffect, useState, type FormEvent } from "react";
import { fetchInventoryItems, fetchInventoryReconciliation, recordInventoryMovement } from "../client/inventoryClient";
import { InventorySectionTabs } from "../../../components/inventory/InventorySectionTabs";
import type { InventoryItemSummary, InventoryReconciliationResponse } from "../shared/types";

export function InventoryReconciliationPage() {
  const [data, setData] = useState<InventoryReconciliationResponse | null>(null);
  const [items, setItems] = useState<InventoryItemSummary[]>([]);
  const [adjustItemId, setAdjustItemId] = useState("");
  const [adjustQty, setAdjustQty] = useState(1);
  const [adjustSource, setAdjustSource] = useState("RECONCILIATION");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  async function load() {
    const [reconciliation, itemResponse] = await Promise.all([
      fetchInventoryReconciliation(),
      fetchInventoryItems(),
    ]);
    setData(reconciliation);
    setItems(itemResponse.items.filter((item) => item.active));
  }

  useEffect(() => {
    load().catch((caught: Error) => setError(caught.message));
  }, []);

  async function handleAdjust(event: FormEvent) {
    event.preventDefault();
    await recordInventoryMovement("adjust", {
      itemId: adjustItemId,
      quantity: adjustQty,
      source: adjustSource,
    });
    setNotice("Reconciliation adjustment recorded.");
    setAdjustItemId("");
    setAdjustQty(1);
    await load();
  }

  return (
    <main className="grid gap-4">
      <InventorySectionTabs />
      <header className="page-header">
        <p className="text-xs font-bold uppercase tracking-wide text-blue-600">Inventory</p>
        <h1 className="text-xl font-bold tracking-tight text-slate-950 sm:text-2xl">Reconciliation</h1>
      </header>

      {notice ? <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{notice}</div> : null}
      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      <section className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="premium-card rounded-2xl p-4">
          <h2 className="mb-3 text-base font-bold text-slate-950">Low-stock items</h2>
          {!data || data.issues.length === 0 ? (
            <p className="text-sm text-slate-500">No low-stock issues found right now.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-slate-500">
                  <tr>
                    <th className="pb-2">Item</th>
                    <th className="pb-2">On hand</th>
                    <th className="pb-2">Minimum</th>
                    <th className="pb-2">Difference</th>
                    <th className="pb-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.issues.map((issue) => (
                    <tr key={issue.itemId} className="border-t border-slate-200">
                      <td className="py-2 font-semibold text-slate-900">{issue.itemName}</td>
                      <td className="py-2 text-slate-600">{issue.currentQuantity}</td>
                      <td className="py-2 text-slate-600">{issue.minimumStock}</td>
                      <td className="py-2 text-slate-600">{issue.difference}</td>
                      <td className="py-2 text-slate-600">{issue.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <form className="premium-card grid gap-3 rounded-2xl p-4" onSubmit={(event) => void handleAdjust(event)}>
          <h2 className="text-base font-bold text-slate-950">Adjustment</h2>
          <select aria-label="Adjustment item" className="input" value={adjustItemId} onChange={(event) => setAdjustItemId(event.target.value)}>
            <option value="">Select item</option>
            {items.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <input aria-label="Adjustment quantity" className="input" type="number" value={adjustQty} onChange={(event) => setAdjustQty(Number(event.target.value))} />
          <input aria-label="Adjustment source" className="input" value={adjustSource} onChange={(event) => setAdjustSource(event.target.value)} />
          <div>
            <button type="submit" className="btn btn-primary">Record adjustment</button>
          </div>
        </form>
      </section>
    </main>
  );
}
