import { useEffect, useMemo, useRef, useState } from "react";
import {
  bulkImportUids,
  createUrlTagBatch,
  listTagBatches,
  listTagInventory,
} from "../client/nfcTagsClient";
import type { NfcTag, NfcTagBatchSummary } from "../shared/types/nfcTags";

const inputClass =
  "premium-control h-10 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none focus:border-blue-400 focus:bg-white";

type Section = "url-batch" | "uid-import" | "batch-list";

function statusTone(status: string) {
  if (status === "ASSIGNED") return "bg-emerald-100 text-emerald-700";
  if (status === "DISABLED" || status === "LOST") return "bg-red-100 text-red-700";
  if (status === "VERIFIED") return "bg-blue-100 text-blue-700";
  return "bg-slate-100 text-slate-700";
}

function exportCsv(batch: NfcTagBatchSummary, tags: NfcTag[]) {
  const rows = [["Label", "Public Code", "Written Payload", "Written URL", "Physical UID", "Status"]];
  for (const t of tags) {
    rows.push([t.label ?? "", t.publicCode, t.writtenPayload ?? "", t.writtenUrl ?? "", t.physicalUid ?? "", t.status]);
  }
  const csv = rows.map((r) => r.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${batch.name.replace(/\s+/g, "_")}_tags.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function NfcBulkIssuingPage() {
  const [activeSection, setActiveSection] = useState<Section>("batch-list");

  // Shared error / notice banner
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // ── Section A: Create URL Tag Batch ──────────────────────────────────────
  const [urlBatchName, setUrlBatchName] = useState("");
  const [urlQuantity, setUrlQuantity] = useState("10");
  const [urlLabelPrefix, setUrlLabelPrefix] = useState("");
  const [urlBatchLoading, setUrlBatchLoading] = useState(false);

  async function handleCreateUrlBatch() {
    const qty = parseInt(urlQuantity, 10);
    if (!urlBatchName.trim()) { setError("Batch name is required."); return; }
    if (!qty || qty < 1 || qty > 500) { setError("Quantity must be between 1 and 500."); return; }
    setError("");
    setNotice("");
    setUrlBatchLoading(true);
    try {
      const result = await createUrlTagBatch({
        name: urlBatchName.trim(),
        quantity: qty,
        labelPrefix: urlLabelPrefix.trim() || undefined,
      });
      setNotice(`Batch "${result.batch.name}" created with ${result.generated} URL tags.`);
      setUrlBatchName("");
      setUrlQuantity("10");
      setUrlLabelPrefix("");
      await loadBatches();
      setActiveSection("batch-list");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create batch.");
    } finally {
      setUrlBatchLoading(false);
    }
  }

  // ── Section B: Register UID Wristbands ───────────────────────────────────
  const [uidBatchName, setUidBatchName] = useState("");
  const [uidPasteText, setUidPasteText] = useState("");
  const [uidReason, setUidReason] = useState("");
  const [uidLoading, setUidLoading] = useState(false);

  const parsedUids = useMemo(
    () =>
      uidPasteText
        .split("\n")
        .map((l) => l.trim().toUpperCase())
        .filter(Boolean),
    [uidPasteText],
  );

  const uidDuplicates = useMemo(() => {
    const seen = new Set<string>();
    const dupes = new Set<string>();
    for (const uid of parsedUids) {
      if (seen.has(uid)) dupes.add(uid);
      seen.add(uid);
    }
    return dupes;
  }, [parsedUids]);

  async function handleUidImport() {
    if (!uidBatchName.trim()) { setError("Batch name is required."); return; }
    if (!parsedUids.length) { setError("Paste at least one UID."); return; }
    if (uidDuplicates.size > 0) { setError(`Duplicate UIDs: ${[...uidDuplicates].join(", ")}`); return; }
    setError("");
    setNotice("");
    setUidLoading(true);
    try {
      const result = await bulkImportUids({
        batchName: uidBatchName.trim(),
        uids: parsedUids,
        reason: uidReason.trim() || undefined,
      });
      setNotice(`Registered ${result.registered} UID wristband(s) in batch "${result.batch.name}".`);
      setUidBatchName("");
      setUidPasteText("");
      setUidReason("");
      await loadBatches();
      setActiveSection("batch-list");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to import UIDs.");
    } finally {
      setUidLoading(false);
    }
  }

  // ── Section C: Batch list + inventory drill-down ─────────────────────────
  const [batches, setBatches] = useState<NfcTagBatchSummary[]>([]);
  const [batchesLoading, setBatchesLoading] = useState(true);

  // Inventory drill-down
  const [drillBatch, setDrillBatch] = useState<NfcTagBatchSummary | null>(null);
  const [inventoryTags, setInventoryTags] = useState<NfcTag[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [inventorySearch, setInventorySearch] = useState("");
  const [inventoryStatus, setInventoryStatus] = useState("ALL");
  const drillRef = useRef<HTMLDivElement | null>(null);

  async function loadBatches() {
    const result = await listTagBatches();
    setBatches(result.batches);
  }

  useEffect(() => {
    setBatchesLoading(true);
    loadBatches()
      .catch((e: Error) => setError(e.message))
      .finally(() => setBatchesLoading(false));
  }, []);

  async function openDrill(batch: NfcTagBatchSummary) {
    setDrillBatch(batch);
    setInventorySearch("");
    setInventoryStatus("ALL");
    setInventoryLoading(true);
    try {
      const result = await listTagInventory({ batchId: batch.id });
      setInventoryTags(result.tags);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load inventory.");
    } finally {
      setInventoryLoading(false);
      setTimeout(() => drillRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    }
  }

  const filteredInventory = useMemo(() => {
    let tags = inventoryTags;
    if (inventoryStatus !== "ALL") {
      const unallocatedSet = new Set(["UNALLOCATED", "GENERATED", "WRITTEN", "VERIFIED", "REGISTERED", "UNASSIGNED"]);
      if (inventoryStatus === "UNALLOCATED") {
        tags = tags.filter((t) => unallocatedSet.has(t.status));
      } else {
        tags = tags.filter((t) => t.status === inventoryStatus);
      }
    }
    if (inventorySearch.trim()) {
      const q = inventorySearch.trim().toLowerCase();
      tags = tags.filter(
        (t) =>
          t.label?.toLowerCase().includes(q) ||
          t.publicCode.toLowerCase().includes(q) ||
          (t.physicalUid?.toLowerCase().includes(q) ?? false) ||
          t.student?.name.toLowerCase().includes(q) ||
          t.student?.admissionNumber.toLowerCase().includes(q),
      );
    }
    return tags;
  }, [inventoryTags, inventoryStatus, inventorySearch]);

  const sectionTabClass = (s: Section) =>
    `px-4 py-2 text-sm font-bold rounded-lg transition-colors ${
      activeSection === s
        ? "bg-blue-600 text-white"
        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
    }`;

  return (
    <main className="grid gap-5">
      <header className="page-header">
        <p className="text-xs font-bold uppercase tracking-wide text-blue-600">NFC Operations</p>
        <h1 className="text-xl font-bold tracking-tight text-slate-950 sm:text-2xl">Bulk Tag Issuing</h1>
        <p className="mt-1 text-sm text-slate-500">
          Create URL tag batches or register UID wristbands into inventory before allocating to students.
        </p>
      </header>

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
      {notice ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</div> : null}

      {/* Section tabs */}
      <div className="flex flex-wrap gap-2">
        <button type="button" className={sectionTabClass("batch-list")} onClick={() => setActiveSection("batch-list")}>
          Batches
        </button>
        <button type="button" className={sectionTabClass("url-batch")} onClick={() => { setActiveSection("url-batch"); setError(""); setNotice(""); }}>
          + Create URL Batch
        </button>
        <button type="button" className={sectionTabClass("uid-import")} onClick={() => { setActiveSection("uid-import"); setError(""); setNotice(""); }}>
          + Register UID Wristbands
        </button>
      </div>

      {/* ── Section A: Create URL Batch ────────────────────────────────────── */}
      {activeSection === "url-batch" ? (
        <div className="premium-card rounded-xl p-5">
          <h2 className="text-base font-bold text-slate-950">Create URL Tag Batch</h2>
          <p className="mt-1 text-sm text-slate-500">
            Generates NFC tag records. Each tag gets an NFC text payload{" "}
            <code className="rounded bg-slate-100 px-1 text-xs">SCNFC:&lt;code&gt;</code> — write this to the physical
            chip. A tap URL (e.g.{" "}
            <code className="rounded bg-slate-100 px-1 text-xs">/t/abc123…</code>) is also generated as a fallback for
            URL-mode readers.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-xs font-bold uppercase text-slate-500">
              Batch name
              <input
                className={inputClass}
                value={urlBatchName}
                onChange={(e) => setUrlBatchName(e.target.value)}
                placeholder="e.g. S1 East Wing 2026"
              />
            </label>
            <label className="grid gap-1 text-xs font-bold uppercase text-slate-500">
              Quantity (1–500)
              <input
                className={inputClass}
                type="number"
                min={1}
                max={500}
                value={urlQuantity}
                onChange={(e) => setUrlQuantity(e.target.value)}
              />
            </label>
            <label className="grid gap-1 text-xs font-bold uppercase text-slate-500">
              Label prefix (optional)
              <input
                className={inputClass}
                value={urlLabelPrefix}
                onChange={(e) => setUrlLabelPrefix(e.target.value)}
                placeholder="e.g. S1-EW → S1-EW-0001"
              />
            </label>
          </div>
          <div className="mt-4">
            <button
              type="button"
              className="btn btn-primary"
              disabled={urlBatchLoading}
              onClick={() => void handleCreateUrlBatch()}
            >
              {urlBatchLoading ? "Generating…" : "Generate Batch"}
            </button>
          </div>
        </div>
      ) : null}

      {/* ── Section B: Register UID Wristbands ─────────────────────────────── */}
      {activeSection === "uid-import" ? (
        <div className="premium-card rounded-xl p-5">
          <h2 className="text-base font-bold text-slate-950">Register UID Wristbands</h2>
          <p className="mt-1 text-sm text-slate-500">
            Paste or scan wristband UIDs — one per line. These are registered as{" "}
            <strong>REGISTERED</strong> inventory records, ready to allocate to students on the{" "}
            <strong>Bulk Allocation</strong> page.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-xs font-bold uppercase text-slate-500">
              Batch name
              <input
                className={inputClass}
                value={uidBatchName}
                onChange={(e) => setUidBatchName(e.target.value)}
                placeholder="e.g. S1 Wristbands April 2026"
              />
            </label>
            <label className="grid gap-1 text-xs font-bold uppercase text-slate-500">
              Reason (optional)
              <input
                className={inputClass}
                value={uidReason}
                onChange={(e) => setUidReason(e.target.value)}
                placeholder="e.g. Term 2 batch"
              />
            </label>
          </div>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            <label className="grid gap-1 text-xs font-bold uppercase text-slate-500">
              Scanned UIDs (one per line)
              <textarea
                className="premium-control rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-sm focus:border-blue-400 focus:bg-white"
                rows={10}
                value={uidPasteText}
                onChange={(e) => setUidPasteText(e.target.value)}
                placeholder={"AB1234CD\nEF5678GH\n..."}
              />
            </label>
            <div>
              <p className="text-xs font-bold uppercase text-slate-500">
                Preview ({parsedUids.length} UID{parsedUids.length !== 1 ? "s" : ""})
              </p>
              {uidDuplicates.size > 0 ? (
                <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  Duplicates detected: {[...uidDuplicates].join(", ")}
                </div>
              ) : null}
              <div className="mt-2 max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50">
                {parsedUids.length === 0 ? (
                  <p className="p-4 text-sm text-slate-500">No UIDs entered.</p>
                ) : (
                  <table className="w-full text-sm">
                    <tbody>
                      {parsedUids.map((uid, i) => (
                        <tr
                          key={i}
                          className={`border-b border-slate-100 last:border-0 ${uidDuplicates.has(uid) ? "bg-amber-50" : ""}`}
                        >
                          <td className="px-3 py-1.5 font-mono font-bold text-slate-800">{uid}</td>
                          {uidDuplicates.has(uid) ? (
                            <td className="px-3 py-1.5 text-xs text-amber-700">duplicate</td>
                          ) : null}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              className="btn btn-primary"
              disabled={uidLoading || !parsedUids.length || uidDuplicates.size > 0}
              onClick={() => void handleUidImport()}
            >
              {uidLoading ? "Registering…" : `Register ${parsedUids.length} Wristband(s)`}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setUidPasteText("")}>
              Clear
            </button>
          </div>
        </div>
      ) : null}

      {/* ── Section C: Batch list ───────────────────────────────────────────── */}
      {activeSection === "batch-list" ? (
        <section className="premium-card rounded-xl p-4">
          <div className="mb-3">
            <h2 className="text-base font-bold text-slate-950">All Batches</h2>
            <p className="mt-1 text-sm text-slate-500">
              {batchesLoading ? "Loading…" : `${batches.length} batch${batches.length !== 1 ? "es" : ""}`}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-separate border-spacing-y-2 text-left text-sm">
              <thead className="text-xs font-bold uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2">Batch name</th>
                  <th className="px-3 py-2">Mode</th>
                  <th className="px-3 py-2">Total</th>
                  <th className="px-3 py-2">Written / Verified</th>
                  <th className="px-3 py-2">Unallocated</th>
                  <th className="px-3 py-2">Assigned</th>
                  <th className="px-3 py-2">Disabled / Lost</th>
                  <th className="px-3 py-2">Created</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((b) => (
                  <tr key={b.id} className="bg-white shadow-sm">
                    <td className="rounded-l-xl border-y border-l border-slate-200 px-3 py-3 font-bold text-slate-950">
                      {b.name}
                    </td>
                    <td className="border-y border-slate-200 px-3 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-bold ${
                          b.tagMode === "URL" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"
                        }`}
                      >
                        {b.tagMode}
                      </span>
                    </td>
                    <td className="border-y border-slate-200 px-3 py-3 font-bold text-slate-800">{b.totalTags}</td>
                    <td className="border-y border-slate-200 px-3 py-3 text-slate-600">
                      {b.written} / {b.verified}
                    </td>
                    <td className="border-y border-slate-200 px-3 py-3 text-slate-600">{b.unallocated}</td>
                    <td className="border-y border-slate-200 px-3 py-3 text-emerald-700 font-bold">{b.assigned}</td>
                    <td className="border-y border-slate-200 px-3 py-3 text-red-700">{b.disabled + b.lost}</td>
                    <td className="border-y border-slate-200 px-3 py-3 text-slate-500 text-xs">
                      {new Date(b.createdAt).toLocaleDateString()}
                    </td>
                    <td className="rounded-r-xl border-y border-r border-slate-200 px-3 py-3">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="btn btn-secondary text-xs"
                          onClick={() => void openDrill(b)}
                        >
                          View
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary text-xs"
                          onClick={() => void listTagInventory({ batchId: b.id }).then((r) => exportCsv(b, r.tags))}
                        >
                          Export CSV
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {batches.length === 0 && !batchesLoading ? (
                  <tr>
                    <td
                      className="rounded-xl border border-slate-200 bg-white px-3 py-8 text-center text-sm text-slate-500"
                      colSpan={9}
                    >
                      No batches yet. Use the buttons above to create or import.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {/* ── Inventory drill-down (shown below batch list when opened) ───────── */}
      {drillBatch ? (
        <section ref={drillRef} className="premium-card rounded-xl p-4">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase text-blue-600">{drillBatch.tagMode} batch</p>
              <h2 className="text-base font-bold text-slate-950">{drillBatch.name}</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <input
                className={`${inputClass} min-w-[180px]`}
                value={inventorySearch}
                onChange={(e) => setInventorySearch(e.target.value)}
                placeholder="Search UID, label, student…"
              />
              <select
                className={inputClass}
                value={inventoryStatus}
                onChange={(e) => setInventoryStatus(e.target.value)}
              >
                <option value="ALL">All</option>
                <option value="UNALLOCATED">Unallocated</option>
                <option value="ASSIGNED">Assigned</option>
                <option value="DISABLED">Disabled</option>
                <option value="LOST">Lost</option>
              </select>
              <button
                type="button"
                className="btn btn-secondary text-xs"
                onClick={() => exportCsv(drillBatch, inventoryTags)}
              >
                Export CSV
              </button>
              <button type="button" className="btn btn-secondary text-xs" onClick={() => setDrillBatch(null)}>
                Close
              </button>
            </div>
          </div>
          {inventoryLoading ? (
            <p className="py-6 text-center text-sm text-slate-500">Loading inventory…</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] border-separate border-spacing-y-1 text-left text-sm">
                <thead className="text-xs font-bold uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2">
                      {drillBatch.tagMode === "UID" ? "Physical UID" : "Public Code"}
                    </th>
                    <th className="px-3 py-2">Label</th>
                    {drillBatch.tagMode !== "UID" ? <th className="px-3 py-2">NFC Payload</th> : null}
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Assigned to</th>
                    <th className="px-3 py-2">Assigned at</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInventory.map((t) => (
                    <tr key={t.id} className="bg-white">
                      <td className="rounded-l-xl border-y border-l border-slate-200 px-3 py-2 font-mono text-xs font-bold text-slate-800">
                        {drillBatch.tagMode === "UID" ? t.physicalUid ?? "—" : t.publicCode}
                      </td>
                      <td className="border-y border-slate-200 px-3 py-2 text-slate-600">{t.label ?? "—"}</td>
                      {drillBatch.tagMode !== "UID" ? (
                        <td className="border-y border-slate-200 px-3 py-2 font-mono text-xs text-slate-600">
                          {t.writtenPayload ?? "—"}
                        </td>
                      ) : null}
                      <td className="border-y border-slate-200 px-3 py-2">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-bold ${statusTone(t.status)}`}>
                          {t.status}
                        </span>
                      </td>
                      <td className="border-y border-slate-200 px-3 py-2 text-slate-600">
                        {t.student ? `${t.student.name} (${t.student.admissionNumber})` : "—"}
                      </td>
                      <td className="rounded-r-xl border-y border-r border-slate-200 px-3 py-2 text-xs text-slate-500">
                        {t.assignedAt ? new Date(t.assignedAt).toLocaleDateString() : "—"}
                      </td>
                    </tr>
                  ))}
                  {filteredInventory.length === 0 ? (
                    <tr>
                      <td
                        className="rounded-xl border border-slate-200 bg-white px-3 py-6 text-center text-sm text-slate-500"
                        colSpan={drillBatch.tagMode !== "UID" ? 6 : 5}
                      >
                        No tags match this filter.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}
    </main>
  );
}
