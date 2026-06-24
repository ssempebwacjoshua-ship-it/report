import { useEffect, useMemo, useState } from "react";
import { fetchAttendanceClasses, fetchNfcFeeHolds, createNfcFeeHold, clearNfcFeeHold, searchNfcFeeHoldStudents } from "../client/studentCredentialsClient";
import type { NfcFeeHold, NfcFeeHoldListResponse } from "../shared/types/studentCredentials";

const inputClass = "premium-control h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none focus:border-blue-400 focus:bg-white";
const selectClass = inputClass;

function money(cents: number | null) {
  if (cents == null) return "—";
  return `UGX ${Math.round(cents / 100).toLocaleString()}`;
}

function holdStudentLabel(student: NfcFeeHold["student"]) {
  return `${student.name} · ${student.admissionNumber}`;
}

export function NfcFeeHoldsPage() {
  const [search, setSearch] = useState("");
  const [classId, setClassId] = useState("");
  const [streamId, setStreamId] = useState("");
  const [studentType, setStudentType] = useState("ALL");
  const [status, setStatus] = useState("ACTIVE");
  const [students, setStudents] = useState<Array<{ id: string; studentName: string; admissionNumber: string; className: string | null; streamName: string | null; studentType: "DAY" | "BOARDING" | null; isActive: boolean }>>([]);
  const [classes, setClasses] = useState<Array<{ id: string; name: string; streams: Array<{ id: string; name: string }> }>>([]);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [reason, setReason] = useState("");
  const [balanceDue, setBalanceDue] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().slice(0, 10));
  const [data, setData] = useState<NfcFeeHoldListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");

  const selectedClass = useMemo(() => classes.find((item) => item.id === classId) ?? null, [classes, classId]);

  useEffect(() => {
    fetchAttendanceClasses().then(({ classes: loaded }) => setClasses(loaded)).catch(() => setClasses([]));
  }, []);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [holds, studentResults] = await Promise.all([
        fetchNfcFeeHolds({
          search: search || undefined,
          classId: classId || undefined,
          streamId: streamId || undefined,
          studentType,
          status,
        }),
        searchNfcFeeHoldStudents({ search: search || undefined, classId: classId || undefined, streamId: streamId || undefined, studentType }),
      ]);
      setData(holds);
      setStudents(studentResults.students);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load fee holds.");
      setData(null);
      setStudents([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [search, classId, streamId, studentType, status]);

  async function createHold() {
    if (!selectedStudentId) return;
    setSaving(true);
    setActionError("");
    try {
      await createNfcFeeHold({
        studentId: selectedStudentId,
        reason: reason.trim() || null,
        balanceDueCents: balanceDue ? Math.round(Number(balanceDue) * 100) : null,
        effectiveFrom: effectiveFrom ? `${effectiveFrom}T00:00:00.000Z` : null,
      });
      setSelectedStudentId("");
      setReason("");
      setBalanceDue("");
      await load();
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Could not create fee hold.");
    } finally {
      setSaving(false);
    }
  }

  async function clearHold(hold: NfcFeeHold) {
    setSaving(true);
    setActionError("");
    try {
      await clearNfcFeeHold(hold.id, reason.trim() || null);
      await load();
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Could not clear fee hold.");
    } finally {
      setSaving(false);
    }
  }

  const activeHoldCount = data?.feeHolds.filter((hold) => hold.status === "ACTIVE").length ?? 0;

  return (
    <main className="grid gap-5">
      <header className="page-header">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-600">NFC Operations</p>
        <h1 className="text-xl font-bold text-slate-950 sm:text-2xl">Fee Holds</h1>
        <p className="mt-1 text-sm text-slate-500">Mark fee defaulters, clear holds, and keep the blocking reason visible to gate and attendance staff.</p>
      </header>

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
      {actionError ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">{actionError}</div> : null}

      <section className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:grid-cols-5">
        <label className="grid gap-1 text-xs font-black uppercase text-slate-500">
          Search
          <input className={inputClass} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Student name or admission #" />
        </label>
        <label className="grid gap-1 text-xs font-black uppercase text-slate-500">
          Class
          <select className={selectClass} value={classId} onChange={(event) => { setClassId(event.target.value); setStreamId(""); }}>
            <option value="">All classes</option>
            {classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-black uppercase text-slate-500">
          Stream
          <select className={selectClass} value={streamId} onChange={(event) => setStreamId(event.target.value)}>
            <option value="">All streams</option>
            {selectedClass?.streams.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-black uppercase text-slate-500">
          Student type
          <select className={selectClass} value={studentType} onChange={(event) => setStudentType(event.target.value)}>
            <option value="ALL">All</option>
            <option value="DAY">Day</option>
            <option value="BOARDING">Boarding</option>
          </select>
        </label>
        <label className="grid gap-1 text-xs font-black uppercase text-slate-500">
          Hold status
          <select className={selectClass} value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="ACTIVE">Active</option>
            <option value="CLEARED">Cleared</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="ALL">All</option>
          </select>
        </label>
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-black uppercase text-slate-500">Active holds</p>
              <p className="mt-1 text-2xl font-black text-slate-950">{activeHoldCount}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-black uppercase text-slate-500">Students found</p>
              <p className="mt-1 text-2xl font-black text-slate-950">{students.length}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-black uppercase text-slate-500">School policy</p>
              <p className="mt-1 text-sm font-bold text-slate-700">{data?.policy.feeDefaulterBlockingEnabled ? "Blocking enabled" : "Blocking off"}</p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-base font-black text-slate-950">Search results</h2>
              <button type="button" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50" onClick={() => void load()}>
                Refresh
              </button>
            </div>
            {loading ? (
              <p className="text-sm text-slate-500">Loading fee holds...</p>
            ) : students.length === 0 ? (
              <p className="text-sm text-slate-500">Search for a student to create a fee hold.</p>
            ) : (
              <div className="grid gap-2">
                {students.map((student) => (
                  <button
                    key={student.id}
                    type="button"
                    className={`rounded-xl border px-3 py-3 text-left ${selectedStudentId === student.id ? "border-blue-300 bg-blue-50" : "border-slate-200 bg-slate-50"}`}
                    onClick={() => setSelectedStudentId(student.id)}
                  >
                    <p className="text-sm font-bold text-slate-950">{student.studentName}</p>
                    <p className="text-xs text-slate-500">{student.admissionNumber} · {student.className || "No class"} / {student.streamName || "No stream"}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-base font-black text-slate-950">Fee hold history</h2>
            <div className="mt-3 grid gap-3">
              {loading ? (
                <p className="text-sm text-slate-500">Loading...</p>
              ) : (data?.feeHolds ?? []).length === 0 ? (
                <p className="text-sm text-slate-500">No fee holds found for the selected filters.</p>
              ) : (
                (data?.feeHolds ?? []).map((hold) => (
                  <div key={hold.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-bold text-slate-950">{holdStudentLabel(hold.student)}</p>
                        <p className="text-xs text-slate-500">{hold.student.studentType ?? "Unknown"} · {hold.student.className ?? "No class"}{hold.student.streamName ? ` / ${hold.student.streamName}` : ""}</p>
                      </div>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-black ${hold.status === "ACTIVE" ? "bg-red-100 text-red-700" : "bg-slate-200 text-slate-700"}`}>{hold.status}</span>
                    </div>
                    <p className="mt-2 text-sm text-slate-700">{hold.reason ?? "No reason provided"}</p>
                    <p className="mt-1 text-xs text-slate-500">Balance due: {money(hold.balanceDueCents)} · Created {new Date(hold.createdAt).toLocaleString()}</p>
                    {hold.status === "ACTIVE" ? (
                      <button
                        type="button"
                        className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
                        onClick={() => void clearHold(hold)}
                        disabled={saving}
                      >
                        Clear fee hold
                      </button>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <aside className="grid gap-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-base font-black text-slate-950">Create fee hold</h2>
            <div className="mt-3 grid gap-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
                {selectedStudentId
                  ? students.find((item) => item.id === selectedStudentId)?.studentName
                  : "Select a student from the search results."}
              </div>
              <label className="grid gap-1 text-xs font-black uppercase text-slate-500">
                Reason
                <textarea className="min-h-24 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:bg-white" value={reason} onChange={(event) => setReason(event.target.value)} />
              </label>
              <label className="grid gap-1 text-xs font-black uppercase text-slate-500">
                Balance due UGX
                <input className={inputClass} value={balanceDue} onChange={(event) => setBalanceDue(event.target.value)} inputMode="decimal" />
              </label>
              <label className="grid gap-1 text-xs font-black uppercase text-slate-500">
                Effective from
                <input className={inputClass} type="date" value={effectiveFrom} onChange={(event) => setEffectiveFrom(event.target.value)} />
              </label>
              <button
                type="button"
                className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60"
                onClick={() => void createHold()}
                disabled={!selectedStudentId || saving}
              >
                {saving ? "Saving..." : "Add fee hold"}
              </button>
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}
