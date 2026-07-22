import { useCallback, useEffect, useMemo, useState } from "react";
import {
  cancelStudentPassOut,
  createStudentPassOut,
  fetchNfcGateAdminDashboard,
  fetchNfcVisitorDetail,
  fetchNfcVisitors,
  fetchStudentPassOuts,
  searchStudentPassOutCandidates,
} from "../client/studentCredentialsClient";
import { NfcSectionTabs } from "../components/nfc/NfcSectionTabs";
import type {
  NfcGateActivityRow,
  NfcGateAdminDashboard,
  NfcVisitorVisit,
  StudentPassOutRow,
} from "../shared/types/studentCredentials";

type PassOutStatusFilter = "ALL" | "APPROVED" | "CHECKED_OUT" | "RETURNED" | "CANCELLED" | "EXPIRED";
type VisitorFilter = "CURRENT" | "HISTORY" | "ALL";
type GateTab = "PASS_OUTS" | "VISITORS" | "ACTIVITY";

const PASS_OUT_FILTER_LABELS: Record<PassOutStatusFilter, string> = {
  ALL: "Active",
  APPROVED: "Active",
  CHECKED_OUT: "Checked out",
  RETURNED: "Checked in",
  CANCELLED: "Cancelled/expired",
  EXPIRED: "Cancelled/expired",
};

function formatDateTime(value: string | null) {
  if (!value) return "Not recorded";
  return new Date(value).toLocaleString();
}

function isPassOutVisible(passOut: StudentPassOutRow, filter: PassOutStatusFilter) {
  if (filter === "ALL") return passOut.status === "APPROVED";
  if (filter === "CANCELLED") return passOut.status === "CANCELLED" || passOut.status === "EXPIRED";
  return passOut.status === filter;
}

function getActivityTone(type: NfcGateActivityRow["type"]) {
  switch (type) {
    case "BLOCKED_ATTEMPT":
      return "border-red-200 bg-red-50 text-red-700";
    case "PASS_OUT_CHECKOUT":
    case "PASS_OUT_CHECKIN":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "VISITOR_CHECKIN":
    case "VISITOR_CHECKOUT":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
}

export function NfcGateOperationsPage() {
  const [activeTab, setActiveTab] = useState<GateTab>("PASS_OUTS");
  const [dashboard, setDashboard] = useState<NfcGateAdminDashboard | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState<string | null>(null);

  const [passOutStatusFilter, setPassOutStatusFilter] = useState<PassOutStatusFilter>("ALL");
  const [passOuts, setPassOuts] = useState<StudentPassOutRow[]>([]);
  const [passOutLoading, setPassOutLoading] = useState(true);
  const [passOutError, setPassOutError] = useState<string | null>(null);
  const [passOutSearch, setPassOutSearch] = useState("");
  const [passOutStudentResults, setPassOutStudentResults] = useState<Array<{
    id: string;
    studentName: string;
    admissionNumber: string;
    className: string | null;
    streamName: string | null;
    studentType: "DAY" | "BOARDING" | null;
    isActive: boolean;
  }>>([]);
  const [passOutStudentSearching, setPassOutStudentSearching] = useState(false);
  const [passOutSelectedStudent, setPassOutSelectedStudent] = useState<null | {
    id: string;
    studentName: string;
    admissionNumber: string;
    className: string | null;
    streamName: string | null;
    studentType: "DAY" | "BOARDING" | null;
    isActive: boolean;
  }>(null);
  const [passOutReason, setPassOutReason] = useState("");
  const [passOutActiveFrom, setPassOutActiveFrom] = useState("");
  const [passOutActiveUntil, setPassOutActiveUntil] = useState("");
  const [passOutSubmitting, setPassOutSubmitting] = useState(false);
  const [passOutSuccess, setPassOutSuccess] = useState<string | null>(null);
  const [passOutCancelTarget, setPassOutCancelTarget] = useState<StudentPassOutRow | null>(null);
  const [passOutCancelReason, setPassOutCancelReason] = useState("");
  const [passOutCancelling, setPassOutCancelling] = useState(false);

  const [visitorStatusFilter, setVisitorStatusFilter] = useState<VisitorFilter>("CURRENT");
  const [visitorSearch, setVisitorSearch] = useState("");
  const [visits, setVisits] = useState<NfcVisitorVisit[]>([]);
  const [visitsLoading, setVisitsLoading] = useState(true);
  const [visitsError, setVisitsError] = useState<string | null>(null);
  const [selectedVisit, setSelectedVisit] = useState<NfcVisitorVisit | null>(null);
  const [selectedVisitLoading, setSelectedVisitLoading] = useState(false);
  const [selectedVisitError, setSelectedVisitError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    setDashboardLoading(true);
    setDashboardError(null);
    try {
      setDashboard(await fetchNfcGateAdminDashboard());
    } catch (error) {
      setDashboardError(error instanceof Error ? error.message : "Could not load gate activity.");
    } finally {
      setDashboardLoading(false);
    }
  }, []);

  const loadPassOuts = useCallback(async () => {
    setPassOutLoading(true);
    setPassOutError(null);
    try {
      const data = await fetchStudentPassOuts({ activeOnly: false });
      setPassOuts(data.passOuts);
    } catch (error) {
      setPassOutError(error instanceof Error ? error.message : "Could not load pass-outs.");
    } finally {
      setPassOutLoading(false);
    }
  }, []);

  const loadVisitors = useCallback(async () => {
    setVisitsLoading(true);
    setVisitsError(null);
    try {
      const data = await fetchNfcVisitors({
        status: visitorStatusFilter,
        search: visitorSearch.trim() || undefined,
      });
      setVisits(data.visits);
      setSelectedVisit((current) => current ? data.visits.find((visit) => visit.id === current.id) ?? current : data.visits[0] ?? null);
    } catch (error) {
      setVisitsError(error instanceof Error ? error.message : "Could not load visitors.");
    } finally {
      setVisitsLoading(false);
    }
  }, [visitorSearch, visitorStatusFilter]);

  useEffect(() => {
    void loadDashboard();
    void loadPassOuts();
  }, [loadDashboard, loadPassOuts]);

  useEffect(() => {
    void loadVisitors();
  }, [loadVisitors]);

  useEffect(() => {
    const query = passOutSearch.trim();
    if (query.length < 2 || passOutSelectedStudent?.studentName === passOutSearch.trim()) {
      setPassOutStudentResults([]);
      setPassOutStudentSearching(false);
      return;
    }

    let cancelled = false;
    setPassOutStudentSearching(true);
    const timeout = window.setTimeout(() => {
      void searchStudentPassOutCandidates({ search: query })
        .then((result) => {
          if (!cancelled) {
            setPassOutStudentResults(result.students);
          }
        })
        .catch((error) => {
          if (!cancelled) {
            setPassOutError(error instanceof Error ? error.message : "Could not search students.");
            setPassOutStudentResults([]);
          }
        })
        .finally(() => {
          if (!cancelled) {
            setPassOutStudentSearching(false);
          }
        });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [passOutSearch, passOutSelectedStudent]);

  const visiblePassOuts = useMemo(
    () => passOuts.filter((passOut) => isPassOutVisible(passOut, passOutStatusFilter)),
    [passOutStatusFilter, passOuts],
  );

  async function handleCreatePassOut() {
    if (!passOutSelectedStudent) {
      setPassOutError("Select a student before approving a pass-out.");
      return;
    }
    setPassOutSubmitting(true);
    setPassOutError(null);
    setPassOutSuccess(null);
    try {
      await createStudentPassOut({
        studentId: passOutSelectedStudent.id,
        reason: passOutReason,
        activeFrom: new Date(passOutActiveFrom).toISOString(),
        activeUntil: new Date(passOutActiveUntil).toISOString(),
      });
      setPassOutSuccess(`Pass-out approved for ${passOutSelectedStudent.studentName}.`);
      setPassOutSearch("");
      setPassOutSelectedStudent(null);
      setPassOutStudentResults([]);
      setPassOutReason("");
      setPassOutActiveFrom("");
      setPassOutActiveUntil("");
      await Promise.all([loadPassOuts(), loadDashboard()]);
    } catch (error) {
      setPassOutError(error instanceof Error ? error.message : "Could not approve pass-out.");
    } finally {
      setPassOutSubmitting(false);
    }
  }

  async function handleCancelPassOut() {
    if (!passOutCancelTarget) return;
    setPassOutCancelling(true);
    setPassOutError(null);
    setPassOutSuccess(null);
    try {
      await cancelStudentPassOut(passOutCancelTarget.id, passOutCancelReason.trim());
      setPassOutSuccess(`Pass-out cancelled for ${passOutCancelTarget.student.studentName}.`);
      setPassOutCancelTarget(null);
      setPassOutCancelReason("");
      await Promise.all([loadPassOuts(), loadDashboard()]);
    } catch (error) {
      setPassOutError(error instanceof Error ? error.message : "Could not cancel pass-out.");
    } finally {
      setPassOutCancelling(false);
    }
  }

  async function handleSelectVisit(visitId: string) {
    setSelectedVisitLoading(true);
    setSelectedVisitError(null);
    try {
      const result = await fetchNfcVisitorDetail(visitId);
      setSelectedVisit(result.visit);
    } catch (error) {
      setSelectedVisitError(error instanceof Error ? error.message : "Could not load visitor details.");
    } finally {
      setSelectedVisitLoading(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-[1540px] flex-col gap-3 px-4 py-4 sm:px-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">NFC</p>
            <h1 className="mt-1 text-2xl font-black text-slate-950">Gate Operations</h1>
            <p className="mt-1 max-w-3xl text-sm text-slate-500">
              Manage approved student pass-outs, review visitor records, and monitor recent gate activity without crowding the kiosk scan screen.
            </p>
          </div>
          <NfcSectionTabs
            tabs={[
              { to: "/nfc/gate", label: "Security Scan" },
              { to: "/nfc/gate-admin", label: "Gate Operations" },
              { to: "/nfc/fee-holds", label: "Fee Holds" },
            ]}
          />
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {[
            { key: "PASS_OUTS", label: "Student Pass-outs" },
            { key: "VISITORS", label: "Visitors" },
            { key: "ACTIVITY", label: "Gate Activity" },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key as GateTab)}
              className={`rounded-full px-3 py-2 text-sm font-black ${activeTab === tab.key ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "PASS_OUTS" ? (
        <div className="grid gap-3 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-black text-slate-950">Approve pass-out</h2>
                <p className="mt-1 text-sm text-slate-500">Create gate-ready pass-outs for active students with a clear time window and reason.</p>
              </div>
              <button type="button" className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600" onClick={() => void loadPassOuts()} disabled={passOutLoading}>
                {passOutLoading ? "Refreshing..." : "Refresh"}
              </button>
            </div>
            {passOutError ? <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{passOutError}</p> : null}
            {passOutSuccess ? <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{passOutSuccess}</p> : null}
            <div className="mt-4 grid gap-3">
              <div className="relative">
                <label className="grid gap-1 text-xs font-bold uppercase tracking-wide text-slate-500">
                  Student search
                  <input
                    className="premium-control"
                    value={passOutSearch}
                    onChange={(event) => {
                      setPassOutSearch(event.target.value);
                      setPassOutSelectedStudent(null);
                    }}
                    placeholder="Search by student name or admission number"
                  />
                </label>
                {passOutStudentSearching ? <p className="mt-1 text-xs text-slate-400">Searching...</p> : null}
                {!passOutStudentSearching && passOutStudentResults.length > 0 ? (
                  <div className="mt-2 max-h-44 overflow-y-auto rounded-xl border border-slate-200 bg-white">
                    {passOutStudentResults.map((student) => (
                      <button
                        key={student.id}
                        type="button"
                        className="block w-full border-b border-slate-100 px-3 py-2 text-left text-sm last:border-b-0 hover:bg-blue-50"
                        onClick={() => {
                          setPassOutSelectedStudent(student);
                          setPassOutSearch(student.studentName);
                          setPassOutStudentResults([]);
                        }}
                      >
                        <p className="font-bold text-slate-900">{student.studentName}</p>
                        <p className="text-xs text-slate-500">{student.admissionNumber} • {student.className ?? "No class"} / {student.streamName ?? "No stream"}</p>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              {passOutSelectedStudent ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm">
                  <p className="font-bold text-emerald-800">{passOutSelectedStudent.studentName}</p>
                  <p className="text-emerald-700">{passOutSelectedStudent.admissionNumber} • {passOutSelectedStudent.className ?? "No class"} / {passOutSelectedStudent.streamName ?? "No stream"}</p>
                </div>
              ) : null}

              <label className="grid gap-1 text-xs font-bold uppercase tracking-wide text-slate-500">
                Reason
                <textarea className="premium-control min-h-[96px] resize-y" value={passOutReason} onChange={(event) => setPassOutReason(event.target.value)} placeholder="Parent-approved reason for leaving campus" />
              </label>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="grid gap-1 text-xs font-bold uppercase tracking-wide text-slate-500">
                  Active from
                  <input type="datetime-local" className="premium-control" value={passOutActiveFrom} onChange={(event) => setPassOutActiveFrom(event.target.value)} />
                </label>
                <label className="grid gap-1 text-xs font-bold uppercase tracking-wide text-slate-500">
                  Active until
                  <input type="datetime-local" className="premium-control" value={passOutActiveUntil} onChange={(event) => setPassOutActiveUntil(event.target.value)} />
                </label>
              </div>
              <button type="button" className="btn btn-primary min-h-[40px] rounded-xl px-4 py-2 text-sm font-black" disabled={passOutSubmitting} onClick={() => { void handleCreatePassOut(); }}>
                {passOutSubmitting ? "Approving..." : "Approve pass-out"}
              </button>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-black text-slate-950">Student pass-outs</h2>
                <p className="mt-1 text-sm text-slate-500">Review active and recent pass-outs without mixing them into wristband management.</p>
              </div>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600">{visiblePassOuts.length} shown</span>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {(["ALL", "CHECKED_OUT", "RETURNED", "CANCELLED"] as PassOutStatusFilter[]).map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setPassOutStatusFilter(filter)}
                  className={`min-h-[30px] rounded-full border px-2.5 py-1 text-[11px] font-black ${passOutStatusFilter === filter ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-600"}`}
                >
                  {PASS_OUT_FILTER_LABELS[filter]}
                </button>
              ))}
            </div>
            <div className="mt-4 grid gap-2">
              {passOutLoading && visiblePassOuts.length === 0 ? (
                <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">Loading pass-outs...</p>
              ) : visiblePassOuts.length === 0 ? (
                <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">No pass-outs match this filter.</p>
              ) : (
                visiblePassOuts.map((passOut) => (
                  <div key={passOut.id} className="rounded-xl border border-slate-200 bg-white p-3 text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-bold text-slate-900">{passOut.student.studentName}</p>
                        <p className="text-slate-600">{passOut.student.admissionNumber} • {passOut.reason}</p>
                        <p className="text-xs text-slate-500">Active window: {formatDateTime(passOut.activeFrom)} to {formatDateTime(passOut.activeUntil)}</p>
                      </div>
                      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-blue-700">{passOut.status}</span>
                    </div>
                    {passOut.status === "APPROVED" || passOut.status === "CHECKED_OUT" ? (
                      <button
                        type="button"
                        className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700"
                        onClick={() => {
                          setPassOutCancelTarget(passOut);
                          setPassOutCancelReason("");
                        }}
                      >
                        Cancel pass-out
                      </button>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      ) : null}

      {activeTab === "VISITORS" ? (
        <div className="grid gap-3 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-black text-slate-950">Visitor records</h2>
                <p className="mt-1 text-sm text-slate-500">Review current and historical visitors with clearer search, filters, and detail handoff.</p>
              </div>
              <button type="button" className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600" onClick={() => void loadVisitors()} disabled={visitsLoading}>
                {visitsLoading ? "Refreshing..." : "Refresh"}
              </button>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {(["CURRENT", "HISTORY", "ALL"] as VisitorFilter[]).map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setVisitorStatusFilter(status)}
                  className={`min-h-[30px] rounded-full border px-2.5 py-1 text-[11px] font-black ${visitorStatusFilter === status ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-600"}`}
                >
                  {status === "CURRENT" ? "Current" : status === "HISTORY" ? "History" : "All"}
                </button>
              ))}
              <input className="premium-control min-w-[220px] flex-1" value={visitorSearch} onChange={(event) => setVisitorSearch(event.target.value)} placeholder="Search visitor, host, or ID number" />
            </div>
            {visitsError ? <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{visitsError}</p> : null}
            <div className="mt-4 grid gap-2">
              {visitsLoading && visits.length === 0 ? (
                <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">Loading visitor records...</p>
              ) : visits.length === 0 ? (
                <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">No visitor records match this filter.</p>
              ) : (
                visits.map((visit) => (
                  <button key={visit.id} type="button" className="rounded-xl border border-slate-200 bg-white p-3 text-left text-sm hover:border-blue-200 hover:bg-blue-50/40" onClick={() => { void handleSelectVisit(visit.id); }}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-bold text-slate-900">{visit.visitor.fullName}</p>
                        <p className="text-slate-600">{visit.purpose}</p>
                        <p className="text-xs text-slate-500">Host: {visit.hostName}</p>
                      </div>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${visit.status === "CHECKED_IN" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-700"}`}>
                        {visit.status === "CHECKED_IN" ? "Current" : "Checked out"}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">Checked in: {formatDateTime(visit.checkedInAt)}</p>
                  </button>
                ))
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm xl:pb-20">
            <h2 className="text-lg font-black text-slate-950">Visitor details</h2>
            <p className="mt-1 text-sm text-slate-500">Admin view only. Gate staff handle registration and checkout elsewhere.</p>
            {selectedVisitError ? <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{selectedVisitError}</p> : null}
            {selectedVisitLoading ? (
              <p className="mt-4 text-sm text-slate-500">Loading visitor details...</p>
            ) : selectedVisit ? (
              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Profile</p>
                  <p className="mt-2 font-bold text-slate-900">{selectedVisit.visitor.fullName}</p>
                  <p className="mt-1 text-slate-600">Phone: {selectedVisit.visitor.phone ?? "Not provided"}</p>
                  <p className="mt-1 text-slate-600">{selectedVisit.visitor.idDocumentType}: {selectedVisit.visitor.idDocumentNumber}</p>
                  <p className="mt-1 text-slate-600">Purpose: {selectedVisit.purpose}</p>
                  <p className="mt-1 text-slate-600">Host: {selectedVisit.hostName}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Timing</p>
                  <p className="mt-2 text-slate-600">Checked in: {formatDateTime(selectedVisit.checkedInAt)}</p>
                  <p className="mt-1 text-slate-600">Checked out: {formatDateTime(selectedVisit.checkedOutAt)}</p>
                  <p className="mt-1 text-slate-600">Status: {selectedVisit.status === "CHECKED_IN" ? "Currently inside" : "Visit complete"}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Selfie</p>
                  {selectedVisit.selfieImageUrl ? <a className="mt-2 inline-flex text-sm font-bold text-blue-700 hover:underline" href={selectedVisit.selfieImageUrl} target="_blank" rel="noreferrer">Open selfie image</a> : <p className="mt-2 text-slate-500">Selfie image unavailable</p>}
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">ID / Passport</p>
                  {selectedVisit.idDocumentImageUrl ? <a className="mt-2 inline-flex text-sm font-bold text-blue-700 hover:underline" href={selectedVisit.idDocumentImageUrl} target="_blank" rel="noreferrer">Open ID/passport image</a> : <p className="mt-2 text-slate-500">ID/passport image unavailable</p>}
                </div>
              </div>
            ) : (
              <p className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">Select a visitor record to inspect uploaded identity evidence and visit details.</p>
            )}
          </section>
        </div>
      ) : null}

      {activeTab === "ACTIVITY" ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-slate-950">Gate activity</h2>
              <p className="mt-1 text-sm text-slate-500">Recent entries, exits, pass-out movements, blocked attempts, and visitor check-ins or check-outs.</p>
            </div>
            <button type="button" className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600" onClick={() => void loadDashboard()} disabled={dashboardLoading}>
              {dashboardLoading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
          {dashboardError ? <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{dashboardError}</p> : null}
          <div className="mt-4 grid gap-2">
            {dashboardLoading && !dashboard?.activity.length ? (
              <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">Loading gate activity...</p>
            ) : dashboard?.activity.length ? (
              dashboard.activity.map((item) => (
                <div key={item.id} className="rounded-xl border border-slate-200 bg-white p-3 text-sm">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-black uppercase tracking-wide ${getActivityTone(item.type)}`}>
                        {item.type.replaceAll("_", " ")}
                      </div>
                      <p className="mt-2 font-bold text-slate-900">{item.summary}</p>
                      {item.detail ? <p className="mt-1 text-slate-600">{item.detail}</p> : null}
                      {item.student ? <p className="mt-1 text-xs text-slate-500">{item.student.admissionNumber} • {item.student.className ?? "No class"} / {item.student.streamName ?? "No stream"}</p> : null}
                      {item.visitor ? <p className="mt-1 text-xs text-slate-500">{item.visitor.phone ?? "No phone on file"}</p> : null}
                    </div>
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{formatDateTime(item.occurredAt)}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">No gate activity recorded yet.</p>
            )}
          </div>
        </section>
      ) : null}

      {passOutCancelTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <h2 className="text-lg font-black text-slate-950">Cancel pass-out</h2>
            <p className="mt-2 text-sm text-slate-500">
              Cancel the current pass-out for <span className="font-bold text-slate-800">{passOutCancelTarget.student.studentName}</span> before it is used again at the gate.
            </p>
            <label className="mt-4 grid gap-1 text-xs font-bold uppercase tracking-wide text-slate-500">
              Cancellation reason
              <textarea className="premium-control min-h-[92px] resize-y" value={passOutCancelReason} onChange={(event) => setPassOutCancelReason(event.target.value)} placeholder="Why should this pass-out be cancelled?" />
            </label>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button type="button" className="btn rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600" onClick={() => setPassOutCancelTarget(null)}>
                Keep pass-out
              </button>
              <button type="button" className="btn rounded-xl bg-red-600 px-4 py-2 text-sm font-black text-white disabled:opacity-60" onClick={() => { void handleCancelPassOut(); }} disabled={passOutCancelling}>
                {passOutCancelling ? "Cancelling..." : "Cancel pass-out"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
