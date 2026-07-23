import { useEffect, useState, type FormEvent } from "react";
import {
  archiveInventoryItem,
  createInventoryItem,
  fetchInventoryItems,
  recordInventoryMovement,
} from "../client/inventoryClient";
import { InventorySectionTabs } from "../../../components/inventory/InventorySectionTabs";
import type { InventoryItemSummary } from "../shared/types";

const categoryOptions = [
  "General supplies",
  "Stationery",
  "Hygiene",
  "Boarding",
  "Uniform",
  "Food",
  "Cleaning",
];

const unitOptions = ["piece", "ream", "bar", "book", "pair", "bucket", "kg", "litre"];
const recipientTypeOptions = ["Staff", "Student", "Department", "Kitchen", "Office", "Other"];

const emptyItemForm = { name: "", category: "General supplies", unit: "piece", minimumStock: 1 };
const emptyMovementForm = { itemId: "", quantity: 1, source: "", notes: "" };
const emptyIssueForm = { itemId: "", quantity: 1, recipientName: "", recipientType: "Staff", source: "", notes: "" };

export function InventoryItemsPage() {
  const [items, setItems] = useState<InventoryItemSummary[]>([]);
  const [itemForm, setItemForm] = useState(emptyItemForm);
  const [movementForm, setMovementForm] = useState(emptyMovementForm);
  const [issueForm, setIssueForm] = useState(emptyIssueForm);
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
    setNotice("");
    try {
      await createInventoryItem(itemForm);
      setNotice("Inventory item added.");
      setItemForm(emptyItemForm);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create inventory item.");
    }
  }

  async function handleReceiveStock(event: FormEvent) {
    event.preventDefault();
    setError("");
    setNotice("");
    try {
      await recordInventoryMovement("receive", movementForm);
      setNotice("Stock received recorded.");
      setMovementForm(emptyMovementForm);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not record stock received.");
    }
  }

  async function handleArchive(itemId: string) {
    setError("");
    setNotice("");
    try {
      await archiveInventoryItem(itemId);
      setNotice("Inventory item archived.");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not archive inventory item.");
    }
  }

  async function handleIssueStock(event: FormEvent) {
    event.preventDefault();
    setError("");
    setNotice("");
    try {
      await recordInventoryMovement("issue", issueForm);
      setNotice("Stock taken out recorded.");
      setIssueForm(emptyIssueForm);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not record stock taken out.");
    }
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

      <section className="grid gap-4 xl:grid-cols-3">
        <form className="premium-card grid gap-3 rounded-2xl p-4" onSubmit={(event) => void handleAddItem(event)}>
          <h2 className="text-base font-bold text-slate-950">Add item</h2>
          <p className="text-sm text-slate-600">
            Add the item name, then confirm the category, unit, and low-stock threshold before saving.
          </p>
          <label className="grid gap-1 text-sm text-slate-700">
            <span className="font-medium">Item name</span>
            <input
              aria-label="Item name"
              className="input"
              placeholder="Reams of paper"
              value={itemForm.name}
              onChange={(event) => setItemForm((current) => ({ ...current, name: event.target.value }))}
            />
          </label>
          <label className="grid gap-1 text-sm text-slate-700">
            <span className="font-medium">Category</span>
            <select
              aria-label="Category"
              className="input"
              value={itemForm.category}
              onChange={(event) => setItemForm((current) => ({ ...current, category: event.target.value }))}
            >
              {categoryOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm text-slate-700">
            <span className="font-medium">Unit</span>
            <select
              aria-label="Unit"
              className="input"
              value={itemForm.unit}
              onChange={(event) => setItemForm((current) => ({ ...current, unit: event.target.value }))}
            >
              {unitOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm text-slate-700">
            <span className="font-medium">Minimum stock</span>
            <input
              aria-label="Minimum stock"
              className="input"
              type="number"
              min={0}
              value={itemForm.minimumStock}
              onChange={(event) => setItemForm((current) => ({ ...current, minimumStock: Number(event.target.value) }))}
            />
          </label>
          <div>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!itemForm.name.trim() || !itemForm.category.trim() || !itemForm.unit.trim() || itemForm.minimumStock < 0}
            >
              Add item
            </button>
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

        <form className="premium-card grid gap-3 rounded-2xl p-4" onSubmit={(event) => void handleIssueStock(event)}>
          <h2 className="text-base font-bold text-slate-950">Take out stock</h2>
          <p className="text-sm text-slate-600">
            Record what left inventory, who took it, and why it was taken out.
          </p>
          <select
            aria-label="Issue item"
            className="input"
            value={issueForm.itemId}
            onChange={(event) => setIssueForm((current) => ({ ...current, itemId: event.target.value }))}
          >
            <option value="">Select item</option>
            {items.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <input
            aria-label="Issue quantity"
            className="input"
            type="number"
            min={1}
            value={issueForm.quantity}
            onChange={(event) => setIssueForm((current) => ({ ...current, quantity: Number(event.target.value) }))}
          />
          <input
            aria-label="Recipient name"
            className="input"
            placeholder="Who took the item?"
            value={issueForm.recipientName}
            onChange={(event) => setIssueForm((current) => ({ ...current, recipientName: event.target.value }))}
          />
          <select
            aria-label="Recipient type"
            className="input"
            value={issueForm.recipientType}
            onChange={(event) => setIssueForm((current) => ({ ...current, recipientType: event.target.value }))}
          >
            {recipientTypeOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <input
            aria-label="Issue purpose"
            className="input"
            placeholder="Why was it taken out?"
            value={issueForm.source}
            onChange={(event) => setIssueForm((current) => ({ ...current, source: event.target.value }))}
          />
          <input
            aria-label="Issue notes"
            className="input"
            placeholder="Reference or notes"
            value={issueForm.notes}
            onChange={(event) => setIssueForm((current) => ({ ...current, notes: event.target.value }))}
          />
          <div>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!issueForm.itemId || issueForm.quantity < 1 || !issueForm.recipientName.trim() || !issueForm.source.trim()}
            >
              Save taken-out record
            </button>
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
