import { useEffect, useRef, useState, type FormEvent } from "react";
import { WifiOffRegular, ArrowSyncRegular } from "@fluentui/react-icons";
import { NfcScanPanel } from "../components/nfc/NfcScanPanel";
import { useNfcScanner, type ScanResult } from "../hooks/useNfcScanner";
import { useConnectivityStatus } from "../hooks/useConnectivityStatus";
import { useNfcOfflineSnapshotRefresh } from "../hooks/useNfcOfflineSnapshotRefresh";
import { useAuth } from "../contexts/AuthContext";
import {
  checkOutNfcVisitor,
  fetchNfcGateDashboard,
  fetchNfcGatePassOuts,
  fetchNfcVisitors,
  registerNfcVisitor,
  scanNfcGate,
} from "../client/studentCredentialsClient";
import { fetchAppVersion } from "../client/appVersionClient";
import { resolveOfflineNfcScan } from "../offline/offlineResolver";
import { queueGateScan, getSnapshotMeta, getGateQueueStatus, type GateQueueStatus } from "../offline/offlineStore";
import { getSnapshotValidity } from "../offline/offlineStatus";
import { hashNfcLookupValue } from "../offline/offlineHash";
import { normalizeNfcScanValue } from "../shared/utils/nfcPayload";
import type { NfcGateDashboard, NfcGateScanResponse, NfcVisitorVisit, StudentPassOutRow } from "../shared/types/studentCredentials";
import type { OfflineResolveResult } from "../offline/offlineTypes";

function offlineReasonMessage(reason?: string) {
  switch (reason) {
    case "no_snapshot": return "Local Gate Register is not downloaded yet.";
    case "expired": return "Local Gate Register has expired.";
    case "wrong_school": return "Local Gate Register belongs to another school.";
    case "wrong_device": return "Local Gate Register belongs to another device.";
    case "missing_module": return "Local Gate Register is missing gate data.";
    case "empty_students": return "Local Gate Register downloaded but contains no students.";
    case "empty_tags": return "Local Gate Register downloaded but contains no NFC tags.";
    case "offline_disabled_by_policy": return "Local Gate Register scanning is disabled by school policy.";
    default: return "Local Gate Register is not configured for this device.";
  }
}

function getDeviceId(): string {
  const key = "schoolconnect_nfc_device_id";
  let id = localStorage.getItem(key);
  if (!id) { id = crypto.randomUUID(); localStorage.setItem(key, id); }
  return id;
}

type LocalScanResult =
  | NfcGateScanResponse
  | {
      result: "ALLOWED" | "BLOCKED";
      reason?: string;
      student?: { name: string; admissionNumber: string; className?: string | null; streamName?: string | null };
      scannedAt: string;
      offline?: true;
      queued?: boolean;
      syncStatus?: "Pending" | "Syncing in background";
    };

type VisitorFormState = {
  fullName: string;
  phone: string;
  idDocumentType: string;
  idDocumentNumber: string;
  purpose: string;
  hostName: string;
};

const INITIAL_VISITOR_FORM: VisitorFormState = {
  fullName: "",
  phone: "",
  idDocumentType: "",
  idDocumentNumber: "",
  purpose: "",
  hostName: "",
};

const GATE_APP_VERSION_KEY = "sc_gate_app_version";
const GATE_APP_RELOAD_KEY = "sc_gate_app_reloaded_version";

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Not recorded";
  return new Date(value).toLocaleString();
}

function formatPassOutStatus(status: string | null | undefined) {
  if (!status) return "No pass-out";
  return status.toLowerCase().replace(/_/g, " ");
}

function passOutInstruction(status: StudentPassOutRow["status"]) {
  if (status === "APPROVED") return "Scan student card to check out";
  if (status === "CHECKED_OUT") return "Scan student card when student returns";
  if (status === "RETURNED") return "Returned";
  return "Not active";
}

function passOutResultTitle(scanResult: LocalScanResult) {
  if (!("passOutAction" in scanResult)) return null;
  if (scanResult.passOutAction === "CHECKED_OUT") return "Pass-out checkout confirmed";
  if (scanResult.passOutAction === "CHECKED_IN") return "Return check-in confirmed";
  return null;
}

export function NfcGateSecurityPage() {
  const { user, token, loading: authLoading } = useAuth();
  const deviceId = useRef(getDeviceId()).current;
  const isGateAccount = user?.role === "SECURITY" || user?.role === "GATE_SECURITY";

  useEffect(() => {
    if (!isGateAccount) return;

    const lockBackNavigation = () => {
      window.history.pushState({ gateKioskLock: true }, "", window.location.href);
    };

    lockBackNavigation();
    window.addEventListener("popstate", lockBackNavigation);

    return () => {
      window.removeEventListener("popstate", lockBackNavigation);
    };
  }, [isGateAccount]);

  const { state: connState, isOfflineReady, pendingCount, triggerSync } = useConnectivityStatus(user?.schoolId, deviceId, "gate");
  const snapshotRefresh = useNfcOfflineSnapshotRefresh({
    schoolId: user?.schoolId,
    deviceId,
    mode: "GATE",
    requiredModule: "gate",
    enabled: !!user && !!token,
  });

  const [scanResult, setScanResult] = useState<LocalScanResult | null>(null);
  const [dashboard, setDashboard] = useState<NfcGateDashboard | null>(null);
  const [passOuts, setPassOuts] = useState<StudentPassOutRow[]>([]);
  const [loadError, setLoadError] = useState("");
  const [offlineQueue, setOfflineQueue] = useState<Array<{ result: string; student?: string; scannedAt: string }>>([]);
  const [queueStatus, setQueueStatus] = useState<GateQueueStatus | null>(null);
  const [retryMessage, setRetryMessage] = useState("");
  const [retrying, setRetrying] = useState(false);
  const [lastSyncAttemptAt, setLastSyncAttemptAt] = useState<string | null>(null);
  const [visitors, setVisitors] = useState<NfcVisitorVisit[]>([]);
  const [visitorLoading, setVisitorLoading] = useState(false);
  const [visitorError, setVisitorError] = useState("");
  const [visitorSuccess, setVisitorSuccess] = useState("");
  const [registeringVisitor, setRegisteringVisitor] = useState(false);
  const [checkingOutVisitorId, setCheckingOutVisitorId] = useState<string | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [visitorForm, setVisitorForm] = useState<VisitorFormState>(INITIAL_VISITOR_FORM);
  const [idDocumentImage, setIdDocumentImage] = useState<File | null>(null);
  const [selfieImage, setSelfieImage] = useState<File | null>(null);

  async function load() {
    if (isOfflineReady) return;
    if (!user || !token) {
      setDashboard(null);
      setLoadError("Please sign in again.");
      return;
    }
    try {
      setLoadError("");
      const [nextDashboard, nextPassOuts] = await Promise.all([
        fetchNfcGateDashboard(),
        fetchNfcGatePassOuts(),
      ]);
      setDashboard(nextDashboard);
      setPassOuts(nextPassOuts.passOuts);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not load gate scans.";
      setDashboard(null);
      setPassOuts([]);
      if (/session|unauthori[sz]ed|login|sign in/i.test(message)) {
        setLoadError("Please sign in again.");
      } else if (/access|forbidden|permission/i.test(message)) {
        setLoadError("Gate access is blocked for this account. Ask an administrator to check the Gate Security role.");
      } else {
        setLoadError(message);
      }
    }
  }

  async function loadVisitors() {
    if (isOfflineReady || !user || !token) {
      setVisitors([]);
      return;
    }
    try {
      setVisitorLoading(true);
      setVisitorError("");
      const result = await fetchNfcVisitors({ status: "ALL" });
      setVisitors(result.visits);
    } catch (error) {
      setVisitorError(error instanceof Error ? error.message : "Could not load visitor register.");
    } finally {
      setVisitorLoading(false);
    }
  }

  useEffect(() => {
    if (authLoading) return;
    void load();
  }, [authLoading, isOfflineReady, token, user?.schoolId]);

  useEffect(() => {
    if (authLoading) return;
    void loadVisitors();
  }, [authLoading, isOfflineReady, token, user?.schoolId]);

  async function refreshGateQueueStatus() {
    if (!user?.schoolId) return;
    setQueueStatus(await getGateQueueStatus(user.schoolId));
  }

  useEffect(() => {
    void refreshGateQueueStatus();
  }, [user?.schoolId, pendingCount, connState]);

  async function retryGateSync() {
    if (!user?.schoolId) return;
    setRetrying(true);
    setRetryMessage("Retrying pending gate sync...");
    try {
      await triggerSync();
      setLastSyncAttemptAt(new Date().toISOString());
      await refreshGateQueueStatus();
      setRetryMessage("Gate sync retried. New scans can continue from the Local Gate Register.");
    } catch (error) {
      setRetryMessage(error instanceof Error ? error.message : "Gate sync retry failed.");
    } finally {
      setRetrying(false);
    }
  }

  function updateVisitorField(field: keyof VisitorFormState, value: string) {
    setVisitorForm((current) => ({ ...current, [field]: value }));
  }

  async function submitVisitorRegistration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!idDocumentImage || !selfieImage) {
      setVisitorError("Both the visitor ID/passport image and selfie image are required.");
      setVisitorSuccess("");
      return;
    }

    setRegisteringVisitor(true);
    setVisitorError("");
    setVisitorSuccess("");
    try {
      await registerNfcVisitor({
        ...visitorForm,
        idDocumentImage,
        selfieImage,
      });
      setVisitorForm(INITIAL_VISITOR_FORM);
      setIdDocumentImage(null);
      setSelfieImage(null);
      form.reset();
      setVisitorSuccess("Visitor checked in and added to the gate register.");
      await loadVisitors();
    } catch (error) {
      setVisitorError(error instanceof Error ? error.message : "Could not register visitor.");
    } finally {
      setRegisteringVisitor(false);
    }
  }

  async function handleVisitorCheckout(visitId: string) {
    setCheckingOutVisitorId(visitId);
    setVisitorError("");
    setVisitorSuccess("");
    try {
      const result = await checkOutNfcVisitor(visitId);
      setVisitorSuccess(result.duplicate ? "Visitor was already checked out." : "Visitor checked out successfully.");
      await loadVisitors();
    } catch (error) {
      setVisitorError(error instanceof Error ? error.message : "Could not check out visitor.");
    } finally {
      setCheckingOutVisitorId(null);
    }
  }

  const handleScan = async ({ tokenOrUid, idempotencyKey, deviceId: scanDeviceId }: ScanResult) => {
    const validity = await getSnapshotValidity({ schoolId: user?.schoolId, deviceId, mode: "GATE", requiredModule: "gate" });

    if (validity.valid) {
      if (!user?.schoolId) return;
      const resolve: OfflineResolveResult = await resolveOfflineNfcScan(user.schoolId, tokenOrUid);
      const meta = await getSnapshotMeta({ schoolId: user.schoolId, deviceId, mode: "GATE" });
      const scannedAt = new Date().toISOString();

      const localResult: "ALLOWED" | "BLOCKED" = resolve.blocked ? "BLOCKED" : "ALLOWED";
      const tokenOrUidHash = await hashNfcLookupValue(normalizeNfcScanValue(tokenOrUid));

      await queueGateScan({
        schoolId: user.schoolId,
        deviceId: scanDeviceId ?? deviceId,
        snapshotId: meta?.snapshotId ?? "unknown",
        studentId: resolve.student?.id ?? null,
        tagId: resolve.tag?.id ?? null,
        payload: {
          actionType: "GATE_SCAN",
          tokenOrUidHash,
          publicCode: resolve.tag?.publicCode ?? null,
          physicalUid: resolve.tag?.physicalUid ?? null,
          studentId: resolve.student?.id ?? null,
          tagId: resolve.tag?.id ?? null,
          result: localResult,
          reason: resolve.reason ?? null,
          scannedAt,
        },
      });

      const offlineData: LocalScanResult = {
        result: localResult,
        reason: resolve.reason,
        student: resolve.student
          ? {
              name: `${resolve.student.firstName} ${resolve.student.lastName}`.trim(),
              admissionNumber: resolve.student.admissionNumber,
              className: resolve.student.className,
              streamName: resolve.student.streamName,
            }
          : undefined,
        scannedAt,
        offline: true,
        queued: true,
        syncStatus: typeof navigator !== "undefined" && navigator.onLine ? "Syncing in background" : "Pending",
      };

      setScanResult(offlineData);
      setOfflineQueue((prev) => [
        { result: localResult, student: resolve.student ? `${resolve.student.firstName} ${resolve.student.lastName}`.trim() : undefined, scannedAt },
        ...prev.slice(0, 19),
      ]);
      await refreshGateQueueStatus();
      if (typeof navigator !== "undefined" && navigator.onLine) {
        void triggerSync()
          .then(() => {
            setLastSyncAttemptAt(new Date().toISOString());
            return refreshGateQueueStatus();
          })
          .catch(() => refreshGateQueueStatus());
      }
    } else if (typeof navigator !== "undefined" && !navigator.onLine) {
      throw new Error(offlineReasonMessage(validity.reason));
    } else {
      const result = await scanNfcGate({ tokenOrUid, idempotencyKey, deviceId: scanDeviceId });
      setScanResult(result);
      await load();
    }
  };

  const scanner = useNfcScanner({ onScan: handleScan });
  const result = scanResult?.result;
  const allowed = result === "ALLOWED";
  const passOutTitle = scanResult ? passOutResultTitle(scanResult) : null;
  const scannerIdleForReload = !["PERMISSION", "READING", "PROCESSING"].includes(scanner.state);

  useEffect(() => {
    if (!user || !token) return;

    let cancelled = false;
    let checking = false;
    const checkVersion = async () => {
      if (checking || (typeof navigator !== "undefined" && !navigator.onLine)) return;
      checking = true;
      try {
        const next = await fetchAppVersion();
        if (cancelled || !next.version) return;
        const current = window.localStorage.getItem(GATE_APP_VERSION_KEY);
        window.localStorage.setItem(GATE_APP_VERSION_KEY, next.version);
        if (!current || current === next.version) {
          setUpdateAvailable(false);
          return;
        }

        setUpdateAvailable(true);
        const alreadyReloaded = window.sessionStorage.getItem(GATE_APP_RELOAD_KEY);
        if (scannerIdleForReload && alreadyReloaded !== next.version) {
          window.sessionStorage.setItem(GATE_APP_RELOAD_KEY, next.version);
          window.location.reload();
        }
      } catch {
        // Version checks are a freshness enhancement; never block gate scanning.
      } finally {
        checking = false;
      }
    };

    const onVisibleOrOnline = () => {
      if (document.visibilityState === "visible") void checkVersion();
    };

    void checkVersion();
    document.addEventListener("visibilitychange", onVisibleOrOnline);
    window.addEventListener("online", onVisibleOrOnline);
    const interval = window.setInterval(() => void checkVersion(), 60_000);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibleOrOnline);
      window.removeEventListener("online", onVisibleOrOnline);
      window.clearInterval(interval);
    };
  }, [scannerIdleForReload, token, user]);

  if (authLoading) {
    return (
      <main className="grid gap-5">
        <header className="page-header">
          <p className="text-xs font-bold uppercase tracking-wide text-blue-600">NFC Operations</p>
          <h1 className="text-xl font-bold text-slate-950 sm:text-2xl">Gate Security</h1>
        </header>
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500 shadow-sm">
          Checking your gate session...
        </div>
      </main>
    );
  }

  if (!user || !token) {
    return (
      <main className="grid gap-5">
        <header className="page-header">
          <p className="text-xs font-bold uppercase tracking-wide text-blue-600">NFC Operations</p>
          <h1 className="text-xl font-bold text-slate-950 sm:text-2xl">Gate Security</h1>
        </header>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 shadow-sm">
          Please sign in again to continue using Gate Security.
        </div>
      </main>
    );
  }

  return (
    <main className="grid gap-5">
      <header className="page-header">
        <p className="text-xs font-bold uppercase tracking-wide text-blue-600">NFC Operations</p>
        <h1 className="text-xl font-bold text-slate-950 sm:text-2xl">Gate Security</h1>
      </header>

      {isOfflineReady && (
        <div className="flex items-center gap-3 rounded-xl border border-orange-200 bg-orange-50 p-3">
          <WifiOffRegular className="h-5 w-5 shrink-0 text-orange-600" />
          <div>
            <p className="text-sm font-semibold text-orange-800">Local Gate Register Active</p>
            <p className="text-xs text-orange-600">Gate scans are saved locally first. {pendingCount > 0 ? `Pending gate sync: ${pendingCount} scans.` : "Will sync when connection returns."}</p>
          </div>
        </div>
      )}
      {connState === "DEGRADED" && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
          <ArrowSyncRegular className="h-4 w-4 shrink-0 animate-spin text-amber-600" />
          <p className="text-sm text-amber-800">Connection unstable - scans are still going to the server</p>
        </div>
      )}

      {updateAvailable && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
          <p className="font-bold">Update available</p>
          <p className="mt-1">Gate will reload to the latest version when the scanner is idle. Offline queue and local register data are preserved.</p>
          {scannerIdleForReload ? (
            <button type="button" className="mt-2 rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-bold text-white" onClick={() => window.location.reload()}>
              Reload app
            </button>
          ) : null}
        </div>
      )}

      {!isOfflineReady && snapshotRefresh.validity && !snapshotRefresh.validity.valid && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          <p className="font-bold">Local Gate Register: {offlineReasonMessage(snapshotRefresh.validity.reason)}</p>
          <p className="mt-1">
            {snapshotRefresh.isRefreshing ? "Updating Gate Register in the background..." : "The scanner can still use the online server while connected."}
            {snapshotRefresh.refreshError ? ` Last refresh failed: ${snapshotRefresh.refreshError}` : ""}
          </p>
        </div>
      )}

      {queueStatus && (queueStatus.pending > 0 || queueStatus.syncing > 0 || queueStatus.failed > 0 || queueStatus.conflict > 0) && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          <p className="font-bold">Local Gate Register sync status</p>
          <div className="mt-2 grid gap-1 rounded-lg border border-amber-200 bg-white/70 p-2">
            <p>Pending gate sync: <span className="font-bold">{queueStatus.pending}</span></p>
            <p>Syncing: <span className="font-bold">{queueStatus.syncing}</span></p>
            <p>Failed: <span className="font-bold">{queueStatus.failed}</span></p>
            <p>Conflicts: <span className="font-bold">{queueStatus.conflict}</span></p>
            {queueStatus.lastError ? <p>Last sync error: <span className="font-bold">{queueStatus.lastError}</span></p> : null}
            {lastSyncAttemptAt ? <p>Last sync time: <span className="font-bold">{new Date(lastSyncAttemptAt).toLocaleTimeString()}</span></p> : null}
          </div>
          {retryMessage ? <p className="mt-2 font-bold">{retryMessage}</p> : null}
          {(queueStatus.failed > 0 || queueStatus.pending > 0) && (
            <button type="button" className="mt-2 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60" disabled={retrying} onClick={() => void retryGateSync()}>
              {retrying ? "Retrying..." : "Retry Sync"}
            </button>
          )}
        </div>
      )}

      {loadError && !isOfflineReady && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{loadError}</div>
      )}

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex flex-col gap-4">
          <NfcScanPanel
            state={scanner.state}
            error={scanner.error}
            isOnline={scanner.isOnline}
            isWebNfcAvailable={scanner.isWebNfcAvailable}
            onStart={scanner.startScanner}
            onStop={scanner.stopScanner}
            onManualSubmit={scanner.submitManual}
            scanLabel={isOfflineReady ? "Start Offline Gate Scanner" : "Start Gate Scanner"}
          />

          {scanResult && (
            <div className={`rounded-2xl border p-5 ${allowed ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}>
              <div className="flex items-center justify-between">
                <p className={`text-3xl font-black ${allowed ? "text-emerald-700" : "text-red-700"}`}>
                  {allowed ? "ALLOWED" : "BLOCKED"}
                </p>
                {"offline" in scanResult && scanResult.offline && (
                  <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-600">
                    {scanResult.syncStatus ?? "Pending gate sync"}
                  </span>
                )}
              </div>
              <p className="mt-2 text-sm text-slate-700">{scanResult.reason ?? "Valid active student"}</p>
              {passOutTitle ? (
                <div className="mt-3 rounded-xl border border-emerald-200 bg-white/80 p-3">
                  <p className="text-base font-black text-emerald-800">{passOutTitle}</p>
                  {"parentSmsStatus" in scanResult ? (
                    <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-emerald-700">
                      Parent SMS: {scanResult.parentSmsStatus ?? "SKIPPED"}
                    </p>
                  ) : null}
                </div>
              ) : null}
              {scanResult.student && (
                <div className="mt-4 text-sm">
                  <p className="text-lg font-bold text-slate-950">{scanResult.student.name}</p>
                  <p className="text-slate-700">{scanResult.student.admissionNumber}</p>
                  <p className="text-slate-600">
                    {(scanResult.student.className ?? "No class")} / {(scanResult.student.streamName ?? "No stream")}
                  </p>
                  {"credentialStatus" in scanResult && (
                    <p className="mt-1 text-xs text-slate-600">
                      Status: {(scanResult as NfcGateScanResponse).credentialStatus} | Attendance: {(scanResult as NfcGateScanResponse).todayAttendanceStatus}
                    </p>
                  )}
                  {"passOut" in scanResult && scanResult.passOut && (
                    <div className="mt-3 rounded-xl border border-slate-200 bg-white/70 p-3 text-xs text-slate-700">
                      <p className="font-bold text-slate-900">Pass-out: {formatPassOutStatus(scanResult.passOut.status)}</p>
                      <p>Window: {formatDateTime(scanResult.passOut.activeFrom)} to {formatDateTime(scanResult.passOut.activeUntil)}</p>
                      <p>Checked out: {formatDateTime(scanResult.passOut.checkedOutAt)}</p>
                      <p>Returned: {formatDateTime(scanResult.passOut.checkedInAt)}</p>
                    </div>
                  )}
                </div>
              )}
              <p className="mt-3 text-xs text-slate-400">{new Date(scanResult.scannedAt).toLocaleTimeString()}</p>
            </div>
          )}

          <section className="premium-card rounded-xl p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-950">Visitor check-in</h2>
                <p className="mt-1 text-sm text-slate-600">Register visitors at the gate with ID/passport and selfie capture before entry.</p>
              </div>
              {isOfflineReady ? (
                <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700">
                  Online required
                </span>
              ) : null}
            </div>

            {visitorError ? (
              <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{visitorError}</div>
            ) : null}
            {visitorSuccess ? (
              <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{visitorSuccess}</div>
            ) : null}

            <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={(event) => void submitVisitorRegistration(event)}>
              <label className="grid gap-1 text-sm text-slate-700">
                <span className="font-medium">Visitor name</span>
                <input className="premium-control" value={visitorForm.fullName} onChange={(event) => updateVisitorField("fullName", event.target.value)} disabled={registeringVisitor || isOfflineReady} />
              </label>
              <label className="grid gap-1 text-sm text-slate-700">
                <span className="font-medium">Phone number</span>
                <input className="premium-control" value={visitorForm.phone} onChange={(event) => updateVisitorField("phone", event.target.value)} disabled={registeringVisitor || isOfflineReady} />
              </label>
              <label className="grid gap-1 text-sm text-slate-700">
                <span className="font-medium">ID/passport type</span>
                <input className="premium-control" value={visitorForm.idDocumentType} onChange={(event) => updateVisitorField("idDocumentType", event.target.value)} disabled={registeringVisitor || isOfflineReady} />
              </label>
              <label className="grid gap-1 text-sm text-slate-700">
                <span className="font-medium">ID/passport number</span>
                <input className="premium-control" value={visitorForm.idDocumentNumber} onChange={(event) => updateVisitorField("idDocumentNumber", event.target.value)} disabled={registeringVisitor || isOfflineReady} />
              </label>
              <label className="grid gap-1 text-sm text-slate-700 md:col-span-2">
                <span className="font-medium">Purpose</span>
                <input className="premium-control" value={visitorForm.purpose} onChange={(event) => updateVisitorField("purpose", event.target.value)} disabled={registeringVisitor || isOfflineReady} />
              </label>
              <label className="grid gap-1 text-sm text-slate-700 md:col-span-2">
                <span className="font-medium">Host or person visiting</span>
                <input className="premium-control" value={visitorForm.hostName} onChange={(event) => updateVisitorField("hostName", event.target.value)} disabled={registeringVisitor || isOfflineReady} />
              </label>
              <label className="grid gap-1 text-sm text-slate-700">
                <span className="font-medium">ID/passport image</span>
                <input type="file" accept="image/*" onChange={(event) => setIdDocumentImage(event.target.files?.[0] ?? null)} disabled={registeringVisitor || isOfflineReady} />
              </label>
              <label className="grid gap-1 text-sm text-slate-700">
                <span className="font-medium">Selfie image</span>
                <input type="file" accept="image/*" onChange={(event) => setSelfieImage(event.target.files?.[0] ?? null)} disabled={registeringVisitor || isOfflineReady} />
              </label>
              <div className="flex items-center justify-between gap-3 md:col-span-2">
                <p className="text-xs text-slate-500">Visitor registration stays inside the current school and uses the existing private upload path.</p>
                <button type="submit" className="btn" disabled={registeringVisitor || isOfflineReady}>
                  {registeringVisitor ? "Checking in..." : "Check in visitor"}
                </button>
              </div>
            </form>
          </section>
        </div>

        <aside className="grid gap-4">
          <section className="premium-card rounded-xl p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-bold text-slate-950">Pass-outs</h2>
              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-blue-700">
                Today
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500">NFC tap is the checkout and return confirmation.</p>
            <div className="mt-3 grid gap-2">
              {isOfflineReady ? (
                <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800">
                  Pass-out checkout requires internet.
                </p>
              ) : passOuts.length === 0 ? (
                <p className="text-sm text-slate-500">No active pass-outs for today.</p>
              ) : (
                passOuts.map((passOut) => (
                  <div key={passOut.id} className="rounded-xl border border-slate-200 bg-white p-3 text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-bold text-slate-900">{passOut.student.studentName}</p>
                        <p className="text-slate-600">{passOut.student.admissionNumber}</p>
                        <p className="text-xs text-slate-500">
                          {(passOut.student.className ?? "No class")} / {(passOut.student.streamName ?? "No stream")}
                        </p>
                      </div>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${passOut.status === "CHECKED_OUT" ? "bg-amber-100 text-amber-700" : passOut.status === "RETURNED" ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"}`}>
                        {formatPassOutStatus(passOut.status)}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-slate-600">Reason: {passOut.reason}</p>
                    <p className="text-xs text-slate-500">Window: {formatDateTime(passOut.activeFrom)} to {formatDateTime(passOut.activeUntil)}</p>
                    <p className="mt-2 text-xs font-bold text-slate-800">{passOutInstruction(passOut.status)}</p>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="premium-card rounded-xl p-4">
            <h2 className="text-base font-bold text-slate-950">Recent gate scans</h2>
            <div className="mt-3 grid gap-2">
              {isOfflineReady ? (
                offlineQueue.length === 0 ? (
                  <p className="text-sm text-slate-500">No offline scans yet.</p>
                ) : (
                  offlineQueue.map((scan, i) => (
                    <div key={i} className="rounded-xl border border-slate-200 bg-white p-3 text-sm">
                      <div className="flex items-center justify-between">
                        <p className={`font-bold ${scan.result === "ALLOWED" ? "text-emerald-700" : "text-red-700"}`}>{scan.result}</p>
                        <span className="text-xs text-orange-500">offline</span>
                      </div>
                      <p className="text-slate-700">{scan.student ?? "Unknown tag"}</p>
                      <p className="text-slate-500">{new Date(scan.scannedAt).toLocaleString()}</p>
                    </div>
                  ))
                )
              ) : (
                (dashboard?.recentScans ?? []).map((scan, index) => (
                  <div key={`${scan.scannedAt}-${index}`} className="rounded-xl border border-slate-200 bg-white p-3 text-sm">
                    <p className={`font-bold ${scan.result === "ALLOWED" ? "text-emerald-700" : "text-red-700"}`}>{scan.result}</p>
                    <p className="text-slate-700">{scan.student?.name ?? "Unknown tag"}</p>
                    <p className="text-slate-500">{new Date(scan.scannedAt).toLocaleString()}{scan.reason ? ` | ${scan.reason}` : ""}</p>
                  </div>
                ))
              )}
              {!isOfflineReady && dashboard?.recentScans.length === 0 && (
                <p className="text-sm text-slate-500">No gate scans yet.</p>
              )}
            </div>
          </section>

          <section className="premium-card rounded-xl p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-bold text-slate-950">Visitor register</h2>
              <button type="button" className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 disabled:opacity-60" onClick={() => void loadVisitors()} disabled={visitorLoading || isOfflineReady}>
                {visitorLoading ? "Refreshing..." : "Refresh"}
              </button>
            </div>
            <div className="mt-3 grid gap-2">
              {isOfflineReady ? (
                <p className="text-sm text-slate-500">Visitor registration needs a live connection.</p>
              ) : visitorLoading && visitors.length === 0 ? (
                <p className="text-sm text-slate-500">Loading visitor register...</p>
              ) : visitors.length === 0 ? (
                <p className="text-sm text-slate-500">No visitors recorded yet.</p>
              ) : (
                visitors.slice(0, 10).map((visit) => (
                  <div key={visit.id} className="rounded-xl border border-slate-200 bg-white p-3 text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-bold text-slate-900">{visit.visitor.fullName}</p>
                        <p className="text-slate-600">{visit.purpose}</p>
                        <p className="text-xs text-slate-500">Host: {visit.hostName}</p>
                        <p className="text-xs text-slate-500">Checked in: {formatDateTime(visit.checkedInAt)}</p>
                        <p className="text-xs text-slate-500">Checked out: {formatDateTime(visit.checkedOutAt)}</p>
                      </div>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${visit.status === "CHECKED_IN" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-700"}`}>
                        {visit.status === "CHECKED_IN" ? "On site" : "Checked out"}
                      </span>
                    </div>
                    {visit.status === "CHECKED_IN" ? (
                      <button
                        type="button"
                        className="mt-3 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60"
                        disabled={checkingOutVisitorId === visit.id}
                        onClick={() => void handleVisitorCheckout(visit.id)}
                      >
                        {checkingOutVisitorId === visit.id ? "Checking out..." : "Check out"}
                      </button>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </section>
        </aside>
      </section>
    </main>
  );
}
