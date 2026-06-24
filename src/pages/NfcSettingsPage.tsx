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
