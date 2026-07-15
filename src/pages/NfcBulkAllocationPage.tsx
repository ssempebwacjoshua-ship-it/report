import { useEffect, useMemo, useRef, useState } from "react";
import { BrandedLoader } from "../components/BrandedLoader";
import {
  amendStudentCredential,
  bulkAllocateStudentCredentials,
  deactivateStudentCredential,
  fetchCredentialAllocation,
  issueStudentCredential,
} from "../client/studentCredentialsClient";
import { bulkAllocateFromInventory, listTagBatches, listTagInventory } from "../client/nfcTagsClient";
import { fetchSchoolStructure } from "../client/schoolStructureClient";
import type { AllocationRow, AllocationStatus, StudentCredential } from "../shared/types/studentCredentials";
import type { CanonicalClassRecord, StreamRecord } from "../client/schoolStructureClient";
import type { NfcTag, NfcTagBatchSummary } from "../shared/types/nfcTags";

const inputClass =
  "premium-control h-10 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none focus:border-blue-400 focus:bg-white";

function statusTone(status: AllocationStatus) {
  if (status === "ALLOCATED") return "bg-emerald-100 text-emerald-700";
  if (status === "DEACTIVATED") return "bg-amber-100 text-amber-800";
  return "bg-slate-100 text-slate-700";
}

function SummaryCard({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className={`rounded-xl border p-4 ${tone ?? "border-slate-200 bg-white"}`}>
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-black text-slate-950">{value}</p>
    </div>
  );
}

export function NfcBulkAllocationPage() {
  const fastInputRef = useRef<HTMLInputElement | null>(null);

  const [classes, setClasses] = useState<CanonicalClassRecord[]>([]);
  const [streams, setStreams] = useState<StreamRecord[]>([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedStreamId, setSelectedStreamId] = useState("");
  const [statusFilter, setStatusFilter] = useState<AllocationStatus | "ALL">("ALL");
  const [search, setSearch] = useState("");

  const [rows, setRows] = useState<AllocationRow[]>([]);
  const [summary, setSummary] = useState({ totalStudents: 0, allocated: 0, unallocated: 0, deactivated: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // Per-row UID inputs for table-level allocation
  const [rowUIDs, setRowUIDs] = useState<Record<string, string>>({});
  const [rowLoading, setRowLoading] = useState<Record<string, boolean>>({});

  // Deactivation reason per row
  const [deactivateReasons, setDeactivateReasons] = useState<Record<string, string>>({});

  // Amend modal state
  const [amendTarget, setAmendTarget] = useState<StudentCredential | null>(null);
  const [amendUID, setAmendUID] = useState("");
  const [amendReason, setAmendReason] = useState("");
  const [amendLoading, setAmendLoading] = useState(false);

  // Bulk paste mode
  const [pasteMode, setPasteMode] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [pasteReason, setPasteReason] = useState("");
  const [pasteLoading, setPasteLoading] = useState(false);

  // Inventory mode (allocate from pre-registered UID batch)
  const [inventoryMode, setInventoryMode] = useState(false);
  const [invBatches, setInvBatches] = useState<NfcTagBatchSummary[]>([]);
  const [invSelectedBatch, setInvSelectedBatch] = useState("");
  const [invTags, setInvTags] = useState<NfcTag[]>([]);
  const [invLoading, setInvLoading] = useState(false);
  const [invReason, setInvReason] = useState("");
  const [invAllocLoading, setInvAllocLoading] = useState(false);
  // Map: tagId → studentId (user's mapping in the table)
  const [invAssignments, setInvAssignments] = useState<Record<string, string>>({});

  // Derived: unallocated students for fast allocation and paste preview
  const unallocatedRows = useMemo(
    () => rows.filter((r) => r.allocationStatus === "UNALLOCATED"),
    [rows],
  );

  const pasteUIDs = useMemo(
    () =>
      pasteText
        .split("\n")
        .map((line) => line.trim().toUpperCase())
        .filter(Boolean),
    [pasteText],
  );

  const pastePreview = useMemo(
    () =>
      pasteUIDs.slice(0, unallocatedRows.length).map((uid, i) => ({
        student: unallocatedRows[i].student,
        uid,
      })),
    [pasteUIDs, unallocatedRows],
  );

  // Inventory mode: load all batches when toggled on
  useEffect(() => {
    if (!inventoryMode) return;
    listTagBatches()
      .then((r) => setInvBatches(r.batches))
      .catch((e: Error) => setError(e.message));
  }, [inventoryMode]);

  // Inventory mode: load unallocated tags when batch is selected
  useEffect(() => {
    if (!invSelectedBatch) { setInvTags([]); setInvAssignments({}); return; }
    setInvLoading(true);
    listTagInventory({ batchId: invSelectedBatch, status: "UNALLOCATED" })
      .then((r) => { setInvTags(r.tags); setInvAssignments({}); })
      .catch((e: Error) => setError(e.message))
      .finally(() => setInvLoading(false));
  }, [invSelectedBatch]);

  async function handleInventoryAllocate() {
    const pairs = invTags
      .map((t) => ({ tagId: t.id, studentId: invAssignments[t.id] ?? "" }))
      .filter((p) => p.studentId);
    if (!pairs.length) { setError("Select a student for at least one tag."); return; }
    if (!invReason.trim()) { setError("Reason is required for inventory allocation."); return; }
    setError("");
    setNotice("");
    setInvAllocLoading(true);
    try {
      const result = await bulkAllocateFromInventory({ assignments: pairs, reason: invReason });
      setNotice(`Allocated ${result.tags.length} wristband(s) from inventory.`);
      setInvAssignments({});
      setInvReason("");
      // Refresh inventory and allocation list
      const [refreshedInv] = await Promise.allSettled([
        listTagInventory({ batchId: invSelectedBatch, tagMode: "UID", status: "UNALLOCATED" }),
        loadAllocation(),
      ]);
      if (refreshedInv.status === "fulfilled") setInvTags(refreshedInv.value.tags);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Inventory allocation failed.");
    } finally {
      setInvAllocLoading(false);
    }
  }

  // Load school structure (classes + streams) once
  useEffect(() => {
    fetchSchoolStructure()
      .then((data) => setClasses(data.canonicalClasses))
      .catch(() => {/* non-fatal */});
  }, []);

  // Update available streams when class changes
  useEffect(() => {
    const cls = classes.find((c) => c.id === selectedClassId);
    setStreams(cls?.streams ?? []);
    setSelectedStreamId("");
  }, [selectedClassId, classes]);

  async function loadAllocation() {
    const result = await fetchCredentialAllocation({
      classId: selectedClassId || undefined,
      streamId: selectedStreamId || undefined,
      status: statusFilter,
      search: search || undefined,
    });
    setRows(result.rows);
    setSummary(result.summary);
  }

  // Initial load
  useEffect(() => {
    setLoading(true);
    loadAllocation()
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reload on filter change (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      void loadAllocation().catch((e: Error) => setError(e.message));
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClassId, selectedStreamId, statusFilter, search]);

  async function allocateRow(row: AllocationRow) {
    const uid = rowUIDs[row.student.id]?.trim();
    if (!uid) return;
    setRowLoading((prev) => ({ ...prev, [row.student.id]: true }));
    setError("");
    setNotice("");
    try {
      const result = await issueStudentCredential({ studentId: row.student.id, credentialUID: uid });
      setRowUIDs((prev) => ({ ...prev, [row.student.id]: "" }));
      setNotice(`Wristband allocated to ${row.student.name}.`);
      setRows((prev) =>
        prev.map((r) =>
          r.student.id === row.student.id
            ? { ...r, activeCredential: result.credential, allocationStatus: "ALLOCATED" }
            : r,
        ),
      );
      setSummary((prev) => ({ ...prev, allocated: prev.allocated + 1, unallocated: Math.max(0, prev.unallocated - 1) }));
      try { await loadAllocation(); } catch { /* non-fatal */ }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not allocate wristband");
    } finally {
      setRowLoading((prev) => ({ ...prev, [row.student.id]: false }));
    }
  }

  async function deactivateRow(credential: StudentCredential) {
    const reason = deactivateReasons[credential.id]?.trim();
    if (!reason) { setError("Deactivation reason is required."); return; }
    setError("");
    setNotice("");
    try {
      await deactivateStudentCredential(credential.id, reason);
      setDeactivateReasons((prev) => ({ ...prev, [credential.id]: "" }));
      setNotice("Wristband deactivated.");
      setRows((prev) =>
        prev.map((r) =>
          r.activeCredential?.id === credential.id
            ? {
                ...r,
                activeCredential: null,
                deactivatedCredentialsCount: r.deactivatedCredentialsCount + 1,
                allocationStatus: "DEACTIVATED",
              }
            : r,
        ),
      );
      setSummary((prev) => ({ ...prev, allocated: Math.max(0, prev.allocated - 1), deactivated: prev.deactivated + 1 }));
      try { await loadAllocation(); } catch { /* non-fatal */ }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not deactivate wristband");
    }
  }

  function openAmend(credential: StudentCredential) {
    setAmendTarget(credential);
    setAmendUID(credential.credentialUID);
    setAmendReason("");
    setError("");
    setNotice("");
  }

  async function handleAmend() {
    if (!amendTarget) return;
    setAmendLoading(true);
    setError("");
    try {
      const result = await amendStudentCredential(amendTarget.id, {
        credentialUID: amendUID !== amendTarget.credentialUID ? amendUID : undefined,
        reason: amendReason,
      });
      setRows((prev) =>
        prev.map((r) =>
          r.activeCredential?.id === result.credential.id
            ? { ...r, activeCredential: result.credential }
            : r,
        ),
      );
      setNotice("Wristband amended.");
      setAmendTarget(null);
      try { await loadAllocation(); } catch {
        setError("Wristband amended, but the list could not refresh. Reload the page.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not amend wristband");
    } finally {
      setAmendLoading(false);
    }
  }

  async function handleBulkPaste() {
    if (!pastePreview.length) return;
    if (!pasteReason.trim()) { setError("Reason is required for bulk allocation."); return; }
    setPasteLoading(true);
    setError("");
    setNotice("");
    try {
      const result = await bulkAllocateStudentCredentials({
        reason: pasteReason,
        assignments: pastePreview.map((p) => ({ studentId: p.student.id, credentialUID: p.uid })),
      });
      setNotice(`${result.credentials.length} wristband(s) allocated.`);
      setPasteText("");
      setPasteReason("");
      setPasteMode(false);
      try { await loadAllocation(); } catch {
        setError("Bulk allocation succeeded, but the list could not refresh. Reload the page.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bulk allocation failed");
    } finally {
      setPasteLoading(false);
    }
  }

  const nextUnallocated = unallocatedRows[0] ?? null;

  if (loading && rows.length === 0) {
    return <BrandedLoader message="Loading wristbands..." />;
  }

  return (
    <main className="grid gap-5">
      <header className="page-header flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-blue-600">NFC Operations</p>
          <h1 className="text-xl font-bold tracking-tight text-slate-950 sm:text-2xl">Bulk Wristband Allocation</h1>
          <p className="mt-1 text-sm text-slate-500">Allocate NFC wristbands class by class.</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className={`btn ${inventoryMode ? "btn-primary" : "btn-secondary"} text-xs`}
            onClick={() => { setInventoryMode((v) => !v); setPasteMode(false); setError(""); setNotice(""); }}
          >
            {inventoryMode ? "Exit Inventory Mode" : "From Inventory"}
          </button>
          <button
            type="button"
            className={`btn ${pasteMode ? "btn-secondary" : "btn-primary"} text-xs`}
            onClick={() => { setPasteMode((v) => !v); setInventoryMode(false); setError(""); setNotice(""); }}
          >
            {pasteMode ? "Exit Bulk Paste" : "Bulk Paste Mode"}
          </button>
        </div>
      </header>

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
      {notice ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</div> : null}

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <select
          className={inputClass}
          value={selectedClassId}
          onChange={(e) => setSelectedClassId(e.target.value)}
        >
          <option value="">All classes</option>
          {classes.map((cls) => (
            <option key={cls.id} value={cls.id}>{cls.name}</option>
          ))}
        </select>
        <select
          className={inputClass}
          value={selectedStreamId}
          onChange={(e) => setSelectedStreamId(e.target.value)}
          disabled={!selectedClassId}
        >
          <option value="">All streams</option>
          {streams.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <select
          className={inputClass}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as AllocationStatus | "ALL")}
        >
          <option value="ALL">All statuses</option>
          <option value="ALLOCATED">Allocated</option>
          <option value="UNALLOCATED">Unallocated</option>
          <option value="DEACTIVATED">Deactivated / Lost</option>
        </select>
        <input
          className={`${inputClass} min-w-[200px]`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search student or UID"
        />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard label="Total Students" value={summary.totalStudents} />
        <SummaryCard label="Allocated" value={summary.allocated} tone="border-emerald-200 bg-emerald-50" />
        <SummaryCard label="Unallocated" value={summary.unallocated} tone="border-slate-200 bg-white" />
        <SummaryCard label="Deactivated / Lost" value={summary.deactivated} tone="border-amber-200 bg-amber-50" />
      </div>

      {/* Bulk paste mode */}
      {pasteMode && !inventoryMode ? (
        <div className="premium-card rounded-xl p-5">
          <h2 className="text-base font-bold text-slate-950">Bulk Paste Mode</h2>
          <p className="mt-1 text-sm text-slate-500">
            Scan or paste wristband UIDs one per line. They will be assigned in order to the{" "}
            <strong>{unallocatedRows.length}</strong> unallocated students visible below.
          </p>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            <label className="grid gap-1 text-xs font-bold uppercase text-slate-500">
              Scanned UIDs (one per line)
              <textarea
                className="premium-control rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-sm focus:border-blue-400 focus:bg-white"
                rows={8}
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder={"AB1234CD\nEF5678GH\n..."}
              />
            </label>
            <div>
              <p className="text-xs font-bold uppercase text-slate-500">Preview ({pastePreview.length} assignments)</p>
              <div className="mt-2 max-h-52 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50">
                {pastePreview.length === 0 ? (
                  <p className="p-4 text-sm text-slate-500">No UIDs scanned yet.</p>
                ) : (
                  <table className="w-full text-sm">
                    <tbody>
                      {pastePreview.map((p) => (
                        <tr key={p.student.id} className="border-b border-slate-100 last:border-0">
                          <td className="px-3 py-2 font-mono font-bold text-slate-800">{p.uid}</td>
                          <td className="px-3 py-2 text-slate-700">{p.student.name}</td>
                          <td className="px-3 py-2 text-xs text-slate-500">{p.student.admissionNumber}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              {pasteUIDs.length > unallocatedRows.length ? (
                <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  {pasteUIDs.length - unallocatedRows.length} extra UID(s) will be ignored — there are only{" "}
                  {unallocatedRows.length} unallocated student(s). Remove extra UIDs before submitting.
                </div>
              ) : null}
            </div>
          </div>
          <label className="mt-3 grid gap-1 text-xs font-bold uppercase text-slate-500">
            Reason for bulk allocation
            <input
              className={inputClass}
              value={pasteReason}
              onChange={(e) => setPasteReason(e.target.value)}
              placeholder="Required"
            />
          </label>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              className="btn btn-primary"
              disabled={pasteLoading || pastePreview.length === 0 || !pasteReason.trim()}
              onClick={() => void handleBulkPaste()}
            >
              {pasteLoading ? "Allocating…" : `Allocate ${pastePreview.length} Wristband(s)`}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => { setPasteText(""); setPasteReason(""); }}>
              Clear
            </button>
          </div>
        </div>
      ) : null}

      {/* Inventory mode panel */}
      {inventoryMode ? (
        <div className="premium-card rounded-xl p-5">
          <h2 className="text-base font-bold text-slate-950">Allocate from Inventory</h2>
          <p className="mt-1 text-sm text-slate-500">
            Select an inventory batch (UID wristbands or NFC text payload tags), then map each unallocated tag to a student.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <select
              className={inputClass}
              value={invSelectedBatch}
              onChange={(e) => setInvSelectedBatch(e.target.value)}
            >
              <option value="">Select batch…</option>
              {invBatches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} [{b.tagMode}] ({b.unallocated} unallocated)
                </option>
              ))}
            </select>
          </div>
          {invLoading ? (
            <p className="mt-4 text-sm text-slate-500">Loading inventory…</p>
          ) : invSelectedBatch && invTags.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">No unallocated UID wristbands in this batch.</p>
          ) : invTags.length > 0 ? (
            <>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[600px] border-separate border-spacing-y-1 text-left text-sm">
                  <thead className="text-xs font-bold uppercase text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Physical UID</th>
                      <th className="px-3 py-2">Label</th>
                      <th className="px-3 py-2">Assign to Student</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invTags.map((tag) => {
                      const selectedElsewhere = new Set(
                        Object.entries(invAssignments)
                          .filter(([tid, sid]) => tid !== tag.id && sid)
                          .map(([, sid]) => sid),
                      );
                      return (
                        <tr key={tag.id} className="bg-white">
                          <td className="rounded-l-xl border-y border-l border-slate-200 px-3 py-2 font-mono text-xs font-bold text-slate-800">
                            {tag.physicalUid ?? tag.writtenPayload ?? "—"}
                          </td>
                          <td className="border-y border-slate-200 px-3 py-2 text-slate-600">{tag.label ?? "—"}</td>
                          <td className="rounded-r-xl border-y border-r border-slate-200 px-3 py-2">
                            <select
                              className={`${inputClass} w-full`}
                              value={invAssignments[tag.id] ?? ""}
                              onChange={(e) =>
                                setInvAssignments((prev) => ({ ...prev, [tag.id]: e.target.value }))
                              }
                            >
                              <option value="">— not assigned —</option>
                              {rows
                                .filter((r) => r.allocationStatus !== "ALLOCATED")
                                .map((r) => (
                                  <option
                                    key={r.student.id}
                                    value={r.student.id}
                                    disabled={selectedElsewhere.has(r.student.id)}
                                  >
                                    {r.student.name} ({r.student.admissionNumber})
                                    {selectedElsewhere.has(r.student.id) ? " ✓" : ""}
                                  </option>
                                ))}
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <label className="mt-3 grid gap-1 text-xs font-bold uppercase text-slate-500">
                Reason
                <input
                  className={inputClass}
                  value={invReason}
                  onChange={(e) => setInvReason(e.target.value)}
                  placeholder="Required"
                />
              </label>
              <div className="mt-4">
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={
                    invAllocLoading ||
                    !invReason.trim() ||
                    !Object.values(invAssignments).some(Boolean)
                  }
                  onClick={() => void handleInventoryAllocate()}
                >
                  {invAllocLoading
                    ? "Allocating…"
                    : `Allocate ${Object.values(invAssignments).filter(Boolean).length} Wristband(s)`}
                </button>
              </div>
            </>
          ) : null}
        </div>
      ) : null}

      {/* Fast allocation panel */}
      {!pasteMode && !inventoryMode && nextUnallocated ? (
        <div className="premium-card rounded-xl p-5">
          <h2 className="text-base font-bold text-slate-950">Fast Allocation</h2>
          <p className="mt-1 text-sm text-slate-500">
            Next unallocated student:{" "}
            <strong>{nextUnallocated.student.name}</strong>{" "}
            <span className="text-slate-400">({nextUnallocated.student.admissionNumber})</span>
            {nextUnallocated.student.className
              ? ` · ${nextUnallocated.student.className}/${nextUnallocated.student.streamName ?? ""}`
              : ""}
          </p>
          <div className="mt-3 flex gap-2">
            <input
              ref={fastInputRef}
              className={`${inputClass} font-mono uppercase`}
              value={rowUIDs[nextUnallocated.student.id] ?? ""}
              onChange={(e) =>
                setRowUIDs((prev) => ({ ...prev, [nextUnallocated.student.id]: e.target.value }))
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") void allocateRow(nextUnallocated);
              }}
              placeholder="Tap wristband"
            />
            <button
              type="button"
              className="btn btn-primary"
              disabled={!rowUIDs[nextUnallocated.student.id]?.trim() || rowLoading[nextUnallocated.student.id]}
              onClick={() => void allocateRow(nextUnallocated)}
            >
              {rowLoading[nextUnallocated.student.id] ? "Allocating…" : "Allocate"}
            </button>
          </div>
        </div>
      ) : null}

      {/* Main table */}
      <section className="premium-card rounded-xl p-4">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-950">Students</h2>
            <p className="mt-1 text-sm text-slate-500">
              {loading ? "Loading…" : `${rows.length} student(s) shown`}
            </p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-separate border-spacing-y-2 text-left text-sm">
            <thead className="text-xs font-bold uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">Student</th>
                <th className="px-3 py-2">Admission No.</th>
                <th className="px-3 py-2">Class / Stream</th>
                <th className="px-3 py-2">Current Wristband</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.student.id} className="bg-white shadow-sm">
                  <td className="rounded-l-xl border-y border-l border-slate-200 px-3 py-3 font-bold text-slate-950">
                    {row.student.name}
                  </td>
                  <td className="border-y border-slate-200 px-3 py-3 text-slate-600">
                    {row.student.admissionNumber}
                  </td>
                  <td className="border-y border-slate-200 px-3 py-3 text-slate-600">
                    {row.student.className
                      ? `${row.student.className} / ${row.student.streamName ?? "—"}`
                      : "—"}
                  </td>
                  <td className="border-y border-slate-200 px-3 py-3">
                    {row.activeCredential ? (
                      <span className="font-mono font-bold text-slate-800">
                        {row.activeCredential.credentialUID}
                      </span>
                    ) : row.deactivatedCredentialsCount > 0 ? (
                      <span className="text-xs text-amber-700">
                        {row.deactivatedCredentialsCount} deactivated
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">None</span>
                    )}
                  </td>
                  <td className="border-y border-slate-200 px-3 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-bold ${statusTone(row.allocationStatus)}`}
                    >
                      {row.allocationStatus}
                    </span>
                  </td>
                  <td className="rounded-r-xl border-y border-r border-slate-200 px-3 py-3">
                    {row.allocationStatus === "UNALLOCATED" || row.allocationStatus === "DEACTIVATED" ? (
                      <div className="flex gap-2">
                        <input
                          className={`${inputClass} w-36 font-mono uppercase`}
                          value={rowUIDs[row.student.id] ?? ""}
                          onChange={(e) =>
                            setRowUIDs((prev) => ({ ...prev, [row.student.id]: e.target.value }))
                          }
                          onKeyDown={(e) => { if (e.key === "Enter") void allocateRow(row); }}
                          placeholder="UID"
                        />
                        <button
                          type="button"
                          className="btn btn-primary text-xs"
                          disabled={!rowUIDs[row.student.id]?.trim() || rowLoading[row.student.id]}
                          onClick={() => void allocateRow(row)}
                        >
                          {row.allocationStatus === "DEACTIVATED" ? "Issue New" : "Allocate"}
                        </button>
                      </div>
                    ) : row.activeCredential ? (
                      <div className="grid gap-2">
                        <div className="flex gap-2">
                          <input
                            className={`${inputClass} w-40`}
                            value={deactivateReasons[row.activeCredential.id] ?? ""}
                            onChange={(e) =>
                              setDeactivateReasons((prev) => ({
                                ...prev,
                                [row.activeCredential!.id]: e.target.value,
                              }))
                            }
                            placeholder="Deactivate reason"
                          />
                          <button
                            type="button"
                            className="btn btn-danger-light text-xs"
                            onClick={() => void deactivateRow(row.activeCredential!)}
                          >
                            Deactivate
                          </button>
                        </div>
                        <button
                          type="button"
                          className="btn btn-secondary justify-self-start text-xs"
                          onClick={() => openAmend(row.activeCredential!)}
                        >
                          Amend UID
                        </button>
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && !loading ? (
                <tr>
                  <td
                    className="rounded-xl border border-slate-200 bg-white px-3 py-6 text-center text-sm text-slate-500"
                    colSpan={6}
                  >
                    No students found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {/* Amend modal */}
      {amendTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-base font-bold text-slate-950">Amend Wristband UID</h2>
            <p className="mt-1 text-sm text-slate-500">
              Student: <strong>{amendTarget.student.name}</strong>
            </p>
            {error ? (
              <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
            ) : null}
            <div className="mt-4 grid gap-3">
              <label className="grid gap-1 text-xs font-bold uppercase text-slate-500">
                Wristband UID
                <input
                  className={`${inputClass} font-mono uppercase`}
                  value={amendUID}
                  onChange={(e) => setAmendUID(e.target.value)}
                />
              </label>
              <label className="grid gap-1 text-xs font-bold uppercase text-slate-500">
                Reason
                <input
                  className={inputClass}
                  value={amendReason}
                  onChange={(e) => setAmendReason(e.target.value)}
                  placeholder="Required"
                />
              </label>
            </div>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                className="btn btn-primary"
                disabled={amendLoading || !amendReason.trim()}
                onClick={() => void handleAmend()}
              >
                {amendLoading ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={amendLoading}
                onClick={() => setAmendTarget(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
