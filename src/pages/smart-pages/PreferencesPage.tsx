import { useEffect, useState } from "react";
import { listPreferences, savePreference, type CreatorPreference } from "../../client/documentOsClient";

const DEFAULT_KEYS = ["primaryColor", "language", "tone", "preferredLayout", "paperSize"];

export function PreferencesPage() {
  const [preferences, setPreferences] = useState<CreatorPreference[]>([]);
  const [key, setKey] = useState(DEFAULT_KEYS[0]);
  const [value, setValue] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    listPreferences().then(setPreferences).catch((error: Error) => setNotice(error.message));
  }, []);

  async function save() {
    const saved = await savePreference(key.trim(), value.trim());
    setPreferences((current) => [saved, ...current.filter((item) => item.key !== saved.key)].sort((a, b) => a.key.localeCompare(b.key)));
    setValue("");
    setNotice("Preference saved.");
  }

  return (
    <main className="grid gap-4">
      <header className="page-header">
        <p className="text-xs font-bold uppercase tracking-wide text-blue-600">Creator Memory</p>
        <h1 className="text-xl font-bold text-slate-950">Preferences</h1>
        <p className="mt-1 text-sm text-slate-500">Store reusable defaults like tone, color, language, layout, and paper size.</p>
      </header>
      {notice ? <div className="premium-card rounded-xl p-3 text-sm text-slate-700">{notice}</div> : null}
      <section className="premium-card grid gap-3 rounded-xl p-4 sm:grid-cols-[220px_minmax(0,1fr)_auto]">
        <input className="input" list="preference-keys" value={key} onChange={(event) => setKey(event.target.value)} placeholder="Preference key" />
        <datalist id="preference-keys">{DEFAULT_KEYS.map((item) => <option key={item} value={item} />)}</datalist>
        <input className="input" value={value} onChange={(event) => setValue(event.target.value)} placeholder="Value, e.g. formal, A4, blue" />
        <button type="button" className="btn btn-primary" onClick={() => void save()} disabled={!key.trim() || !value.trim()}>Save</button>
      </section>
      <section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {preferences.map((pref) => (
          <div key={pref.key} className="premium-card rounded-xl p-4">
            <p className="text-xs font-bold uppercase text-slate-500">{pref.key}</p>
            <p className="mt-2 text-sm font-semibold text-slate-950">{String(pref.value)}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
