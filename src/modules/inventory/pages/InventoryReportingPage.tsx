import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  fetchInventoryItems,
  fetchInventoryReportingContext,
  saveStudentReportingRecord,
} from "../client/inventoryClient";
import { InventorySectionTabs } from "../../../components/inventory/InventorySectionTabs";
import type { InventoryItemSummary, InventoryStudentOption, StudentReportingRecordView } from "../shared/types";

function InventoryEmptyState({
  title,
  description,
  actionLabel,
  actionTo,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  actionTo?: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-4 text-sm text-slate-600">
      <p className="font-semibold text-slate-900">{title}</p>
      <p className="mt-1">{description}</p>
      {actionLabel && actionTo ? (
        <Link className="btn btn-secondary mt-3" to={actionTo}>
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}

export function InventoryReportingPage() {
  const [students, setStudents] = useState<InventoryStudentOption[]>([]);
  const [items, setItems] = useState<InventoryItemSummary[]>([]);
  const [recentRecords, setRecentRecords] = useState<StudentReportingRecordView[]>([]);
  const [studentSearch, setStudentSearch] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [selectedItemId, setSelectedItemId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  async function load(search = "") {
    const [reporting, itemResponse] = await Promise.all([
      fetchInventoryReportingContext(search),
      fetchInventoryItems(),
    ]);
    setStudents(reporting.students);
    setRecentRecords(reporting.recentRecords);
    setItems(itemResponse.items.filter((item) => item.active));
    setSelectedStudentId((current) => {
      if (current && reporting.students.some((student) => student.id === current)) {
        return current;
      }
      return reporting.students[0]?.id ?? "";
    });
  }

  async function reloadReporting(search = "") {
    try {
      setError("");
      await load(search);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load reporting day data.");
    }
  }

  useEffect(() => {
    void reloadReporting();
  }, []);

  const selectedStudent = useMemo(
    () => students.find((student) => student.id === selectedStudentId) ?? null,
    [students, selectedStudentId],
  );
  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedItemId) ?? null,
    [items, selectedItemId],
  );
  const selectedStudentItems = useMemo(
    () => recentRecords
      .filter((record) => record.studentId === selectedStudentId)
      .flatMap((record) => record.items),
    [recentRecords, selectedStudentId],
  );
  const hasActiveItems = items.length > 0;

  async function handleSaveRecord(event: FormEvent) {
    event.preventDefault();
    if (!selectedStudentId || !selectedItemId) return;
    setError("");
    await saveStudentReportingRecord({
      studentId: selectedStudentId,
      items: [{ itemId: selectedItemId, quantity }],
    });
    setNotice("Item brought recorded.");
    setSelectedItemId("");
    setQuantity(1);
    await reloadReporting(studentSearch);
  }

  async function handleStudentSearch() {
    await reloadReporting(studentSearch);
  }

  async function handleClearStudentSearch() {
    setStudentSearch("");
    await reloadReporting("");
  }

  return (
    <main className="grid gap-4">
      <InventorySectionTabs />
      <header className="page-header">
        <p className="text-xs font-bold uppercase tracking-wide text-blue-600">Inventory</p>
        <h1 className="text-xl font-bold tracking-tight text-slate-950 sm:text-2xl">Reporting day registration</h1>
      </header>

      {notice ? <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{notice}</div> : null}
      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <form className="premium-card grid gap-3 rounded-2xl p-4" onSubmit={(event) => void handleSaveRecord(event)}>
          <h2 className="text-base font-bold text-slate-950">Items brought</h2>
          <p className="text-sm text-slate-600">
            Select a student, choose the item brought from your inventory list, then record the quantity.
          </p>
          {!hasActiveItems ? (
            <InventoryEmptyState
              title="Add item names first"
              description="Add item names first, such as ream, soap, toilet paper, books."
              actionLabel="Add item"
              actionTo="/inventory/items"
            />
          ) : (
            <>
              <div className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                <label className="grid gap-1 text-sm text-slate-700">
                  <span className="font-medium">Search student</span>
                  <input
                    aria-label="Search student"
                    className="input"
                    placeholder="Search by name or admission number"
                    value={studentSearch}
                    onChange={(event) => setStudentSearch(event.target.value)}
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="btn btn-secondary" onClick={() => void handleStudentSearch()}>
                    Search
                  </button>
                  {studentSearch.trim() ? (
                    <button type="button" className="btn btn-secondary" onClick={() => void handleClearStudentSearch()}>
                      Clear search
                    </button>
                  ) : null}
                </div>
              </div>

              <select aria-label="Select student" className="input" value={selectedStudentId} onChange={(event) => setSelectedStudentId(event.target.value)}>
                <option value="">Select student</option>
                {students.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.studentName} ({student.admissionNumber})
                  </option>
                ))}
              </select>
              {students.length === 0 ? (
                <p className="text-sm text-slate-500">No students matched that search yet. Try a different name or admission number.</p>
              ) : null}

              <select aria-label="Select item brought" className="input" value={selectedItemId} onChange={(event) => setSelectedItemId(event.target.value)}>
                <option value="">Select item brought</option>
                {items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>

              <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-3 text-sm text-slate-600">
                <p className="font-semibold text-slate-900">
                  {selectedItem ? selectedItem.name : "Choose an item"}
                </p>
                <p className="mt-1">
                  {selectedStudent
                    ? `${selectedStudent.studentName} (${selectedStudent.admissionNumber})`
                    : "Select a student to continue"}
                </p>
              </div>

              <label className="text-sm text-slate-600">
                Quantity
                <input
                  aria-label="Quantity"
                  className="input mt-1"
                  type="number"
                  min={0}
                  value={quantity}
                  onChange={(event) => setQuantity(Number(event.target.value))}
                />
              </label>

              <div>
                <button type="submit" className="btn btn-primary" disabled={!selectedStudentId || !selectedItemId}>
                  Save item brought
                </button>
              </div>
            </>
          )}
        </form>

        <section className="premium-card grid gap-3 rounded-2xl p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-bold text-slate-950">Recorded items for selected student</h2>
            {selectedStudent ? (
              <p className="text-sm text-slate-600">
                {selectedStudent.studentName} ({selectedStudent.admissionNumber})
              </p>
            ) : (
              <Link className="text-sm font-semibold text-[color:var(--sc-primary)]" to="/inventory">
                Back to overview
              </Link>
            )}
          </div>
          {selectedStudentItems.length === 0 ? (
            <InventoryEmptyState
              title="No items recorded for this student yet"
              description="Use the form to record the first reporting-day item for the selected student."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-slate-500">
                  <tr>
                    <th className="pb-2">Item name</th>
                    <th className="pb-2">Quantity brought</th>
                    <th className="pb-2">Recorded by</th>
                    <th className="pb-2">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedStudentItems.map((item, index) => (
                    <tr key={`${item.itemId}-${item.recordedAt}-${index}`} className="border-t border-slate-200">
                      <td className="py-2 font-semibold text-slate-900">{item.itemName}</td>
                      <td className="py-2 text-slate-600">{item.quantity}</td>
                      <td className="py-2 text-slate-600">{item.recordedByName}</td>
                      <td className="py-2 text-slate-600">{new Date(item.recordedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
