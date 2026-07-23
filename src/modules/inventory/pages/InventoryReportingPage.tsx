import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  fetchInventoryItems,
  fetchInventoryReportingContext,
  saveReportingRequirement,
  saveStudentReportingRecord,
} from "../client/inventoryClient";
import { InventorySectionTabs } from "../../../components/inventory/InventorySectionTabs";
import type { InventoryItemSummary, InventoryStudentOption, ReportingRequirementView } from "../shared/types";

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
  const [requirements, setRequirements] = useState<ReportingRequirementView[]>([]);
  const [studentSearch, setStudentSearch] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [requirementItemId, setRequirementItemId] = useState("");
  const [requirementQty, setRequirementQty] = useState(1);
  const [selectedRequirementId, setSelectedRequirementId] = useState("");
  const [broughtQuantity, setBroughtQuantity] = useState(1);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  async function load(search = "") {
    const [reporting, itemResponse] = await Promise.all([
      fetchInventoryReportingContext(search),
      fetchInventoryItems(),
    ]);
    setStudents(reporting.students);
    setRequirements(reporting.requirements);
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
  const selectedRequirement = useMemo(
    () => requirements.find((requirement) => requirement.id === selectedRequirementId) ?? null,
    [requirements, selectedRequirementId],
  );
  const hasActiveItems = items.length > 0;
  const hasRequirements = requirements.length > 0;

  async function handleSaveRequirement(event: FormEvent) {
    event.preventDefault();
    setError("");
    await saveReportingRequirement({ itemId: requirementItemId, requiredQuantity: requirementQty });
    setNotice("Reporting requirement saved.");
    setRequirementItemId("");
    setRequirementQty(1);
    await reloadReporting(studentSearch);
  }

  async function handleSaveRecord(event: FormEvent) {
    event.preventDefault();
    if (!selectedStudentId || !selectedRequirement) return;
    await saveStudentReportingRecord({
      studentId: selectedStudentId,
      items: [
        {
          itemId: selectedRequirement.itemId,
          expectedQuantity: selectedRequirement.requiredQuantity,
          broughtQuantity,
        },
      ],
    });
    setNotice("Student reporting-day record saved.");
    setSelectedRequirementId("");
    setBroughtQuantity(1);
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

      <section className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
        <form className="premium-card grid gap-3 rounded-2xl p-4" onSubmit={(event) => void handleSaveRequirement(event)}>
          <h2 className="text-base font-bold text-slate-950">Add reporting requirement</h2>
          <p className="text-sm text-slate-600">
            Choose an active inventory item first, then set the expected quantity for reporting day.
          </p>
          {hasActiveItems ? (
            <>
              <select aria-label="Requirement item" className="input" value={requirementItemId} onChange={(event) => setRequirementItemId(event.target.value)}>
                <option value="">Select item</option>
                {items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
              <input
                aria-label="Required quantity"
                className="input"
                type="number"
                min={1}
                value={requirementQty}
                onChange={(event) => setRequirementQty(Number(event.target.value))}
              />
              <div>
                <button type="submit" className="btn btn-primary" disabled={!requirementItemId}>
                  Save requirement
                </button>
              </div>
            </>
          ) : (
            <InventoryEmptyState
              title="Add requirements from inventory items"
              description="There are no active inventory items yet. Add inventory item first."
              actionLabel="Add inventory item first"
              actionTo="/inventory/items"
            />
          )}
        </form>

        <form className="premium-card grid gap-3 rounded-2xl p-4" onSubmit={(event) => void handleSaveRecord(event)}>
          <h2 className="text-base font-bold text-slate-950">Record student brought items</h2>
          <p className="text-sm text-slate-600">
            Select a student, choose the reporting-day requirement from the configured inventory items, then record the quantity brought.
          </p>
          {!hasActiveItems ? (
            <InventoryEmptyState
              title="Add requirements from inventory items"
              description="No active inventory items are available for reporting day yet."
              actionLabel="Add inventory item first"
              actionTo="/inventory/items"
            />
          ) : !hasRequirements ? (
            <InventoryEmptyState
              title="Add requirements from inventory items"
              description="Reporting-day requirements are not configured yet."
              actionLabel="Add requirements from inventory items"
              actionTo="/inventory/reporting"
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

              <select aria-label="Student" className="input" value={selectedStudentId} onChange={(event) => setSelectedStudentId(event.target.value)}>
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

              <select
                aria-label="Reporting requirement"
                className="input"
                value={selectedRequirementId}
                onChange={(event) => setSelectedRequirementId(event.target.value)}
              >
                <option value="">Select requirement</option>
                {requirements.map((requirement) => (
                  <option key={requirement.id} value={requirement.id}>
                    {requirement.itemName}
                  </option>
                ))}
              </select>

              <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-3 text-sm text-slate-600">
                <p className="font-semibold text-slate-900">
                  {selectedRequirement ? selectedRequirement.itemName : "Choose a requirement"}
                </p>
                <p className="mt-1">
                  Expected quantity: {selectedRequirement ? selectedRequirement.requiredQuantity : "Select an item"}
                </p>
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  {selectedStudent
                    ? `${selectedStudent.className ?? "No class"}${selectedStudent.streamName ? ` • ${selectedStudent.streamName}` : ""}`
                    : "Select a student to continue"}
                </p>
              </div>

              <label className="text-sm text-slate-600">
                Quantity brought
                <input
                  aria-label="Quantity brought"
                  className="input mt-1"
                  type="number"
                  min={0}
                  value={broughtQuantity}
                  onChange={(event) => setBroughtQuantity(Number(event.target.value))}
                />
              </label>

              <div>
                <button type="submit" className="btn btn-primary" disabled={!selectedStudentId || !selectedRequirementId}>
                  Save registration
                </button>
              </div>
            </>
          )}
        </form>
      </section>
    </main>
  );
}
