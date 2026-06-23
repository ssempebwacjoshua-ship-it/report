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
import { getStudentWalletPinStatus, setStudentWalletPin } from "../client/studentCredentialsClient";
import type { StudentListItem } from "../shared/types/students";
import type { WalletPinStatus } from "../shared/types/studentCredentials";

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

type TagActions = {
  onCopyUrl: () => void;
  onAssign: () => void;
  onUnassign: () => void;
  onDisable: () => void;
  onEnable: () => void;
  onEvents: () => void;
  onWalletPin: () => void;
  copiedId: string | null;
};

function ActionsDropdown({ tag, actions, isOpen, onToggle, onClose }: {
  tag: NfcTag;
  actions: TagActions;
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen, onClose]);

  const canAssign = tag.status !== "DISABLED" && tag.status !== "ASSIGNED";
  const canUnassign = tag.status === "ASSIGNED";
  const canDisable = tag.status !== "DISABLED" && tag.status !== "LOST";
  const canEnable = tag.status === "DISABLED" || tag.status === "LOST";
  const canWalletPin = tag.status === "ASSIGNED" && !!tag.student;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={onToggle}
        className="flex min-h-[44px] items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
      >
        Actions
        <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 z-30 mt-1.5 w-52 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          <button
            type="button"
            onClick={() => { actions.onCopyUrl(); onClose(); }}
            className="flex w-full items-center px-4 py-3 text-left text-sm text-slate-700 hover:bg-slate-50"
          >
            {actions.copiedId === tag.id ? "Copied!" : "Copy URL"}
          </button>

          {canAssign && (
            <button
              type="button"
              onClick={() => { actions.onAssign(); onClose(); }}
              className="flex w-full items-center px-4 py-3 text-left text-sm font-semibold text-blue-700 hover:bg-blue-50"
            >
              Assign to student
            </button>
          )}
          {canUnassign && (
            <button
              type="button"
              onClick={() => { actions.onUnassign(); onClose(); }}
              className="flex w-full items-center px-4 py-3 text-left text-sm text-slate-700 hover:bg-slate-50"
            >
              Unassign
            </button>
          )}
          {canWalletPin && (
            <button
              type="button"
              onClick={() => { actions.onWalletPin(); onClose(); }}
              className="flex w-full items-center px-4 py-3 text-left text-sm text-violet-700 hover:bg-violet-50"
            >
              Wallet PIN
            </button>
          )}

          <div className="mx-3 border-t border-slate-100" />

          <button
            type="button"
            onClick={() => { actions.onEvents(); onClose(); }}
            className="flex w-full items-center px-4 py-3 text-left text-sm text-slate-700 hover:bg-slate-50"
          >
            View events
          </button>

          {canDisable && (
            <button
              type="button"
              onClick={() => { actions.onDisable(); onClose(); }}
              className="flex w-full items-center px-4 py-3 text-left text-sm text-red-600 hover:bg-red-50"
            >
              Disable
            </button>
          )}
          {canEnable && (
            <button
              type="button"
              onClick={() => { actions.onEnable(); onClose(); }}
              className="flex w-full items-center px-4 py-3 text-left text-sm text-emerald-700 hover:bg-emerald-50"
            >
              Re-enable
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function MobileTagCard({ tag, actions, isDropdownOpen, onToggleDropdown, onCloseDropdown }: {
  tag: NfcTag;
  actions: TagActions;
  isDropdownOpen: boolean;
  onToggleDropdown: () => void;
  onCloseDropdown: () => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <StatusBadge status={tag.status} />
          <p className="mt-2 min-w-0 truncate font-bold text-slate-950">
            {tag.label ?? `Tag ${tag.publicCode.slice(0, 8)}…`}
          </p>
          <p className="mt-0.5 min-w-0 break-all font-mono text-[11px] text-slate-400">
            {tag.publicCode}
          </p>
        </div>
        <ActionsDropdown
          tag={tag}
          actions={actions}
          isOpen={isDropdownOpen}
          onToggle={onToggleDropdown}
          onClose={onCloseDropdown}
        />
      </div>

      <div className="mt-3 grid gap-1 text-sm">
        {tag.student ? (
          <>
            <p className="font-semibold text-slate-900">{tag.student.name}</p>
            <p className="text-xs text-slate-500">
              {tag.student.admissionNumber}
              {tag.student.className ? ` · ${tag.student.className}` : ""}
              {tag.student.streamName ? ` / ${tag.student.streamName}` : ""}
            </p>
          </>
        ) : (
          <p className="text-slate-400">Unassigned</p>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
        <span>Mode: <span className="font-semibold text-slate-700">{tag.tagMode}</span></span>
        <span>Taps: <span className="font-semibold text-slate-700">{tag.tapCount ?? 0}</span></span>
        <span>
          Last seen:{" "}
          <span className="font-semibold text-slate-700">
            {tag.lastSeenAt ? new Date(tag.lastSeenAt).toLocaleDateString() : "Never"}
          </span>
        </span>
        <span>
          Created:{" "}
          <span className="font-semibold text-slate-700">
            {new Date(tag.createdAt).toLocaleDateString()}
          </span>
        </span>
      </div>
    </div>
  );
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

  // Assignment success panel
  type AssignSuccess = { studentName: string; admissionNumber: string; studentId: string };
  const [assignSuccess, setAssignSuccess] = useState<AssignSuccess | null>(null);

  // Wallet PIN modal
  type WalletPinTarget = { studentId: string; studentName: string; admissionNumber: string };
  const [walletPinTarget, setWalletPinTarget] = useState<WalletPinTarget | null>(null);
  const [walletPinStatus, setWalletPinStatus] = useState<WalletPinStatus | null>(null);
  const [walletPinStatusLoading, setWalletPinStatusLoading] = useState(false);
  const [walletPinNewPin, setWalletPinNewPin] = useState("");
  const [walletPinConfirmPin, setWalletPinConfirmPin] = useState("");
  const [walletPinReason, setWalletPinReason] = useState("");
  const [walletPinLoading, setWalletPinLoading] = useState(false);
  const [walletPinError, setWalletPinError] = useState<string | null>(null);
  const [walletPinSuccess, setWalletPinSuccess] = useState(false);

  // Open dropdown tracking (one at a time)
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

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
      setAssignSuccess({ studentName: assignSelected.studentName, admissionNumber: assignSelected.admissionNumber, studentId: assignSelected.id });
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

  function openWalletPinModal(target: WalletPinTarget) {
    setWalletPinTarget(target);
    setWalletPinStatus(null);
    setWalletPinStatusLoading(true);
    setWalletPinNewPin("");
    setWalletPinConfirmPin("");
    setWalletPinReason("");
    setWalletPinError(null);
    setWalletPinSuccess(false);
    getStudentWalletPinStatus(target.studentId)
      .then(setWalletPinStatus)
      .catch(() => setWalletPinStatus({ pinSet: false, locked: false, pinLockedUntil: null, pinFailedAttempts: 0 }))
      .finally(() => setWalletPinStatusLoading(false));
  }

  function closeWalletPinModal() {
    setWalletPinTarget(null);
    setWalletPinStatus(null);
    setWalletPinNewPin("");
    setWalletPinConfirmPin("");
    setWalletPinReason("");
    setWalletPinError(null);
    setWalletPinSuccess(false);
  }

  async function handleSetWalletPin() {
    if (!walletPinTarget) return;
    if (!/^\d{4,6}$/.test(walletPinNewPin)) { setWalletPinError("PIN must be 4 to 6 digits."); return; }
    if (walletPinNewPin !== walletPinConfirmPin) { setWalletPinError("PINs do not match."); return; }
    if (!walletPinReason.trim()) { setWalletPinError("Reason is required."); return; }
    setWalletPinLoading(true);
    setWalletPinError(null);
    try {
      await setStudentWalletPin(walletPinTarget.studentId, { pin: walletPinNewPin, reason: walletPinReason.trim() });
      setWalletPinSuccess(true);
    } catch (e) {
      setWalletPinError(e instanceof Error ? e.message : "Could not set PIN.");
    } finally {
      setWalletPinNewPin("");
      setWalletPinConfirmPin("");
      setWalletPinLoading(false);
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

  function makeActions(tag: NfcTag): TagActions {
    return {
      onCopyUrl: () => handleCopy(tag),
      onAssign: () => { setAssignTagId(tag.id); setAssignSearch(""); setAssignSelected(null); setAssignResults([]); setAssignError(null); },
      onUnassign: () => { void handleUnassign(tag.id); },
      onDisable: () => { if (confirm("Disable this tag? It will no longer resolve.")) void handleDisable(tag.id); },
      onEnable: () => { setEnableTarget(tag); setEnableReason(""); setEnableError(null); },
      onEvents: () => { void handleViewEvents(tag.id); },
      onWalletPin: () => {
        if (tag.student) {
          openWalletPinModal({ studentId: tag.student.id, studentName: tag.student.name, admissionNumber: tag.student.admissionNumber });
        }
      },
      copiedId,
    };
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-slate-950">NFC Tags</h1>
        <p className="mt-1 text-sm text-slate-500">Manage physical NFC tags — generate, assign to students, and monitor taps.</p>
      </div>

      {/* Generate strip — stacks on mobile */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-sm font-black text-slate-950">Generate new tags</p>
        <div className="mt-3 grid gap-3 sm:flex sm:flex-wrap sm:items-center">
          <input
            type="number"
            min={1}
            max={100}
            value={generateCount}
            onChange={(e) => setGenerateCount(Math.max(1, Math.min(100, Number(e.target.value))))}
            className="premium-control w-full sm:w-24"
          />
          <button
            type="button"
            onClick={() => { void handleGenerate(); }}
            disabled={generating}
            className="btn btn-primary min-h-[44px] w-full rounded-xl px-4 py-2 text-sm font-black sm:w-auto"
          >
            {generating ? "Generating…" : `Generate ${generateCount} tag${generateCount > 1 ? "s" : ""}`}
          </button>
        </div>
        {generateError && <p className="mt-2 text-xs text-red-600">{generateError}</p>}
      </div>

      {/* Filter row — wraps cleanly on mobile */}
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-semibold text-slate-600">Filter:</p>
        {(["", "UNASSIGNED", "ASSIGNED", "DISABLED", "LOST"] as StatusFilter[]).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatusFilter(s)}
            className={`min-h-[36px] rounded-full border px-3 py-1 text-xs font-black transition ${statusFilter === s ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-blue-200"}`}
          >
            {s || "All"}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {/* Mobile cards — hidden on md+ */}
      <div className="grid gap-3 md:hidden">
        {loading ? (
          <p className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Loading tags…</p>
        ) : tags.length === 0 ? (
          <p className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">No tags found. Generate some above to get started.</p>
        ) : (
          tags.map((tag) => (
            <MobileTagCard
              key={tag.id}
              tag={tag}
              actions={makeActions(tag)}
              isDropdownOpen={openDropdownId === tag.id}
              onToggleDropdown={() => setOpenDropdownId((id) => (id === tag.id ? null : tag.id))}
              onCloseDropdown={() => setOpenDropdownId(null)}
            />
          ))
        )}
      </div>

      {/* Desktop table — hidden below md */}
      <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm md:block">
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
                  <td className="max-w-[200px] px-4 py-3">
                    <p className="truncate font-bold text-slate-950">{tag.label ?? `Tag ${tag.publicCode.slice(0, 8)}…`}</p>
                    <p className="truncate font-mono text-[11px] text-slate-400">{tag.publicCode.slice(0, 16)}…</p>
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
                  <td className="px-4 py-3 text-center font-semibold text-slate-700">{tag.tapCount ?? 0}</td>
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
                      {tag.status === "ASSIGNED" && tag.student && (
                        <button
                          type="button"
                          onClick={() => openWalletPinModal({ studentId: tag.student!.id, studentName: tag.student!.name, admissionNumber: tag.student!.admissionNumber })}
                          className="rounded-lg border border-violet-200 px-2.5 py-1 text-[11px] font-black text-violet-700 hover:bg-violet-50"
                        >
                          Wallet PIN
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => { setAssignTagId(null); setAssignSuccess(null); }}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            {assignSuccess ? (
              <>
                <h2 className="text-lg font-black text-slate-950">Tag assigned successfully</h2>
                <div className="mt-3 grid gap-1 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm">
                  <p className="font-bold text-emerald-800">Student: {assignSuccess.studentName}</p>
                  <p className="text-emerald-700">Admission: {assignSuccess.admissionNumber}</p>
                  <p className="mt-2 text-xs font-bold text-amber-700">Wallet PIN: Not set</p>
                  <p className="text-xs text-amber-600">Set a PIN so the student can make canteen purchases.</p>
                </div>
                <div className="mt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      const target = { studentId: assignSuccess.studentId, studentName: assignSuccess.studentName, admissionNumber: assignSuccess.admissionNumber };
                      setAssignTagId(null);
                      setAssignSuccess(null);
                      openWalletPinModal(target);
                    }}
                    className="btn btn-primary min-h-[44px] flex-1 rounded-xl py-2.5 text-sm font-black"
                  >
                    Set PIN Now
                  </button>
                  <button
                    type="button"
                    onClick={() => { setAssignTagId(null); setAssignSuccess(null); }}
                    className="btn btn-secondary min-h-[44px] flex-1 rounded-xl py-2.5 text-sm font-bold"
                  >
                    Done
                  </button>
                </div>
              </>
            ) : (
              <>
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
                    className="btn btn-primary min-h-[44px] flex-1 rounded-xl py-2.5 text-sm font-black"
                  >
                    {assignLoading ? "Assigning…" : "Assign to selected student"}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setAssignTagId(null); setAssignSuccess(null); }}
                    className="btn btn-secondary min-h-[44px] flex-1 rounded-xl py-2.5 text-sm font-bold"
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Re-enable modal */}
      {enableTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => { setEnableTarget(null); setEnableReason(""); setEnableError(null); }}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-black text-slate-950">Re-enable NFC tag</h2>
            <div className="mt-3 min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
              <p className="truncate font-bold text-slate-900">{enableTarget.label ?? `Tag ${enableTarget.publicCode.slice(0, 8)}…`}</p>
              <p className="mt-0.5 break-all font-mono text-xs text-slate-500">{enableTarget.publicCode}</p>
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
                className="btn btn-primary min-h-[44px] flex-1 rounded-xl py-2.5 text-sm font-black"
              >
                {enableLoading ? "Enabling…" : "Re-enable tag"}
              </button>
              <button
                type="button"
                onClick={() => { setEnableTarget(null); setEnableReason(""); setEnableError(null); }}
                className="btn btn-secondary min-h-[44px] flex-1 rounded-xl py-2.5 text-sm font-bold"
                disabled={enableLoading}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Wallet PIN modal */}
      {walletPinTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={closeWalletPinModal}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <p className="text-base font-bold text-slate-950">
              {walletPinStatusLoading ? "Loading PIN status…" : walletPinStatus?.pinSet ? "Reset wallet PIN" : "Set wallet PIN"}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              {walletPinTarget.studentName} · {walletPinTarget.admissionNumber}
            </p>
            {walletPinStatusLoading ? (
              <p className="mt-4 text-sm text-slate-500">Loading…</p>
            ) : walletPinSuccess ? (
              <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-700">
                PIN {walletPinStatus?.pinSet ? "reset" : "set"} successfully.
              </div>
            ) : (
              <div className="mt-4 grid gap-3">
                {walletPinStatus?.pinLockedUntil && (
                  <p className="text-xs font-bold text-red-600">
                    PIN locked until {new Date(walletPinStatus.pinLockedUntil).toLocaleTimeString()}. Reset PIN to unlock.
                  </p>
                )}
                <div className="grid gap-1">
                  <label className="text-xs font-bold uppercase text-slate-500">New PIN (4–6 digits)</label>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    className="premium-control h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-center text-xl tracking-widest outline-none focus:border-blue-400 focus:bg-white"
                    value={walletPinNewPin}
                    onChange={(e) => setWalletPinNewPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="••••"
                    autoComplete="new-password"
                  />
                </div>
                <div className="grid gap-1">
                  <label className="text-xs font-bold uppercase text-slate-500">Confirm PIN</label>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    className="premium-control h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-center text-xl tracking-widest outline-none focus:border-blue-400 focus:bg-white"
                    value={walletPinConfirmPin}
                    onChange={(e) => setWalletPinConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="••••"
                    autoComplete="new-password"
                  />
                </div>
                <div className="grid gap-1">
                  <label className="text-xs font-bold uppercase text-slate-500">Reason</label>
                  <textarea
                    className="premium-control w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-400 focus:bg-white"
                    rows={2}
                    value={walletPinReason}
                    onChange={(e) => setWalletPinReason(e.target.value)}
                    placeholder="e.g. Initial PIN setup for student"
                  />
                </div>
                {walletPinError && <p className="text-xs text-red-600">{walletPinError}</p>}
              </div>
            )}
            <div className="mt-4 flex gap-2">
              {!walletPinSuccess && !walletPinStatusLoading && (
                <button
                  type="button"
                  className="min-h-[44px] flex-1 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400"
                  disabled={walletPinLoading || walletPinNewPin.length < 4}
                  onClick={() => void handleSetWalletPin()}
                >
                  {walletPinLoading ? "Saving…" : walletPinStatus?.pinSet ? "Reset PIN" : "Set PIN"}
                </button>
              )}
              <button
                type="button"
                className="min-h-[44px] flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
                onClick={closeWalletPinModal}
              >
                {walletPinSuccess ? "Close" : "Cancel"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Events drawer — slides up from bottom on mobile */}
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
