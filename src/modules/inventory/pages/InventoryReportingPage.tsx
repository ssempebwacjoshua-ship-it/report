import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  fetchInventoryItems,
  fetchInventoryReportingContext,
  saveReportingRequirement,
  saveStudentReportingRecord,
} from "../client/inventoryClient";
import { InventorySectionTabs } from "../../../components/inventory/InventorySectionTabs";
import type { InventoryItemSummary, InventoryStudentOption, ReportingRequirementView } from "../shared/types";

export function InventoryReportingPage() {
  const [students, setStudents] = useState<InventoryStudentOption[]>([]);
  const [items, setItems] = useState<InventoryItemSummary[]>([]);
  const [requirements, setRequirements] = useState<ReportingRequirementView[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [requirementItemId, setRequirementItemId] = useState("");
  const [requirementQty, setRequirementQty] = useState(1);
  const [broughtByItemId, setBroughtByItemId] = useState<Record<string, number>>({});
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  async function load() {
    const [reporting, itemResponse] = await Promise.all([
      fetchInventoryReportingContext(),
      fetchInventoryItems(),
    ]);
    setStudents(reporting.students);
    setRequirements(reporting.requirements);
    setItems(itemResponse.items.filter((item) => item.active));
    if (!selectedStudentId && reporting.students[0]) {
      setSelectedStudentId(reporting.students[0].id);
    }
  }

  useEffect(() => {
    load().catch((caught: Error) => setError(caught.message));
  }, []);

  const selectedStudent = useMemo(
    () => students.find((student) => student.id === selectedStudentId) ?? null,
    [students, selectedStudentId],
  );

  async function handleSaveRequirement(event: FormEvent) {
    event.preventDefault();
    setError("");
    await saveReportingRequirement({ itemId: requirementItemId, requiredQuantity: requirementQty });
    setNotice("Reporting requirement saved.");
    setRequirementItemId("");
    setRequirementQty(1);
    await load();
  }

  async function handleSaveRecord(event: FormEvent) {
    event.preventDefault();
    if (!selectedStudentId) return;
    const chosenRequirements = requirements.filter((requirement) => requirement.classId == null || requirement.className === selectedStudent?.className);
    const payloadItems = chosenRequirements.map((requirement) => ({
      itemId: requirement.itemId,
      expectedQuantity: requirement.requiredQuantity,
      broughtQuantity: broughtByItemId[requirement.itemId] ?? 0,
    }));
    await saveStudentReportingRecord({
      studentId: selectedStudentId,
      items: payloadItems,
    });
    setNotice("Student reporting-day record saved.");
    setBroughtByItemId({});
    await load();
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
          <select aria-label="Requirement item" className="input" value={requirementItemId} onChange={(event) => setRequirementItemId(event.target.value)}>
            <option value="">Select item</option>
            {items.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <input aria-label="Required quantity" className="input" type="number" value={requirementQty} onChange={(event) => setRequirementQty(Number(event.target.value))} />
          <div>
            <button type="submit" className="btn btn-primary">Save requirement</button>
          </div>
        </form>

        <form className="premium-card grid gap-3 rounded-2xl p-4" onSubmit={(event) => void handleSaveRecord(event)}>
          <h2 className="text-base font-bold text-slate-950">Record student brought items</h2>
          <select aria-label="Student" className="input" value={selectedStudentId} onChange={(event) => setSelectedStudentId(event.target.value)}>
            <option value="">Select student</option>
            {students.map((student) => (
              <option key={student.id} value={student.id}>
                {student.studentName} ({student.admissionNumber})
              </option>
            ))}
          </select>

          <div className="space-y-2">
            {requirements.length === 0 ? (
              <p className="text-sm text-slate-500">No reporting requirements configured yet.</p>
            ) : requirements.map((requirement) => (
              <div key={requirement.id} className="grid gap-2 rounded-xl border border-slate-200 px-3 py-2 md:grid-cols-[1.3fr_0.7fr_0.7fr] md:items-center">
                <div>
                  <p className="font-semibold text-slate-900">{requirement.itemName}</p>
                  <p className="text-xs text-slate-500">Expected: {requirement.requiredQuantity}</p>
                </div>
                <label className="text-sm text-slate-600">
                  Brought quantity
                  <input
                    aria-label={`${requirement.itemName} brought quantity`}
                    className="input mt-1"
                    type="number"
                    value={broughtByItemId[requirement.itemId] ?? 0}
                    onChange={(event) => setBroughtByItemId((current) => ({ ...current, [requirement.itemId]: Number(event.target.value) }))}
                  />
                </label>
                <div className="text-xs font-semibold text-slate-500">
                  {selectedStudent ? `${selectedStudent.className ?? "No class"}${selectedStudent.streamName ? ` • ${selectedStudent.streamName}` : ""}` : "Choose a student"}
                </div>
              </div>
            ))}
          </div>

          <div>
            <button type="submit" className="btn btn-primary">Save registration</button>
          </div>
        </form>
      </section>
    </main>
  );
}
