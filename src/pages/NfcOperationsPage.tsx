import { useCallback, useEffect, useRef, useState } from "react";
import type { NfcTag } from "../shared/types/nfcTags";
import {
  assignNfcTag,
  confirmReaderCredentialCapture,
  disableNfcTag,
  enableNfcTag,
  generateNfcTags,
  getReaderCredentialCapture,
  getNfcTagEvents,
  listNfcTags,
  startReaderCredentialCapture,
  transferReaderCredentialCapture,
  unassignNfcTag,
} from "../client/nfcTagsClient";
import { fetchOfflineSyncStatus } from "../client/nfcOfflineClient";
import { fetchStudents } from "../client/studentsClient";
import { getStudentWalletPinStatus, setStudentWalletPin } from "../client/studentCredentialsClient";
import type { StudentListItem } from "../shared/types/students";
import type { WalletPinStatus } from "../shared/types/studentCredentials";
import type { OfflineDeviceStatus } from "../client/nfcOfflineClient";
import type {
  ReaderCredentialCaptureSession,
  ReaderCredentialCaptureStartResponse,
  ReaderCredentialConflictResponse,
} from "../shared/types/nfcTags";

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
  onCopyPayload: () => void;
  onCopyUrl: () => void;
  onAssign: () => void;
  onUnassign: () => void;
  onDisable: () => void;
  onEnable: () => void;
  onEvents: () => void;
  onLinkReaderCredential: () => void;
  onWalletPin: () => void;
  copiedId: string | null;
  copiedPayloadId: string | null;
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
  const canLinkReaderCredential = tag.status === "ASSIGNED" && !!tag.student;

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
            onClick={() => { actions.onCopyPayload(); onClose(); }}
            className="flex w-full items-center px-4 py-3 text-left text-sm font-semibold text-blue-700 hover:bg-blue-50"
          >
            {actions.copiedPayloadId === tag.id ? "Copied!" : "Copy Payload"}
          </button>
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
          {canLinkReaderCredential && (
            <button
              type="button"
              onClick={() => { actions.onLinkReaderCredential(); onClose(); }}
              className="flex w-full items-center px-4 py-3 text-left text-sm text-amber-700 hover:bg-amber-50"
            >
              Link reader credential
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

function RowMoreMenu({ tag, actions, isOpen, onToggle, onClose }: {
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

  const canDisable = tag.status !== "DISABLED" && tag.status !== "LOST";
  const canEnable = tag.status === "DISABLED" || tag.status === "LOST";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={onToggle}
        className="inline-flex min-h-[34px] items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-black leading-none text-slate-700 hover:bg-slate-50"
      >
        More
        <svg className="h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen ? (
        <div className="absolute right-0 top-full z-40 mt-1.5 w-56 overflow-visible rounded-xl border border-slate-200 bg-white shadow-lg">
          <button type="button" onClick={() => { actions.onCopyPayload(); onClose(); }} className="flex w-full items-center px-3 py-2.5 text-left text-sm font-semibold text-blue-700 hover:bg-blue-50">
            {actions.copiedPayloadId === tag.id ? "Copied!" : "Copy Payload"}
          </button>
          <button type="button" onClick={() => { actions.onCopyUrl(); onClose(); }} className="flex w-full items-center px-3 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50">
            {actions.copiedId === tag.id ? "Copied!" : "Copy URL"}
          </button>
          <button type="button" onClick={() => { actions.onWalletPin(); onClose(); }} className="flex w-full items-center px-3 py-2.5 text-left text-sm text-violet-700 hover:bg-violet-50">
            Wallet PIN
          </button>
          <button type="button" onClick={() => { actions.onEvents(); onClose(); }} className="flex w-full items-center px-3 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50">
            Events
          </button>
          {canDisable ? (
            <button type="button" onClick={() => { actions.onDisable(); onClose(); }} className="flex w-full items-center px-3 py-2.5 text-left text-sm text-red-600 hover:bg-red-50">
              Disable
            </button>
          ) : null}
          {canEnable ? (
            <button type="button" onClick={() => { actions.onEnable(); onClose(); }} className="flex w-full items-center px-3 py-2.5 text-left text-sm text-emerald-700 hover:bg-emerald-50">
              Re-enable
            </button>
          ) : null}
        </div>
      ) : null}
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
  const payload = tag.writtenPayload ?? `SCNFC:${tag.publicCode}`;
  const isCopied = actions.copiedPayloadId === tag.id;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={tag.status} />
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              {tag.tagMode}
            </span>
          </div>
          <p className="mt-2 min-w-0 truncate font-bold text-slate-950">
            {tag.label ?? `Tag ${tag.publicCode.slice(0, 8)}…`}
          </p>
          <p className="mt-0.5 min-w-0 truncate font-mono text-[11px] text-slate-400">
            {payload}
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

      <button
        type="button"
        onClick={actions.onCopyPayload}
        className={`mt-3 flex w-full items-center justify-center rounded-xl border px-3 py-2 text-sm font-semibold transition-colors ${
          isCopied
            ? "border-green-200 bg-green-50 text-green-700"
            : "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
        }`}
      >
        {isCopied ? "Copied!" : "Copy Payload"}
      </button>

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
  type LinkReaderTarget = {
    id: string;
    publicCode: string;
    label: string | null;
    physicalUid: string | null;
    student: NonNullable<NfcTag["student"]>;
  };

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
  const [copiedPayloadId, setCopiedPayloadId] = useState<string | null>(null);

  // Re-enable modal
  const [enableTarget, setEnableTarget] = useState<NfcTag | null>(null);
  const [enableReason, setEnableReason] = useState("");
  const [enableLoading, setEnableLoading] = useState(false);
  const [enableError, setEnableError] = useState<string | null>(null);
  const compactActionButtonClass =
    "inline-flex min-h-[32px] max-w-full items-center justify-center rounded-lg border px-2.5 py-1 text-[11px] font-black leading-none transition-colors";

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

  // Reader credential link modal
  const [linkReaderTarget, setLinkReaderTarget] = useState<LinkReaderTarget | null>(null);
  const [linkReaderDevices, setLinkReaderDevices] = useState<OfflineDeviceStatus[]>([]);
  const [linkReaderDevicesLoading, setLinkReaderDevicesLoading] = useState(false);
  const [linkReaderDeviceId, setLinkReaderDeviceId] = useState("");
  const [linkReaderCapture, setLinkReaderCapture] = useState<ReaderCredentialCaptureStartResponse | ReaderCredentialCaptureSession | null>(null);
  const [linkReaderLoading, setLinkReaderLoading] = useState(false);
  const [linkReaderConfirming, setLinkReaderConfirming] = useState(false);
  const [linkReaderTransferring, setLinkReaderTransferring] = useState(false);
  const [linkReaderError, setLinkReaderError] = useState<string | null>(null);
  const [linkReaderSuccess, setLinkReaderSuccess] = useState<string | null>(null);
  const [linkReaderConflict, setLinkReaderConflict] = useState<ReaderCredentialConflictResponse["conflict"] | null>(null);
  const [linkReaderTransferReason, setLinkReaderTransferReason] = useState("");
  const linkReaderPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  useEffect(() => {
    if (!linkReaderTarget) {
      setLinkReaderDevices([]);
      setLinkReaderDeviceId("");
      setLinkReaderCapture(null);
      setLinkReaderError(null);
      setLinkReaderSuccess(null);
      setLinkReaderConflict(null);
      setLinkReaderTransferReason("");
      if (linkReaderPollRef.current) {
        clearInterval(linkReaderPollRef.current);
        linkReaderPollRef.current = null;
      }
      return;
    }

    setLinkReaderDevicesLoading(true);
    setLinkReaderError(null);
    fetchOfflineSyncStatus()
      .then((status) => {
        const attendanceDevices = status.devices.filter((device) => device.mode === "ATTENDANCE" && device.isActive);
        setLinkReaderDevices(attendanceDevices);
        setLinkReaderDeviceId((current) => current || attendanceDevices[0]?.id || attendanceDevices[0]?.deviceKey || "");
      })
      .catch((loadError) => {
        setLinkReaderDevices([]);
        setLinkReaderError(loadError instanceof Error ? loadError.message : "Failed to load attendance readers.");
      })
      .finally(() => setLinkReaderDevicesLoading(false));
  }, [linkReaderTarget]);

  useEffect(() => {
    if (!linkReaderCapture || !linkReaderTarget) {
      if (linkReaderPollRef.current) {
        clearInterval(linkReaderPollRef.current);
        linkReaderPollRef.current = null;
      }
      return;
    }

    if (linkReaderCapture.status !== "PENDING") {
      if (linkReaderPollRef.current) {
        clearInterval(linkReaderPollRef.current);
        linkReaderPollRef.current = null;
      }
      return;
    }

    if (linkReaderPollRef.current) {
      clearInterval(linkReaderPollRef.current);
    }

    linkReaderPollRef.current = setInterval(() => {
      void getReaderCredentialCapture(linkReaderCapture.captureId)
        .then((session) => {
          setLinkReaderCapture(session);
        })
        .catch((pollError) => {
          setLinkReaderError(pollError instanceof Error ? pollError.message : "Failed to refresh reader capture.");
          if (linkReaderPollRef.current) {
            clearInterval(linkReaderPollRef.current);
            linkReaderPollRef.current = null;
          }
        });
    }, 1500);

    return () => {
      if (linkReaderPollRef.current) {
        clearInterval(linkReaderPollRef.current);
        linkReaderPollRef.current = null;
      }
    };
  }, [linkReaderCapture, linkReaderTarget]);

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

  function handleCopyPayload(tag: NfcTag) {
    const payload = tag.writtenPayload ?? `SCNFC:${tag.publicCode}`;
    copyToClipboard(payload);
    setCopiedPayloadId(tag.id);
    setTimeout(() => setCopiedPayloadId((id) => (id === tag.id ? null : id)), 2000);
  }

  function openLinkReaderModal(tag: NfcTag) {
    if (!tag.student) return;
    setLinkReaderTarget({
      id: tag.id,
      publicCode: tag.publicCode,
      label: tag.label,
      physicalUid: tag.physicalUid,
      student: tag.student,
    });
    setLinkReaderCapture(null);
    setLinkReaderError(null);
    setLinkReaderSuccess(null);
    setLinkReaderConflict(null);
    setLinkReaderTransferReason("");
  }

  function closeLinkReaderModal() {
    setLinkReaderTarget(null);
  }

  async function handleStartReaderLinkCapture() {
    if (!linkReaderTarget) return;
    setLinkReaderLoading(true);
    setLinkReaderError(null);
    setLinkReaderSuccess(null);
    setLinkReaderConflict(null);
    try {
      const session = await startReaderCredentialCapture(linkReaderTarget.id, {
        deviceId: linkReaderDeviceId || undefined,
      });
      setLinkReaderCapture(session);
    } catch (startError) {
      setLinkReaderError(startError instanceof Error ? startError.message : "Failed to start reader credential capture.");
    } finally {
      setLinkReaderLoading(false);
    }
  }

  async function handleConfirmReaderLink() {
    if (!linkReaderTarget || !linkReaderCapture) return;
    setLinkReaderConfirming(true);
    setLinkReaderError(null);
    setLinkReaderConflict(null);
    try {
      const result = await confirmReaderCredentialCapture(linkReaderCapture.captureId);
      setLinkReaderSuccess("Reader credential linked successfully.");
      setLinkReaderCapture((current) => current ? { ...current, status: "CONFIRMED", confirmedAt: new Date().toISOString() } : current);
      setTags((prev) => prev.map((tag) => (tag.id === result.tag.id ? { ...tag, physicalUid: result.tag.physicalUid } : tag)));
    } catch (confirmError) {
      const maybeConflict = confirmError as Error & { data?: ReaderCredentialConflictResponse };
      if (maybeConflict.data?.code === "READER_CREDENTIAL_CONFLICT") {
        setLinkReaderConflict(maybeConflict.data.conflict);
        setLinkReaderError(maybeConflict.data.message);
      } else {
        setLinkReaderError(confirmError instanceof Error ? confirmError.message : "Failed to confirm reader credential link.");
      }
    } finally {
      setLinkReaderConfirming(false);
    }
  }

  async function handleTransferReaderLink() {
    if (!linkReaderCapture) return;
    if (!linkReaderTransferReason.trim()) {
      setLinkReaderError("Transfer reason is required.");
      return;
    }
    setLinkReaderTransferring(true);
    setLinkReaderError(null);
    try {
      const result = await transferReaderCredentialCapture(linkReaderCapture.captureId, linkReaderTransferReason.trim());
      setLinkReaderSuccess("Reader credential transferred successfully.");
      setLinkReaderConflict(null);
      setLinkReaderCapture((current) => current ? { ...current, status: "CONFIRMED", confirmedAt: new Date().toISOString() } : current);
      setTags((prev) => prev.map((tag) => (tag.id === result.tag.id ? { ...tag, physicalUid: result.tag.physicalUid } : tag)));
    } catch (transferError) {
      setLinkReaderError(transferError instanceof Error ? transferError.message : "Failed to transfer reader credential.");
    } finally {
      setLinkReaderTransferring(false);
    }
  }

  function makeActions(tag: NfcTag): TagActions {
    return {
      onCopyPayload: () => handleCopyPayload(tag),
      onCopyUrl: () => handleCopy(tag),
      onAssign: () => { setAssignTagId(tag.id); setAssignSearch(""); setAssignSelected(null); setAssignResults([]); setAssignError(null); },
      onUnassign: () => { void handleUnassign(tag.id); },
      onDisable: () => { if (confirm("Disable this tag? It will no longer resolve.")) void handleDisable(tag.id); },
      onEnable: () => { setEnableTarget(tag); setEnableReason(""); setEnableError(null); },
      onEvents: () => { void handleViewEvents(tag.id); },
      onLinkReaderCredential: () => { openLinkReaderModal(tag); },
      onWalletPin: () => {
        if (tag.student) {
          openWalletPinModal({ studentId: tag.student.id, studentName: tag.student.name, admissionNumber: tag.student.admissionNumber });
        }
      },
      copiedId,
      copiedPayloadId,
    };
  }

  return (
    <div className="space-y-3 px-4 pb-24 pt-6 sm:px-5 sm:pb-24 sm:pt-6 xl:px-6 xl:pb-28 xl:pt-7">
      <div className="space-y-1">
        <h1 className="text-2xl font-black tracking-tight text-slate-950">NFC Tags</h1>
        <p className="text-sm text-slate-500">Manage physical NFC tags — generate, assign to students, and monitor taps.</p>
      </div>

      {/* Generate strip — stacks on mobile */}
      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm font-black text-slate-950">Generate new tags</p>
          <input
            type="number"
            min={1}
            max={100}
            value={generateCount}
            onChange={(e) => setGenerateCount(Math.max(1, Math.min(100, Number(e.target.value))))}
            className="premium-control w-full sm:w-[104px]"
          />
          <button
            type="button"
            onClick={() => { void handleGenerate(); }}
            disabled={generating}
            className="btn btn-primary min-h-[38px] w-full rounded-xl px-4 py-2 text-sm font-black sm:w-auto"
          >
            {generating ? "Generating…" : `Generate ${generateCount} tag${generateCount > 1 ? "s" : ""}`}
          </button>
        </div>
        {generateError && <p className="mt-2 text-xs text-red-600">{generateError}</p>}
      </div>

      {/* Filter row — wraps cleanly on mobile */}
      <div className="flex flex-wrap items-center gap-1.5">
        <p className="text-sm font-semibold text-slate-600">Filter:</p>
        {(["", "UNASSIGNED", "ASSIGNED", "DISABLED", "LOST"] as StatusFilter[]).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatusFilter(s)}
            className={`min-h-[34px] rounded-full border px-3 py-1 text-xs font-black transition ${statusFilter === s ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-blue-200"}`}
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
      <div className="hidden overflow-visible rounded-2xl border border-slate-200 bg-white shadow-sm md:block">
        {loading ? (
          <p className="p-6 text-sm text-slate-500">Loading tags…</p>
        ) : tags.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">No tags found. Generate some above to get started.</p>
        ) : (
          <table className="w-full table-fixed text-sm">
            <colgroup>
              <col className="w-[10%]" />
              <col className="w-[22%]" />
              <col className="w-[8%]" />
              <col className="w-[22%]" />
              <col className="w-[14%]" />
              <col className="w-[6%]" />
              <col className="w-[18%]" />
            </colgroup>
            <thead className="border-b border-slate-100 bg-slate-50 text-left text-[11px] font-black uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-3 py-2.5">Status</th>
                <th className="px-3 py-2.5">Label / Payload</th>
                <th className="px-3 py-2.5">Mode</th>
                <th className="px-3 py-2.5">Student</th>
                <th className="px-3 py-2.5">Last Seen</th>
                <th className="px-3 py-2.5 text-center">Taps</th>
                <th className="px-3 py-2.5">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tags.map((tag) => (
                <tr key={tag.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2.5 align-middle">
                    <StatusBadge status={tag.status} />
                  </td>
                  <td className="min-w-0 px-3 py-2.5 align-middle">
                    <p className="truncate font-bold text-slate-950">{tag.label ?? `Tag ${tag.publicCode.slice(0, 8)}…`}</p>
                    <p className="truncate font-mono text-[11px] text-slate-400">
                      {tag.writtenPayload ?? `SCNFC:${tag.publicCode}`}
                    </p>
                  </td>
                  <td className="px-3 py-2.5 align-middle">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      {tag.tagMode}
                    </span>
                  </td>
                  <td className="min-w-0 px-3 py-2.5 align-middle">
                    {tag.student ? (
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-950">{tag.student.name}</p>
                        <p className="truncate text-[11px] text-slate-400">{tag.student.admissionNumber}{tag.student.className ? ` · ${tag.student.className}` : ""}</p>
                      </div>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 align-middle text-slate-500">
                    {tag.lastSeenAt ? new Date(tag.lastSeenAt).toLocaleString() : "—"}
                  </td>
                  <td className="px-3 py-2.5 align-middle text-center font-semibold text-slate-700">{tag.tapCount ?? 0}</td>
                  <td className="px-3 py-2.5 align-middle">
                    <div className="flex max-w-full flex-wrap items-center gap-1.5">
                      {tag.status !== "DISABLED" && tag.status !== "ASSIGNED" ? (
                        <button
                          type="button"
                          onClick={() => { setAssignTagId(tag.id); setAssignSearch(""); setAssignSelected(null); setAssignResults([]); setAssignError(null); }}
                          className={`${compactActionButtonClass} border-blue-200 bg-blue-600 text-white hover:bg-blue-700`}
                        >
                          Assign
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => { void handleUnassign(tag.id); }}
                          className={`${compactActionButtonClass} border-slate-200 bg-white text-slate-700 hover:bg-slate-50`}
                        >
                          Unassign
                        </button>
                      )}
                      {tag.status === "ASSIGNED" && tag.student ? (
                        <button
                          type="button"
                          onClick={() => openLinkReaderModal(tag)}
                          className={`${compactActionButtonClass} border-amber-200 text-amber-700 hover:bg-amber-50`}
                        >
                          Link reader
                        </button>
                      ) : null}
                      <RowMoreMenu
                        tag={tag}
                        actions={makeActions(tag)}
                        isOpen={openDropdownId === tag.id}
                        onToggle={() => setOpenDropdownId((id) => (id === tag.id ? null : tag.id))}
                        onClose={() => setOpenDropdownId(null)}
                      />
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

      {/* Link reader credential modal */}
      {linkReaderTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={closeLinkReaderModal}>
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-black text-slate-950">Link reader credential</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Preserve the written <span className="font-mono">SCNFC:{linkReaderTarget.publicCode}</span> payload and link a separate Wiegand credential for this wristband.
                </p>
              </div>
              <button type="button" onClick={closeLinkReaderModal} className="text-slate-400 hover:text-slate-700">x</button>
            </div>

            <div className="mt-4 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm sm:grid-cols-2">
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-slate-500">Student</p>
                <p className="mt-1 font-semibold text-slate-900">{linkReaderTarget.student.name}</p>
                <p className="text-xs text-slate-500">{linkReaderTarget.student.admissionNumber}</p>
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-slate-500">Wristband</p>
                <p className="mt-1 font-semibold text-slate-900">{linkReaderTarget.label ?? `Tag ${linkReaderTarget.publicCode.slice(0, 8)}...`}</p>
                <p className="font-mono text-xs text-slate-500">SCNFC:{linkReaderTarget.publicCode}</p>
                <p className="mt-1 text-xs text-slate-500">
                  Current reader credential: {linkReaderTarget.physicalUid ? "Linked" : "Not linked"}
                </p>
              </div>
            </div>

            {!linkReaderCapture && (
              <div className="mt-5 space-y-4">
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  Start capture mode, tap the already assigned physical wristband on an active attendance reader, then review the masked reader identifiers before confirming.
                </div>
                <label className="grid gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
                  Attendance reader
                  <select
                    className="premium-control"
                    value={linkReaderDeviceId}
                    onChange={(e) => setLinkReaderDeviceId(e.target.value)}
                    disabled={linkReaderDevicesLoading || linkReaderLoading}
                  >
                    {linkReaderDevices.length === 0 && <option value="">No active attendance readers found</option>}
                    {linkReaderDevices.map((device) => (
                      <option key={device.id} value={device.id}>
                        {(device.locationName ?? device.location ?? device.name)} ({device.deviceKey})
                      </option>
                    ))}
                  </select>
                </label>
                {linkReaderDevicesLoading && <p className="text-xs text-slate-500">Loading attendance readers...</p>}
                <button
                  type="button"
                  onClick={() => { void handleStartReaderLinkCapture(); }}
                  disabled={linkReaderLoading || linkReaderDevicesLoading || !linkReaderDeviceId}
                  className="btn btn-primary min-h-[44px] rounded-xl px-4 py-2.5 text-sm font-black"
                >
                  {linkReaderLoading ? "Starting capture..." : "Start capture mode"}
                </button>
              </div>
            )}

            {linkReaderCapture && (
              <div className="mt-5 space-y-4">
                <div className="grid gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-black uppercase tracking-wider text-blue-700">Capture status</p>
                    <p className="mt-1 font-semibold text-slate-900">{linkReaderCapture.status}</p>
                    <p className="text-xs text-slate-600">Expires: {new Date(linkReaderCapture.expiresAt).toLocaleTimeString()}</p>
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-wider text-blue-700">Reader</p>
                    <p className="mt-1 font-semibold text-slate-900">{linkReaderCapture.deviceLabel ?? "Any linked attendance reader"}</p>
                  </div>
                </div>

                {linkReaderCapture.status === "PENDING" && (
                  <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
                    Waiting for one physical tap from the selected wristband on the attendance reader. This page refreshes automatically when the reader sends the Wiegand credential.
                  </div>
                )}

                {linkReaderCapture.preview && (
                  <div className="grid gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm sm:grid-cols-2">
                    <div>
                      <p className="text-xs font-black uppercase tracking-wider text-emerald-700">Masked canonical credential</p>
                      <p className="mt-1 font-mono text-slate-900">{linkReaderCapture.preview.maskedCanonicalCredential ?? "-"}</p>
                    </div>
                    <div>
                      <p className="text-xs font-black uppercase tracking-wider text-emerald-700">Reader source</p>
                      <p className="mt-1 font-semibold text-slate-900">{linkReaderCapture.preview.readerName}</p>
                      <p className="text-xs text-slate-600">Captured {new Date(linkReaderCapture.preview.capturedAt).toLocaleTimeString()}</p>
                    </div>
                    <div>
                      <p className="text-xs font-black uppercase tracking-wider text-emerald-700">Structured fields</p>
                      <ul className="mt-1 space-y-1 text-xs text-slate-700">
                        <li>Credential: {linkReaderCapture.preview.credential ?? "-"}</li>
                        <li>Raw decimal: {linkReaderCapture.preview.rawWiegandDecimal ?? "-"}</li>
                        <li>Raw hex: {linkReaderCapture.preview.rawWiegandHex ?? "-"}</li>
                        <li>Facility code: {linkReaderCapture.preview.facilityCode ?? "-"}</li>
                        <li>Card number: {linkReaderCapture.preview.cardNumber ?? "-"}</li>
                      </ul>
                    </div>
                    <div>
                      <p className="text-xs font-black uppercase tracking-wider text-emerald-700">Deterministic aliases</p>
                      <ul className="mt-1 space-y-1 text-xs text-slate-700">
                        {linkReaderCapture.preview.maskedAliases.length === 0 ? (
                          <li>-</li>
                        ) : (
                          linkReaderCapture.preview.maskedAliases.map((alias) => <li key={alias}>{alias}</li>)
                        )}
                      </ul>
                    </div>
                  </div>
                )}

                {linkReaderCapture.status === "CAPTURED" && (
                  <div className="rounded-xl border border-emerald-200 bg-white p-4 text-sm text-slate-700">
                    Review the masked reader identifiers above, confirm the student and wristband, then save the canonical reader credential. The written NFC payload will not be changed.
                  </div>
                )}
              </div>
            )}

            {linkReaderError && <p className="mt-4 text-sm text-red-600">{linkReaderError}</p>}
            {linkReaderSuccess && <p className="mt-4 text-sm font-semibold text-emerald-700">{linkReaderSuccess}</p>}

            {linkReaderConflict && (
              <div className="mt-4 space-y-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">
                <div>
                  <p className="font-black text-amber-900">Existing active reader credential found</p>
                  <p className="mt-1 text-amber-800">
                    {linkReaderConflict.previousStudent.name} ({linkReaderConflict.previousStudent.admissionNumber}) already has the matching reader credential.
                  </p>
                </div>
                <div className="grid gap-2 text-xs text-amber-900 sm:grid-cols-2">
                  <p>Credential status: <span className="font-bold">{linkReaderConflict.previousCredential.status}</span></p>
                  <p>Matched alias: <span className="font-mono font-bold">{linkReaderConflict.matchedAliasMasked ?? "-"}</span></p>
                  <p>Alias source: <span className="font-bold">{linkReaderConflict.matchedAliasSource ?? "-"}</span></p>
                  <p>Alias strength: <span className="font-bold">{linkReaderConflict.matchedAliasStrength}</span></p>
                  <p>Existing tag: <span className="font-bold">{linkReaderConflict.previousTag?.label ?? "Unlabeled wristband"}</span></p>
                  <p>Public-code prefix: <span className="font-mono font-bold">{linkReaderConflict.previousTag?.publicCodePrefix ?? "-"}</span></p>
                </div>
                {linkReaderConflict.canTransfer && (
                  <>
                    <label className="grid gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-900">
                      Transfer reason
                      <textarea
                        className="premium-control min-h-[80px] resize-none rounded-xl text-sm"
                        value={linkReaderTransferReason}
                        onChange={(e) => setLinkReaderTransferReason(e.target.value)}
                        placeholder="Explain why this reader credential is being reassigned."
                      />
                    </label>
                    <p className="text-xs text-amber-800">
                      Transfer deactivates the previous student credential, clears the previous tag physical UID only when it matches, and links this captured reader credential to the current assigned wristband without changing historical attendance.
                    </p>
                  </>
                )}
              </div>
            )}

            <div className="mt-6 flex flex-wrap gap-3">
              {linkReaderCapture?.status === "CAPTURED" && (
                <button
                  type="button"
                  onClick={() => { void handleConfirmReaderLink(); }}
                  disabled={linkReaderConfirming}
                  className="btn btn-primary min-h-[44px] rounded-xl px-4 py-2.5 text-sm font-black"
                >
                  {linkReaderConfirming ? "Saving link..." : "Confirm link"}
                </button>
              )}
              {linkReaderConflict?.canTransfer && (
                <button
                  type="button"
                  onClick={() => { void handleTransferReaderLink(); }}
                  disabled={linkReaderTransferring}
                  className="rounded-xl border border-amber-300 bg-amber-100 px-4 py-2.5 text-sm font-black text-amber-900 hover:bg-amber-200 disabled:opacity-60"
                >
                  {linkReaderTransferring ? "Transferring..." : "Transfer reader credential"}
                </button>
              )}
              {linkReaderCapture?.status === "CONFIRMED" && (
                <button
                  type="button"
                  onClick={closeLinkReaderModal}
                  className="btn btn-primary min-h-[44px] rounded-xl px-4 py-2.5 text-sm font-black"
                >
                  Done
                </button>
              )}
              <button
                type="button"
                onClick={closeLinkReaderModal}
                className="btn btn-secondary min-h-[44px] rounded-xl px-4 py-2.5 text-sm font-bold"
              >
                {linkReaderCapture?.status === "CONFIRMED" ? "Close" : "Cancel"}
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
