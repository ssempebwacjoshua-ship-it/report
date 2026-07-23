import { useEffect, useState, type FormEvent } from "react";
import {
  archiveInventoryItem,
  createInventoryItem,
  fetchInventoryItems,
  recordInventoryMovement,
} from "../client/inventoryClient";
import { InventorySectionTabs } from "../../../components/inventory/InventorySectionTabs";
import type { InventoryItemSummary } from "../shared/types";

const emptyItemForm = { name: "", category: "", unit: "", minimumStock: 0 };
const emptyMovementForm = { itemId: "", quantity: 1, source: "", notes: "" };

export function InventoryItemsPage() {
  const [items, setItems] = useState<InventoryItemSummary[]>([]);
  const [itemForm, setItemForm] = useState(emptyItemForm);
  const [movementForm, setMovementForm] = useState(emptyMovementForm);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  async function load() {
    const response = await fetchInventoryItems();
    setItems(response.items);
  }

  useEffect(() => {
    load().catch((caught: Error) => setError(caught.message));
  }, []);

  async function handleAddItem(event: FormEvent) {
    event.preventDefault();
    setError("");
    await createInventoryItem(itemForm);
    setNotice("Inventory item added.");
    setItemForm(emptyItemForm);
    await load();
  }

  async function handleReceiveStock(event: FormEvent) {
    event.preventDefault();
    setError("");
    await recordInventoryMovement("receive", movementForm);
    setNotice("Stock received recorded.");
    setMovementForm(emptyMovementForm);
    await load();
  }

  async function handleArchive(itemId: string) {
    setError("");
    await archiveInventoryItem(itemId);
    setNotice("Inventory item archived.");
    await load();
  }

  return (
    <main className="grid gap-4">
      <InventorySectionTabs />
      <header className="page-header">
        <p className="text-xs font-bold uppercase tracking-wide text-blue-600">Inventory</p>
        <h1 className="text-xl font-bold tracking-tight text-slate-950 sm:text-2xl">Items and stock</h1>
      </header>

      {notice ? <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{notice}</div> : null}
      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      <section className="grid gap-4 xl:grid-cols-2">
        <form className="premium-card grid gap-3 rounded-2xl p-4" onSubmit={(event) => void handleAddItem(event)}>
          <h2 className="text-base font-bold text-slate-950">Add item</h2>
          <input aria-label="Item name" className="input" value={itemForm.name} onChange={(event) => setItemForm((current) => ({ ...current, name: event.target.value }))} />
          <input aria-label="Category" className="input" value={itemForm.category} onChange={(event) => setItemForm((current) => ({ ...current, category: event.target.value }))} />
          <input aria-label="Unit" className="input" value={itemForm.unit} onChange={(event) => setItemForm((current) => ({ ...current, unit: event.target.value }))} />
          <input aria-label="Minimum stock" className="input" type="number" value={itemForm.minimumStock} onChange={(event) => setItemForm((current) => ({ ...current, minimumStock: Number(event.target.value) }))} />
          <div>
            <button type="submit" className="btn btn-primary">Add item</button>
          </div>
        </form>

        <form className="premium-card grid gap-3 rounded-2xl p-4" onSubmit={(event) => void handleReceiveStock(event)}>
          <h2 className="text-base font-bold text-slate-950">Record stock received</h2>
          <select aria-label="Receive item" className="input" value={movementForm.itemId} onChange={(event) => setMovementForm((current) => ({ ...current, itemId: event.target.value }))}>
            <option value="">Select item</option>
            {items.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <input aria-label="Receive quantity" className="input" type="number" value={movementForm.quantity} onChange={(event) => setMovementForm((current) => ({ ...current, quantity: Number(event.target.value) }))} />
          <input aria-label="Receive source" className="input" value={movementForm.source} onChange={(event) => setMovementForm((current) => ({ ...current, source: event.target.value }))} />
          <input aria-label="Receive notes" className="input" value={movementForm.notes} onChange={(event) => setMovementForm((current) => ({ ...current, notes: event.target.value }))} />
          <div>
            <button type="submit" className="btn btn-primary">Record stock received</button>
          </div>
        </form>
      </section>

      <section className="premium-card rounded-2xl p-4">
        <h2 className="mb-3 text-base font-bold text-slate-950">Tracked items</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-slate-500">
              <tr>
                <th className="pb-2">Item</th>
                <th className="pb-2">Category</th>
                <th className="pb-2">On hand</th>
                <th className="pb-2">Minimum</th>
                <th className="pb-2">Status</th>
                <th className="pb-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-t border-slate-200">
                  <td className="py-2 font-semibold text-slate-900">{item.name}</td>
                  <td className="py-2 text-slate-600">{item.category}</td>
                  <td className="py-2 text-slate-600">{item.onHandQuantity} {item.unit}</td>
                  <td className="py-2 text-slate-600">{item.minimumStock}</td>
                  <td className="py-2 text-slate-600">{item.active ? (item.lowStock ? "Low stock" : "Healthy") : "Archived"}</td>
                  <td className="py-2">
                    {item.active ? <button type="button" className="btn btn-secondary py-1 text-xs" onClick={() => void handleArchive(item.id)}>Archive</button> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
