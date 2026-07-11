import { useEffect, useState } from "react";
import { fetchNfcPolicy, updateNfcPolicy } from "../client/studentCredentialsClient";

const inputClass = "premium-control h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none focus:border-blue-400 focus:bg-white";
const selectClass = inputClass;

export function NfcSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({
    feeDefaulterBlockingEnabled: false,
    feeDefaulterBlockScope: "DAY_SCHOLARS_ONLY" as const,
    attendanceTapInCutoffEnabled: false,
    tapInCutoffTime: "08:00",
    cutoffLateAction: "BLOCK_AND_MARK_ABSENT" as const,
    timezone: "Africa/Kampala",
    duplicateWindowSeconds: 60,
    gateArrivalStart: "05:30",
    gateArrivalLateAfter: "08:00",
    gateArrivalEnd: "10:00",
    morningClassroomStart: "06:30",
    morningClassroomEnd: "10:00",
    gateDepartureStart: "14:00",
    gateDepartureEnd: "19:00",
    nightPrepStart: "18:30",
    nightPrepEnd: "22:30",
    nightPrepBoardingOnly: true,
    allowAutomaticCheckout: false,
    recordUnclassifiedScans: true,
    feeGatePolicyEnabled: false,
    gateOfflineEnabled: true,
    canteenOfflineEnabled: true,
    gateSnapshotValidHours: 24,
    canteenSnapshotValidHours: 24,
    maxOfflineSpendPerStudentPerDay: 5000,
    maxOfflineSpendPerTransaction: 2000,
    maxOfflineSpendPerDeviceSession: 100000,
    unknownCardOfflinePolicy: "DENY" as const,
    frozenCardOfflinePolicy: "DENY" as const,
    deactivatedCardOfflinePolicy: "DENY" as const,
    offlineConflictPolicy: "ALLOW_AND_FLAG" as const,
  });

  useEffect(() => {
    fetchNfcPolicy()
      .then(({ policy }) => {
        setForm({
          feeDefaulterBlockingEnabled: policy.feeDefaulterBlockingEnabled,
          feeDefaulterBlockScope: policy.feeDefaulterBlockScope,
          attendanceTapInCutoffEnabled: policy.attendanceTapInCutoffEnabled,
          tapInCutoffTime: policy.tapInCutoffTime ?? "08:00",
          cutoffLateAction: policy.cutoffLateAction,
          timezone: policy.timezone || "Africa/Kampala",
          duplicateWindowSeconds: policy.duplicateWindowSeconds,
          gateArrivalStart: policy.gateArrivalStart,
          gateArrivalLateAfter: policy.gateArrivalLateAfter,
          gateArrivalEnd: policy.gateArrivalEnd,
          morningClassroomStart: policy.morningClassroomStart,
          morningClassroomEnd: policy.morningClassroomEnd,
          gateDepartureStart: policy.gateDepartureStart,
          gateDepartureEnd: policy.gateDepartureEnd,
          nightPrepStart: policy.nightPrepStart,
          nightPrepEnd: policy.nightPrepEnd,
          nightPrepBoardingOnly: policy.nightPrepBoardingOnly,
          allowAutomaticCheckout: policy.allowAutomaticCheckout,
          recordUnclassifiedScans: policy.recordUnclassifiedScans,
          feeGatePolicyEnabled: policy.feeGatePolicyEnabled,
          gateOfflineEnabled: policy.gateOfflineEnabled,
          canteenOfflineEnabled: policy.canteenOfflineEnabled,
          gateSnapshotValidHours: policy.gateSnapshotValidHours,
          canteenSnapshotValidHours: policy.canteenSnapshotValidHours,
          maxOfflineSpendPerStudentPerDay: policy.maxOfflineSpendPerStudentPerDay,
          maxOfflineSpendPerTransaction: policy.maxOfflineSpendPerTransaction,
          maxOfflineSpendPerDeviceSession: policy.maxOfflineSpendPerDeviceSession,
          unknownCardOfflinePolicy: policy.unknownCardOfflinePolicy as "DENY",
          frozenCardOfflinePolicy: policy.frozenCardOfflinePolicy as "DENY",
          deactivatedCardOfflinePolicy: policy.deactivatedCardOfflinePolicy as "DENY",
          offlineConflictPolicy: policy.offlineConflictPolicy as "ALLOW_AND_FLAG" | "HOLD_FOR_BURSAR_REVIEW",
        });
      })
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Could not load NFC settings."))
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      await updateNfcPolicy({
        ...form,
        tapInCutoffTime: form.attendanceTapInCutoffEnabled ? form.tapInCutoffTime : null,
      });
      setSaved(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save NFC settings.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <main className="grid gap-4"><div className="premium-card rounded-xl p-5 text-sm text-slate-600">Loading NFC settings...</div></main>;
  }

  return (
    <main className="grid gap-5">
      <header className="page-header">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-600">NFC Operations</p>
        <h1 className="text-xl font-bold text-slate-950 sm:text-2xl">NFC Settings</h1>
        <p className="mt-1 text-sm text-slate-500">Control fee-defaulter blocking and attendance tap-in cut-off for this school.</p>
      </header>

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
      {saved ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">Saved successfully.</div> : null}

      <section className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <h2 className="text-sm font-bold text-slate-950">Location attendance windows</h2>
          <label className="grid gap-1 text-xs font-bold uppercase text-slate-500">
            Duplicate window (seconds)
            <input className={inputClass} type="number" min="15" max="600" value={form.duplicateWindowSeconds} onChange={(event) => setForm((current) => ({ ...current, duplicateWindowSeconds: Number(event.target.value) }))} />
          </label>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="grid gap-1 text-xs font-bold uppercase text-slate-500">
              Gate arrival start
              <input className={inputClass} type="time" value={form.gateArrivalStart} onChange={(event) => setForm((current) => ({ ...current, gateArrivalStart: event.target.value }))} />
            </label>
            <label className="grid gap-1 text-xs font-bold uppercase text-slate-500">
              Gate late after
              <input className={inputClass} type="time" value={form.gateArrivalLateAfter} onChange={(event) => setForm((current) => ({ ...current, gateArrivalLateAfter: event.target.value }))} />
            </label>
            <label className="grid gap-1 text-xs font-bold uppercase text-slate-500">
              Gate arrival end
              <input className={inputClass} type="time" value={form.gateArrivalEnd} onChange={(event) => setForm((current) => ({ ...current, gateArrivalEnd: event.target.value }))} />
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-xs font-bold uppercase text-slate-500">
              Morning classroom start
              <input className={inputClass} type="time" value={form.morningClassroomStart} onChange={(event) => setForm((current) => ({ ...current, morningClassroomStart: event.target.value }))} />
            </label>
            <label className="grid gap-1 text-xs font-bold uppercase text-slate-500">
              Morning classroom end
              <input className={inputClass} type="time" value={form.morningClassroomEnd} onChange={(event) => setForm((current) => ({ ...current, morningClassroomEnd: event.target.value }))} />
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-xs font-bold uppercase text-slate-500">
              Gate departure start
              <input className={inputClass} type="time" value={form.gateDepartureStart} onChange={(event) => setForm((current) => ({ ...current, gateDepartureStart: event.target.value }))} />
            </label>
            <label className="grid gap-1 text-xs font-bold uppercase text-slate-500">
              Gate departure end
              <input className={inputClass} type="time" value={form.gateDepartureEnd} onChange={(event) => setForm((current) => ({ ...current, gateDepartureEnd: event.target.value }))} />
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-xs font-bold uppercase text-slate-500">
              Night prep start
              <input className={inputClass} type="time" value={form.nightPrepStart} onChange={(event) => setForm((current) => ({ ...current, nightPrepStart: event.target.value }))} />
            </label>
            <label className="grid gap-1 text-xs font-bold uppercase text-slate-500">
              Night prep end
              <input className={inputClass} type="time" value={form.nightPrepEnd} onChange={(event) => setForm((current) => ({ ...current, nightPrepEnd: event.target.value }))} />
            </label>
          </div>
          <label className="grid gap-1 text-xs font-bold uppercase text-slate-500">
            Night prep boarding only
            <select className={selectClass} value={form.nightPrepBoardingOnly ? "yes" : "no"} onChange={(event) => setForm((current) => ({ ...current, nightPrepBoardingOnly: event.target.value === "yes" }))}>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </label>
          <label className="grid gap-1 text-xs font-bold uppercase text-slate-500">
            Record unclassified scans
            <select className={selectClass} value={form.recordUnclassifiedScans ? "yes" : "no"} onChange={(event) => setForm((current) => ({ ...current, recordUnclassifiedScans: event.target.value === "yes" }))}>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </label>
          <label className="grid gap-1 text-xs font-bold uppercase text-slate-500">
            Automatic checkout
            <select className={selectClass} value={form.allowAutomaticCheckout ? "yes" : "no"} onChange={(event) => setForm((current) => ({ ...current, allowAutomaticCheckout: event.target.value === "yes" }))}>
              <option value="no">Disabled</option>
              <option value="yes">Enabled</option>
            </select>
          </label>
          <label className="grid gap-1 text-xs font-bold uppercase text-slate-500">
            Gate fee restriction workflow
            <select className={selectClass} value={form.feeGatePolicyEnabled ? "yes" : "no"} onChange={(event) => setForm((current) => ({ ...current, feeGatePolicyEnabled: event.target.value === "yes" }))}>
              <option value="no">Disabled</option>
              <option value="yes">Enabled</option>
            </select>
          </label>
        </div>

        <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <h2 className="text-sm font-bold text-slate-950">Offline NFC policy</h2>
          <label className="grid gap-1 text-xs font-bold uppercase text-slate-500">
            Enable gate offline
            <select className={selectClass} value={form.gateOfflineEnabled ? "yes" : "no"} onChange={(event) => setForm((current) => ({ ...current, gateOfflineEnabled: event.target.value === "yes" }))}>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </label>
          <label className="grid gap-1 text-xs font-bold uppercase text-slate-500">
            Enable canteen offline
            <select className={selectClass} value={form.canteenOfflineEnabled ? "yes" : "no"} onChange={(event) => setForm((current) => ({ ...current, canteenOfflineEnabled: event.target.value === "yes" }))}>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </label>
          <label className="grid gap-1 text-xs font-bold uppercase text-slate-500">
            Gate snapshot valid hours
            <input className={inputClass} type="number" min="1" value={form.gateSnapshotValidHours} onChange={(event) => setForm((current) => ({ ...current, gateSnapshotValidHours: Number(event.target.value) }))} />
          </label>
          <label className="grid gap-1 text-xs font-bold uppercase text-slate-500">
            Canteen snapshot valid hours
            <input className={inputClass} type="number" min="1" value={form.canteenSnapshotValidHours} onChange={(event) => setForm((current) => ({ ...current, canteenSnapshotValidHours: Number(event.target.value) }))} />
          </label>
          <label className="grid gap-1 text-xs font-bold uppercase text-slate-500">
            Max offline spend per student per day (UGX)
            <input className={inputClass} type="number" min="0" value={form.maxOfflineSpendPerStudentPerDay} onChange={(event) => setForm((current) => ({ ...current, maxOfflineSpendPerStudentPerDay: Number(event.target.value) }))} />
          </label>
          <label className="grid gap-1 text-xs font-bold uppercase text-slate-500">
            Max offline spend per transaction (UGX)
            <input className={inputClass} type="number" min="0" value={form.maxOfflineSpendPerTransaction} onChange={(event) => setForm((current) => ({ ...current, maxOfflineSpendPerTransaction: Number(event.target.value) }))} />
          </label>
          <label className="grid gap-1 text-xs font-bold uppercase text-slate-500">
            Max offline spend per device session (UGX)
            <input className={inputClass} type="number" min="0" value={form.maxOfflineSpendPerDeviceSession} onChange={(event) => setForm((current) => ({ ...current, maxOfflineSpendPerDeviceSession: Number(event.target.value) }))} />
          </label>
        </div>

        <label className="grid gap-1 text-xs font-black uppercase text-slate-500">
          Enable fee defaulter blocking
          <select
            className={selectClass}
            value={form.feeDefaulterBlockingEnabled ? "yes" : "no"}
            onChange={(event) => setForm((current) => ({ ...current, feeDefaulterBlockingEnabled: event.target.value === "yes" }))}
          >
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </label>

        <label className="grid gap-1 text-xs font-black uppercase text-slate-500">
          Apply to
          <select
            className={selectClass}
            value={form.feeDefaulterBlockScope}
            onChange={(event) => setForm((current) => ({ ...current, feeDefaulterBlockScope: event.target.value as typeof form.feeDefaulterBlockScope }))}
          >
            <option value="DAY_SCHOLARS_ONLY">Day scholars only</option>
            <option value="ALL_STUDENTS">All students</option>
          </select>
        </label>

        <label className="grid gap-1 text-xs font-black uppercase text-slate-500">
          Enable attendance tap-in cut-off
          <select
            className={selectClass}
            value={form.attendanceTapInCutoffEnabled ? "yes" : "no"}
            onChange={(event) => setForm((current) => ({ ...current, attendanceTapInCutoffEnabled: event.target.value === "yes" }))}
          >
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </label>

        <label className="grid gap-1 text-xs font-black uppercase text-slate-500">
          Tap-in cut-off time
          <input
            className={inputClass}
            type="time"
            value={form.tapInCutoffTime}
            onChange={(event) => setForm((current) => ({ ...current, tapInCutoffTime: event.target.value }))}
            disabled={!form.attendanceTapInCutoffEnabled}
          />
        </label>

        <label className="grid gap-1 text-xs font-black uppercase text-slate-500">
          Late action
          <select
            className={selectClass}
            value={form.cutoffLateAction}
            onChange={(event) => setForm((current) => ({ ...current, cutoffLateAction: event.target.value as typeof form.cutoffLateAction }))}
          >
            <option value="BLOCK_AND_MARK_ABSENT">Block and mark absent</option>
            <option value="ALLOW_BUT_MARK_LATE">Allow but mark late</option>
          </select>
        </label>

        <label className="grid gap-1 text-xs font-black uppercase text-slate-500">
          School timezone
          <input
            className={inputClass}
            value={form.timezone}
            onChange={(event) => setForm((current) => ({ ...current, timezone: event.target.value }))}
          />
        </label>

        <button
          type="button"
          className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60"
          onClick={() => void save()}
          disabled={saving}
        >
          {saving ? "Saving..." : "Save NFC Policy"}
        </button>
      </section>
    </main>
  );
}
