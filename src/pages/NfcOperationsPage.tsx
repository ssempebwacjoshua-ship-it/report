import { useCallback, useEffect, useRef, useState } from "react";
import type { NfcTag } from "../shared/types/nfcTags";
import {
  assignNfcTag,
  disableNfcTag,
  enableNfcTag,
  generateNfcTags,
  getNfcTagEvents,
  listNfcTags,
  unassignNfcTag,
} from "../client/nfcTagsClient";
import { fetchStudents } from "../client/studentsClient";
import type { StudentListItem } from "../shared/types/students";

type StatusFilter = "" | "UNASSIGNED" | "ASSIGNED" | "DISABLED" | "LOST";

const STATUS_COLORS: Record<string, string> = {
  UNASSIGNED: "bg-slate-100 text-slate-600",
  ASSIGNED:   "bg-emerald-50 text-emerald-700",
  DISABLED:   "bg-red-50 text-red-700",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider ${STATUS_COLORS[status] ?? "bg-slate-100 text-slate-600"}`}>
      {status}
    </span>
  );
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).catch(() => {
    const el = document.createElement("textarea");
    el.value = text;
    document.body.appendChild(el);
    el.select();
    document.execCommand("copy");
    document.body.removeChild(el);
  });
}

export function NfcOperationsPage() {
  const [tags, setTags] = useState<NfcTag[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Generate panel
  const [generateCount, setGenerateCount] = useState(1);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  // Assign panel
  const [assignTagId, setAssignTagId] = useState<string | null>(null);
  const [assignSearch, setAssignSearch] = useState("");
  const [assignResults, setAssignResults] = useState<StudentListItem[]>([]);
  const [assignSearching, setAssignSearching] = useState(false);
  const [assignSelected, setAssignSelected] = useState<StudentListItem | null>(null);
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Events panel
  const [eventsTagId, setEventsTagId] = useState<string | null>(null);
  const [events, setEvents] = useState<{ id: string; result: string; userAgent: string | null; createdAt: string }[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);

  // Copied feedback
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Re-enable modal
  const [enableTarget, setEnableTarget] = useState<NfcTag | null>(null);
  const [enableReason, setEnableReason] = useState("");
  const [enableLoading, setEnableLoading] = useState(false);
  const [enableError, setEnableError] = useState<string | null>(null);

  const loadTags = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listNfcTags(statusFilter ? { status: statusFilter } : {});
      setTags(data.tags);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load tags.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { void loadTags(); }, [loadTags]);

  async function handleGenerate() {
    setGenerating(true);
    setGenerateError(null);
    try {
      const data = await generateNfcTags(generateCount);
      setTags((prev) => [...data.tags, ...prev]);
    } catch (e) {
      setGenerateError(e instanceof Error ? e.message : "Failed to generate tags.");
    } finally {
      setGenerating(false);
    }
  }

  function handleSearchInput(value: string) {
    setAssignSearch(value);
    setAssignSelected(null);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (!value.trim()) { setAssignResults([]); return; }
    searchDebounceRef.current = setTimeout(() => {
      setAssignSearching(true);
      fetchStudents({ search: value.trim(), isActive: "true" })
        .then((r) => setAssignResults(r.students.slice(0, 8)))
        .catch(() => setAssignResults([]))
        .finally(() => setAssignSearching(false));
    }, 280);
  }

  function selectStudent(student: StudentListItem) {
    setAssignSelected(student);
    setAssignSearch(`${student.studentName} — ${student.admissionNumber}`);
    setAssignResults([]);
  }

  async function handleAssign() {
    if (!assignTagId || !assignSelected) return;
    setAssignLoading(true);
    setAssignError(null);
    try {
      const updated = await assignNfcTag(assignTagId, assignSelected.id);
      setTags((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      setAssignTagId(null);
      setAssignSearch("");
      setAssignSelected(null);
      setAssignResults([]);
    } catch (e) {
      setAssignError(e instanceof Error ? e.message : "Failed to assign tag.");
    } finally {
      setAssignLoading(false);
    }
  }

  async function handleUnassign(tagId: string) {
    try {
      const res = await unassignNfcTag(tagId);
      setTags((prev) => prev.map((t) => (t.id === tagId ? { ...t, status: res.status as "UNASSIGNED", studentId: null, student: null } : t)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to unassign tag.");
    }
  }

  async function handleDisable(tagId: string) {
    try {
      const res = await disableNfcTag(tagId);
      setTags((prev) => prev.map((t) => (t.id === tagId ? { ...t, status: res.status as "DISABLED" } : t)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to disable tag.");
    }
  }

  async function handleEnable() {
    if (!enableTarget || !enableReason.trim()) return;
    setEnableLoading(true);
    setEnableError(null);
    try {
      const res = await enableNfcTag(enableTarget.id, enableReason.trim());
      setTags((prev) => prev.map((t) => (t.id === enableTarget.id ? { ...t, status: res.status as NfcTag["status"] } : t)));
      setEnableTarget(null);
      setEnableReason("");
    } catch (e) {
      setEnableError(e instanceof Error ? e.message : "Failed to re-enable tag.");
    } finally {
      setEnableLoading(false);
    }
  }

  async function handleViewEvents(tagId: string) {
    setEventsTagId(tagId);
    setEventsLoading(true);
    try {
      const data = await getNfcTagEvents(tagId);
      setEvents(data.events);
    } catch {
      setEvents([]);
    } finally {
      setEventsLoading(false);
    }
  }

  function handleCopy(tag: NfcTag) {
    const url = tag.writtenUrl ?? `${window.location.origin}/t/${tag.publicCode}`;
    copyToClipboard(url);
    setCopiedId(tag.id);
    setTimeout(() => setCopiedId((id) => (id === tag.id ? null : id)), 2000);
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-slate-950">NFC Tags</h1>
        <p className="mt-1 text-sm text-slate-500">Manage physical NFC tags — generate, assign to students, and monitor taps.</p>
      </div>

      {/* Generate strip */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-sm font-black text-slate-950">Generate new tags</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <input
            type="number"
            min={1}
            max={100}
            value={generateCount}
            onChange={(e) => setGenerateCount(Math.max(1, Math.min(100, Number(e.target.value))))}
            className="premium-control w-24"
          />
          <button
            type="button"
            onClick={() => { void handleGenerate(); }}
            disabled={generating}
            className="btn btn-primary rounded-xl px-4 py-2 text-sm font-black"
          >
            {generating ? "Generating…" : `Generate ${generateCount} tag${generateCount > 1 ? "s" : ""}`}
          </button>
        </div>
        {generateError && <p className="mt-2 text-xs text-red-600">{generateError}</p>}
      </div>

      {/* Filter row */}
      <div className="flex items-center gap-3">
        <p className="text-sm font-semibold text-slate-600">Filter:</p>
        {(["", "UNASSIGNED", "ASSIGNED", "DISABLED", "LOST"] as StatusFilter[]).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatusFilter(s)}
            className={`rounded-full border px-3 py-1 text-xs font-black transition ${statusFilter === s ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-blue-200"}`}
          >
            {s || "All"}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {/* Tag list */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <p className="p-6 text-sm text-slate-500">Loading tags…</p>
        ) : tags.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">No tags found. Generate some above to get started.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-left text-[11px] font-black uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Label / Code</th>
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">Last Seen</th>
                <th className="px-4 py-3">Taps</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tags.map((tag) => (
                <tr key={tag.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <StatusBadge status={tag.status} />
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-bold text-slate-950">{tag.label ?? `Tag ${tag.publicCode.slice(0, 8)}…`}</p>
                    <p className="text-[11px] text-slate-400 font-mono">{tag.publicCode.slice(0, 16)}…</p>
                  </td>
                  <td className="px-4 py-3">
                    {tag.student ? (
                      <div>
                        <p className="font-semibold text-slate-950">{tag.student.name}</p>
                        <p className="text-[11px] text-slate-400">{tag.student.admissionNumber}{tag.student.className ? ` · ${tag.student.className}` : ""}</p>
                      </div>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {tag.lastSeenAt ? new Date(tag.lastSeenAt).toLocaleString() : "—"}
                  </td>
                  <td className="px-4 py-3 text-center font-semibold text-slate-700">{tag.tapCount}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleCopy(tag)}
                        className="btn btn-secondary rounded-lg px-2.5 py-1 text-[11px] font-black"
                      >
                        {copiedId === tag.id ? "Copied!" : "Copy URL"}
                      </button>
                      {tag.status !== "DISABLED" && tag.status !== "ASSIGNED" && (
                        <button
                          type="button"
                          onClick={() => { setAssignTagId(tag.id); setAssignSearch(""); setAssignSelected(null); setAssignResults([]); setAssignError(null); }}
                          className="btn btn-primary rounded-lg px-2.5 py-1 text-[11px] font-black"
                        >
                          Assign
                        </button>
                      )}
                      {tag.status === "ASSIGNED" && (
                        <button
                          type="button"
                          onClick={() => { void handleUnassign(tag.id); }}
                          className="btn btn-secondary rounded-lg px-2.5 py-1 text-[11px] font-black"
                        >
                          Unassign
                        </button>
                      )}
                      {tag.status !== "DISABLED" && tag.status !== "LOST" && (
                        <button
                          type="button"
                          onClick={() => { if (confirm("Disable this tag? It will no longer resolve.")) void handleDisable(tag.id); }}
                          className="rounded-lg border border-red-200 px-2.5 py-1 text-[11px] font-black text-red-600 hover:bg-red-50"
                        >
                          Disable
                        </button>
                      )}
                      {(tag.status === "DISABLED" || tag.status === "LOST") && (
                        <button
                          type="button"
                          onClick={() => { setEnableTarget(tag); setEnableReason(""); setEnableError(null); }}
                          className="rounded-lg border border-emerald-300 px-2.5 py-1 text-[11px] font-black text-emerald-700 hover:bg-emerald-50"
                        >
                          Re-enable
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => { void handleViewEvents(tag.id); }}
                        className="btn btn-secondary rounded-lg px-2.5 py-1 text-[11px] font-black"
                      >
                        Events
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Assign modal */}
      {assignTagId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setAssignTagId(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-black text-slate-950">Assign tag to student</h2>
            <p className="mt-1 text-sm text-slate-500">Search by name, admission number, class, or stream.</p>

            {/* Search input */}
            <div className="relative mt-4">
              <input
                type="text"
                placeholder="Search student…"
                value={assignSearch}
                onChange={(e) => handleSearchInput(e.target.value)}
                className="premium-control w-full"
                autoFocus
              />
              {assignSearching && (
                <p className="mt-1 text-xs text-slate-400">Searching…</p>
              )}
              {assignResults.length > 0 && (
                <ul className="absolute left-0 right-0 top-full z-10 mt-1 max-h-52 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
                  {assignResults.map((s) => (
                    <li key={s.id}>
                      <button
                        type="button"
                        className="w-full px-3 py-2 text-left text-sm hover:bg-blue-50"
                        onClick={() => selectStudent(s)}
                      >
                        <p className="font-bold text-slate-950">{s.studentName}</p>
                        <p className="text-xs text-slate-500">
                          {s.admissionNumber} — {s.className}/{s.streamName}
                        </p>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Selected student confirmation */}
            {assignSelected && (
              <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm">
                <p className="font-bold text-emerald-800">Selected student</p>
                <p className="text-emerald-700">
                  {assignSelected.studentName} — {assignSelected.admissionNumber} — {assignSelected.className}/{assignSelected.streamName}
                </p>
              </div>
            )}

            {assignError && <p className="mt-2 text-xs text-red-600">{assignError}</p>}

            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={() => { void handleAssign(); }}
                disabled={assignLoading || !assignSelected}
                className="btn btn-primary flex-1 rounded-xl py-2.5 text-sm font-black"
              >
                {assignLoading ? "Assigning…" : "Assign to selected student"}
              </button>
              <button
                type="button"
                onClick={() => setAssignTagId(null)}
                className="btn btn-secondary flex-1 rounded-xl py-2.5 text-sm font-bold"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Re-enable modal */}
      {enableTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => { setEnableTarget(null); setEnableReason(""); setEnableError(null); }}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-black text-slate-950">Re-enable NFC tag</h2>
            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
              <p className="font-bold text-slate-900">{enableTarget.label ?? `Tag ${enableTarget.publicCode.slice(0, 8)}…`}</p>
              <p className="text-xs text-slate-500 font-mono mt-0.5">{enableTarget.publicCode.slice(0, 20)}</p>
              {enableTarget.student && (
                <p className="mt-1 text-slate-700">Student: <span className="font-semibold">{enableTarget.student.name}</span> · {enableTarget.student.admissionNumber}</p>
              )}
              <p className="mt-1 text-xs text-slate-400">Current status: <span className="font-bold text-red-600">{enableTarget.status}</span></p>
            </div>
            <label className="mt-4 grid gap-1.5 text-xs font-bold uppercase text-slate-500">
              Reason (required)
              <textarea
                className="premium-control min-h-[80px] resize-none rounded-xl text-sm"
                value={enableReason}
                onChange={(e) => setEnableReason(e.target.value)}
                placeholder="e.g. Tag recovered and confirmed working"
                autoFocus
              />
            </label>
            {enableError && <p className="mt-2 text-xs text-red-600">{enableError}</p>}
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => { void handleEnable(); }}
                disabled={enableLoading || !enableReason.trim()}
                className="btn btn-primary flex-1 rounded-xl py-2.5 text-sm font-black"
              >
                {enableLoading ? "Enabling…" : "Re-enable tag"}
              </button>
              <button
                type="button"
                onClick={() => { setEnableTarget(null); setEnableReason(""); setEnableError(null); }}
                className="btn btn-secondary flex-1 rounded-xl py-2.5 text-sm font-bold"
                disabled={enableLoading}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Events drawer */}
      {eventsTagId && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={() => setEventsTagId(null)}>
          <div className="w-full max-w-lg rounded-t-2xl bg-white p-6 shadow-2xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black text-slate-950">Tap events</h2>
              <button type="button" onClick={() => setEventsTagId(null)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>
            {eventsLoading ? (
              <p className="mt-4 text-sm text-slate-500">Loading…</p>
            ) : events.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">No tap events recorded yet.</p>
            ) : (
              <ul className="mt-4 space-y-2 max-h-80 overflow-y-auto">
                {events.map((ev) => (
                  <li key={ev.id} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className={`font-black ${ev.result === "ASSIGNED" ? "text-emerald-700" : ev.result === "UNKNOWN" ? "text-red-600" : "text-slate-600"}`}>{ev.result}</span>
                      <span className="text-slate-400">{new Date(ev.createdAt).toLocaleString()}</span>
                    </div>
                    {ev.userAgent && <p className="mt-0.5 truncate text-slate-400">{ev.userAgent}</p>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
