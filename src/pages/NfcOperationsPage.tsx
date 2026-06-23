import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { NfcTag } from "../shared/types/nfcTags";
import {
  amendNfcTag,
  assignNfcTag,
  disableNfcTag,
  generateNfcTags,
  getNfcTagEvents,
  listNfcTags,
  unassignNfcTag,
} from "../client/nfcTagsClient";
import { fetchStudents } from "../client/studentsClient";
import type { StudentListItem } from "../shared/types/students";

type StatusFilter = "" | "UNASSIGNED" | "ASSIGNED" | "DISABLED";

const STATUS_COLORS: Record<string, string> = {
  UNASSIGNED:  "bg-slate-100 text-slate-600",
  GENERATED:   "bg-slate-100 text-slate-600",
  UNALLOCATED: "bg-slate-100 text-slate-600",
  ASSIGNED:    "bg-emerald-50 text-emerald-700",
  DISABLED:    "bg-red-50 text-red-700",
  LOST:        "bg-red-50 text-red-700",
  WRITTEN:     "bg-blue-50 text-blue-700",
  VERIFIED:    "bg-emerald-50 text-emerald-700",
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

function operationalPayload(tag: NfcTag) {
  return `SCNFC:${tag.publicCode}`;
}

function tagUrl(tag: NfcTag) {
  return tag.writtenUrl ?? `${window.location.origin}/t/${tag.publicCode}`;
}

const isDisabledStatus = (s: string) => s === "DISABLED" || s === "LOST";
const isAssigned = (s: string) => s === "ASSIGNED";
const isAssignable = (s: string) => !isAssigned(s) && !isDisabledStatus(s);

// ── Actions dropdown ─────────────────────────────────────────────────────────

type TagHandlers = {
  onCopyPayload: (tag: NfcTag) => void;
  onCopyUrl: (tag: NfcTag) => void;
  onRewrite: (tag: NfcTag) => void;
  onAssign: (tag: NfcTag) => void;
  onUnassign: (tag: NfcTag) => void;
  onDisable: (tag: NfcTag) => void;
  onReEnable: (tag: NfcTag) => void;
  onViewEvents: (tag: NfcTag) => void;
  onWalletPin: (tag: NfcTag) => void;
  copiedPayloadId: string | null;
  copiedUrlId: string | null;
  rewritingId: string | null;
};

function ActionsDropdown({ tag, handlers }: { tag: NfcTag; handlers: TagHandlers }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  function act(fn: () => void) {
    setOpen(false);
    fn();
  }

  const isPayloadCopied = handlers.copiedPayloadId === tag.id;
  const isUrlCopied = handlers.copiedUrlId === tag.id;
  const isRewriting = handlers.rewritingId === tag.id;
  const disabled = isDisabledStatus(tag.status);
  const assigned = isAssigned(tag.status);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 active:scale-95"
        aria-label="Tag actions"
      >
        <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
          <circle cx="10" cy="4" r="1.5" /><circle cx="10" cy="10" r="1.5" /><circle cx="10" cy="16" r="1.5" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-30 w-52 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
          <div className="divide-y divide-slate-100">
            {/* Copy / write group */}
            <div className="py-1">
              <MenuItem
                label={isPayloadCopied ? "Copied!" : "Copy Payload"}
                sub="SCNFC:code — for daily scanning"
                onClick={() => act(() => handlers.onCopyPayload(tag))}
                highlight={isPayloadCopied}
              />
              <MenuItem
                label={isUrlCopied ? "Copied!" : "Copy URL"}
                sub="For verification / outside tap"
                onClick={() => act(() => handlers.onCopyUrl(tag))}
                highlight={isUrlCopied}
              />
              <MenuItem
                label={isRewriting ? "Writing…" : "Rewrite as Operational Tag"}
                sub="Writes SCNFC:code to NFC chip"
                onClick={() => act(() => handlers.onRewrite(tag))}
                disabled={isRewriting}
              />
            </div>

            {/* Status actions group */}
            <div className="py-1">
              {assigned && (
                <>
                  <MenuItem label="Wallet PIN" sub="Manage student wallet PIN" onClick={() => act(() => handlers.onWalletPin(tag))} />
                  <MenuItem label="Unassign" onClick={() => act(() => handlers.onUnassign(tag))} danger />
                </>
              )}
              {isAssignable(tag.status) && (
                <MenuItem label="Assign to student" onClick={() => act(() => handlers.onAssign(tag))} primary />
              )}
              {disabled && (
                <MenuItem label="Re-enable tag" onClick={() => act(() => handlers.onReEnable(tag))} primary />
              )}
              {!disabled && (
                <MenuItem
                  label="Disable tag"
                  sub="Tag will stop resolving"
                  onClick={() => act(() => handlers.onDisable(tag))}
                  danger
                />
              )}
            </div>

            {/* Events group */}
            <div className="py-1">
              <MenuItem label="View tap events" onClick={() => act(() => handlers.onViewEvents(tag))} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MenuItem({
  label,
  sub,
  onClick,
  danger,
  primary,
  highlight,
  disabled,
}: {
  label: string;
  sub?: string;
  onClick: () => void;
  danger?: boolean;
  primary?: boolean;
  highlight?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full flex-col items-start gap-0.5 px-4 py-2.5 text-left text-sm transition disabled:opacity-50 ${
        danger
          ? "text-red-600 hover:bg-red-50"
          : primary
          ? "font-semibold text-blue-600 hover:bg-blue-50"
          : highlight
          ? "font-semibold text-emerald-600 hover:bg-emerald-50"
          : "text-slate-700 hover:bg-slate-50"
      }`}
    >
      <span className="font-semibold">{label}</span>
      {sub && <span className="text-[11px] text-slate-400">{sub}</span>}
    </button>
  );
}

// ── Mobile tag card ──────────────────────────────────────────────────────────

function MobileTagCard({ tag, handlers }: { tag: NfcTag; handlers: TagHandlers }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge status={tag.status} />
            {tag.tapCount > 0 && (
              <span className="text-xs text-slate-400">{tag.tapCount} tap{tag.tapCount !== 1 ? "s" : ""}</span>
            )}
          </div>
          {tag.student ? (
            <div className="mt-2">
              <p className="font-bold text-slate-950 truncate">{tag.student.name}</p>
              <p className="text-xs text-slate-500">{tag.student.admissionNumber}{tag.student.className ? ` · ${tag.student.className}` : ""}</p>
            </div>
          ) : (
            <p className="mt-2 text-sm font-semibold text-slate-700">{tag.label ?? "Unassigned tag"}</p>
          )}
          <p className="mt-1 font-mono text-[11px] text-slate-400 truncate">{tag.publicCode.slice(0, 20)}…</p>
          {tag.lastSeenAt && (
            <p className="text-[11px] text-slate-400">Last seen: {new Date(tag.lastSeenAt).toLocaleDateString()}</p>
          )}
        </div>
        <div className="shrink-0">
          <ActionsDropdown tag={tag} handlers={handlers} />
        </div>
      </div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export function NfcOperationsPage() {
  const navigate = useNavigate();
  const [tags, setTags] = useState<NfcTag[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Generate panel
  const [generateCount, setGenerateCount] = useState(1);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  // Assign modal
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

  // Copy / rewrite feedback
  const [copiedPayloadId, setCopiedPayloadId] = useState<string | null>(null);
  const [copiedUrlId, setCopiedUrlId] = useState<string | null>(null);
  const [rewritingId, setRewritingId] = useState<string | null>(null);

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

  async function handleUnassign(tag: NfcTag) {
    try {
      const res = await unassignNfcTag(tag.id);
      setTags((prev) => prev.map((t) => (t.id === tag.id ? { ...t, status: res.status as "UNASSIGNED", studentId: null, student: null } : t)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to unassign tag.");
    }
  }

  async function handleDisable(tag: NfcTag) {
    if (!confirm("Disable this tag? It will no longer resolve.")) return;
    try {
      const res = await disableNfcTag(tag.id);
      setTags((prev) => prev.map((t) => (t.id === tag.id ? { ...t, status: res.status as "DISABLED" } : t)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to disable tag.");
    }
  }

  async function handleReEnable(tag: NfcTag) {
    try {
      const updated = await amendNfcTag(tag.id, { status: "UNASSIGNED", reason: "Re-enabled by admin" });
      setTags((prev) => prev.map((t) => (t.id === tag.id ? updated : t)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to re-enable tag.");
    }
  }

  async function handleViewEvents(tag: NfcTag) {
    setEventsTagId(tag.id);
    setEventsLoading(true);
    try {
      const data = await getNfcTagEvents(tag.id);
      setEvents(data.events);
    } catch {
      setEvents([]);
    } finally {
      setEventsLoading(false);
    }
  }

  function handleCopyPayload(tag: NfcTag) {
    copyToClipboard(operationalPayload(tag));
    setCopiedPayloadId(tag.id);
    setTimeout(() => setCopiedPayloadId((id) => (id === tag.id ? null : id)), 2000);
  }

  function handleCopyUrl(tag: NfcTag) {
    copyToClipboard(tagUrl(tag));
    setCopiedUrlId(tag.id);
    setTimeout(() => setCopiedUrlId((id) => (id === tag.id ? null : id)), 2000);
  }

  async function handleRewrite(tag: NfcTag) {
    if (!("NDEFReader" in window)) {
      alert("Web NFC is not supported on this browser. Copy the payload and use an NFC writer app instead.");
      return;
    }
    setRewritingId(tag.id);
    try {
      // @ts-expect-error Web NFC API not in TS lib
      const writer = new NDEFWriter();
      await writer.write({ records: [{ recordType: "text", data: operationalPayload(tag) }] });
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to write NFC tag.");
    } finally {
      setRewritingId(null);
    }
  }

  function handleWalletPin(tag: NfcTag) {
    if (tag.studentId) navigate(`/nfc/wallets?studentId=${encodeURIComponent(tag.studentId)}`);
  }

  function openAssignModal(tag: NfcTag) {
    setAssignTagId(tag.id);
    setAssignSearch("");
    setAssignSelected(null);
    setAssignResults([]);
    setAssignError(null);
  }

  const handlers: TagHandlers = {
    onCopyPayload: handleCopyPayload,
    onCopyUrl: handleCopyUrl,
    onRewrite: handleRewrite,
    onAssign: openAssignModal,
    onUnassign: handleUnassign,
    onDisable: handleDisable,
    onReEnable: handleReEnable,
    onViewEvents: handleViewEvents,
    onWalletPin: handleWalletPin,
    copiedPayloadId,
    copiedUrlId,
    rewritingId,
  };

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-slate-950">NFC Tags</h1>
        <p className="mt-1 text-sm text-slate-500">Manage NFC tags — generate, assign to students, write operational payloads.</p>
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
            className="btn btn-primary rounded-xl px-4 py-2.5 text-sm font-black"
          >
            {generating ? "Generating…" : `Generate ${generateCount} tag${generateCount > 1 ? "s" : ""}`}
          </button>
        </div>
        {generateError && <p className="mt-2 text-xs text-red-600">{generateError}</p>}
      </div>

      {/* Filter row */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-slate-600">Filter:</span>
        {(["", "UNASSIGNED", "ASSIGNED", "DISABLED"] as StatusFilter[]).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatusFilter(s)}
            className={`rounded-full border px-3 py-1.5 text-xs font-black transition ${statusFilter === s ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-blue-200"}`}
          >
            {s || "All"}
          </button>
        ))}
      </div>

      {error && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {/* Mobile: card list */}
      {loading ? (
        <p className="py-6 text-center text-sm text-slate-500">Loading tags…</p>
      ) : tags.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-500">No tags found. Generate some above to get started.</p>
      ) : (
        <>
          {/* Mobile cards (hidden on md+) */}
          <div className="grid gap-3 md:hidden">
            {tags.map((tag) => (
              <MobileTagCard key={tag.id} tag={tag} handlers={handlers} />
            ))}
          </div>

          {/* Desktop table (hidden on sm) */}
          <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm md:block">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100 bg-slate-50 text-left text-[11px] font-black uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Tag / Code</th>
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3">Last Seen</th>
                  <th className="px-4 py-3 text-center">Taps</th>
                  <th className="px-4 py-3 text-right">Actions</th>
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
                      <p className="font-mono text-[11px] text-slate-400">{tag.publicCode.slice(0, 20)}…</p>
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
                    <td className="px-4 py-3 text-right">
                      <ActionsDropdown tag={tag} handlers={handlers} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Assign modal */}
      {assignTagId && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center" onClick={() => setAssignTagId(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-black text-slate-950">Assign tag to student</h2>
            <p className="mt-1 text-sm text-slate-500">Search by name, admission number, class, or stream.</p>
            <div className="relative mt-4">
              <input
                type="text"
                placeholder="Search student…"
                value={assignSearch}
                onChange={(e) => handleSearchInput(e.target.value)}
                className="premium-control w-full"
                autoFocus
              />
              {assignSearching && <p className="mt-1 text-xs text-slate-400">Searching…</p>}
              {assignResults.length > 0 && (
                <ul className="absolute left-0 right-0 top-full z-10 mt-1 max-h-52 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
                  {assignResults.map((s) => (
                    <li key={s.id}>
                      <button type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-blue-50" onClick={() => selectStudent(s)}>
                        <p className="font-bold text-slate-950">{s.studentName}</p>
                        <p className="text-xs text-slate-500">{s.admissionNumber} — {s.className}/{s.streamName}</p>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {assignSelected && (
              <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm">
                <p className="font-bold text-emerald-800">Selected student</p>
                <p className="text-emerald-700">{assignSelected.studentName} — {assignSelected.admissionNumber} — {assignSelected.className}/{assignSelected.streamName}</p>
              </div>
            )}
            {assignError && <p className="mt-2 text-xs text-red-600">{assignError}</p>}
            <div className="mt-4 flex gap-3">
              <button type="button" onClick={() => { void handleAssign(); }} disabled={assignLoading || !assignSelected} className="btn btn-primary flex-1 rounded-xl py-3 text-sm font-black">
                {assignLoading ? "Assigning…" : "Assign to selected student"}
              </button>
              <button type="button" onClick={() => setAssignTagId(null)} className="btn btn-secondary flex-1 rounded-xl py-3 text-sm font-bold">
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
              <button type="button" onClick={() => setEventsTagId(null)} className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700">✕</button>
            </div>
            {eventsLoading ? (
              <p className="mt-4 text-sm text-slate-500">Loading…</p>
            ) : events.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">No tap events recorded yet.</p>
            ) : (
              <ul className="mt-4 max-h-80 space-y-2 overflow-y-auto">
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
