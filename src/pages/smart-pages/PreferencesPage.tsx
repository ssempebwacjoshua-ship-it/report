import { useEffect, useState } from "react";
import { listPreferences, savePreference, type CreatorPreference } from "../../client/documentOsClient";

const SCHOOL_KEYS: Array<{ key: string; label: string; placeholder: string }> = [
  { key: "primaryColor", label: "Primary Color", placeholder: "#2563eb" },
  { key: "defaultLanguage", label: "Default Language", placeholder: "English" },
  { key: "defaultTone", label: "Default Tone", placeholder: "Formal" },
  { key: "defaultPaperSize", label: "Default Paper Size", placeholder: "A4" },
  { key: "defaultOutputStyle", label: "Default Output Style", placeholder: "Professional" },
  { key: "schoolDocumentHeader", label: "Document Header", placeholder: "School name or tagline" },
  { key: "schoolDocumentFooter", label: "Document Footer", placeholder: "Contact or footer text" },
  { key: "watermarkEnabled", label: "Watermark Enabled", placeholder: "true or false" },
  { key: "defaultTemplateStyle", label: "Default Template Style", placeholder: "clean" },
];

function isLawyerKey(key: string): boolean {
  return key.toLowerCase().startsWith("lawyer.");
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return String(value);
  return JSON.stringify(value);
}

export function PreferencesPage() {
  const [preferences, setPreferences] = useState<CreatorPreference[]>([]);
  const [key, setKey] = useState(SCHOOL_KEYS[0].key);
  const [value, setValue] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    listPreferences("school")
      .then((prefs) => setPreferences(prefs.filter((p) => !isLawyerKey(p.key))))
      .catch((error: Error) => setNotice(error.message));
  }, []);

  async function save() {
    const saved = await savePreference(key.trim(), value.trim());
    setPreferences((current) =>
      [saved, ...current.filter((item) => item.key !== saved.key)].sort((a, b) =>
        a.key.localeCompare(b.key),
      ),
    );
    setValue("");
    setNotice("Preference saved.");
  }

  const activePlaceholder = SCHOOL_KEYS.find((k) => k.key === key)?.placeholder ?? "Value";

  return (
    <main className="grid gap-4">
      <header className="page-header">
        <p className="text-xs font-bold uppercase tracking-wide text-blue-600">Creator Memory</p>
        <h1 className="text-xl font-bold text-slate-950">Preferences</h1>
        <p className="mt-1 text-sm text-slate-500">
          Store reusable defaults like tone, color, language, layout, and paper size.
        </p>
      </header>
      {notice ? <div className="premium-card rounded-xl p-3 text-sm text-slate-700">{notice}</div> : null}
      <section className="premium-card grid gap-3 rounded-xl p-4 sm:grid-cols-[220px_minmax(0,1fr)_auto]">
        <select className="input" value={key} onChange={(event) => setKey(event.target.value)}>
          {SCHOOL_KEYS.map((item) => (
            <option key={item.key} value={item.key}>
              {item.label}
            </option>
          ))}
        </select>
        <input
          className="input"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={activePlaceholder}
        />
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => void save()}
          disabled={!key.trim() || !value.trim()}
        >
          Save
        </button>
      </section>
      <section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {preferences.map((pref) => (
          <div key={pref.key} className="premium-card rounded-xl p-4">
            <p className="text-xs font-bold uppercase text-slate-500">{pref.key}</p>
            <p className="mt-2 text-sm font-semibold text-slate-950">{formatValue(pref.value)}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
