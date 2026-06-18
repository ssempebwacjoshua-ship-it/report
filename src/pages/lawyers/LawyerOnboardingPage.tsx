import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { listPreferences, savePreference, type CreatorPreference } from "../../client/documentOsClient";

const PRACTICE_AREAS = [
  "Land",
  "Family",
  "Employment",
  "Debt recovery",
  "Contracts",
  "Corporate/commercial",
  "Criminal",
  "Probate/succession",
  "Immigration",
  "General practice",
];

const TONES = ["Formal", "Firm", "Conciliatory", "Court-ready", "Client-friendly"];
const OUTPUT_STYLES = ["Letterhead", "Plain draft", "Court-style draft", "Client summary"];

type LawyerProfile = {
  name: string;
  location: string;
  phoneEmail: string;
};

type LawyerFirm = {
  name: string;
  address: string;
  contact: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function readString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function readBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value === "true";
  return fallback;
}

export function LawyerOnboardingPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [profile, setProfile] = useState<LawyerProfile>({ name: "", location: "", phoneEmail: "" });
  const [firm, setFirm] = useState<LawyerFirm>({ name: "", address: "", contact: "" });
  const [jurisdiction, setJurisdiction] = useState("Uganda");
  const [cityDistrict, setCityDistrict] = useState("");
  const [practiceAreas, setPracticeAreas] = useState<string[]>([]);
  const [tone, setTone] = useState("Formal");
  const [outputStyle, setOutputStyle] = useState("Letterhead");
  const [signatureBlock, setSignatureBlock] = useState("");
  const [commonSignOff, setCommonSignOff] = useState("");
  const [withoutPrejudice, setWithoutPrejudice] = useState(false);
  const [reviewDisclaimer, setReviewDisclaimer] = useState(true);

  useEffect(() => {
    listPreferences()
      .then((prefs: CreatorPreference[]) => {
        const map = new Map(prefs.map((pref) => [pref.key, pref.value]));
        const profileValue = asRecord(map.get("lawyer.profile"));
        const firmValue = asRecord(map.get("lawyer.firm"));
        setProfile({
          name: readString(profileValue?.name),
          location: readString(profileValue?.location),
          phoneEmail: readString(profileValue?.phoneEmail),
        });
        setFirm({
          name: readString(firmValue?.name),
          address: readString(firmValue?.address),
          contact: readString(firmValue?.contact),
        });
        setJurisdiction(readString(map.get("lawyer.defaultJurisdiction"), "Uganda"));
        setCityDistrict(readString(map.get("lawyer.cityDistrict")));
        const savedAreas = Array.isArray(map.get("lawyer.practiceAreas")) ? map.get("lawyer.practiceAreas") as unknown[] : [];
        setPracticeAreas(savedAreas.map((area) => readString(area)).filter(Boolean));
        setTone(readString(map.get("lawyer.tone"), "Formal"));
        setOutputStyle(readString(map.get("lawyer.outputStyle"), "Letterhead"));
        setSignatureBlock(readString(map.get("lawyer.signatureBlock")));
        setCommonSignOff(readString(map.get("lawyer.commonSignOff")));
        setWithoutPrejudice(readBoolean(map.get("lawyer.withoutPrejudice"), false));
        setReviewDisclaimer(readBoolean(map.get("lawyer.reviewDisclaimer"), true));
      })
      .catch((error: Error) => setNotice(error.message || "Could not load lawyer preferences."))
      .finally(() => setLoading(false));
  }, []);

  const profileComplete = useMemo(() => Boolean(profile.name || firm.name || signatureBlock), [firm.name, profile.name, signatureBlock]);

  function togglePracticeArea(area: string) {
    setPracticeAreas((current) => (current.includes(area) ? current.filter((item) => item !== area) : [...current, area]));
  }

  async function saveSettings() {
    setSaving(true);
    setNotice("");
    try {
      await Promise.all([
        savePreference("lawyer.profile", { name: profile.name.trim(), location: profile.location.trim(), phoneEmail: profile.phoneEmail.trim() }),
        savePreference("lawyer.firm", { name: firm.name.trim(), address: firm.address.trim(), contact: firm.contact.trim() }),
        savePreference("lawyer.defaultJurisdiction", jurisdiction.trim() || "Uganda"),
        savePreference("lawyer.cityDistrict", cityDistrict.trim()),
        savePreference("lawyer.practiceAreas", practiceAreas),
        savePreference("lawyer.tone", tone),
        savePreference("lawyer.outputStyle", outputStyle),
        savePreference("lawyer.signatureBlock", signatureBlock.trim()),
        savePreference("lawyer.commonSignOff", commonSignOff.trim()),
        savePreference("lawyer.withoutPrejudice", withoutPrejudice),
        savePreference("lawyer.reviewDisclaimer", reviewDisclaimer),
      ]);
      setNotice("Lawyer profile saved.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not save lawyer preferences.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="flex min-h-[50vh] items-center justify-center text-sm text-slate-500">Loading...</div>;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <section className="premium-card premium-card-hover rounded-2xl p-4 sm:p-5">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[color:var(--sc-primary)]">Lawyer onboarding</p>
        <h1 className="mt-2 text-xl font-black text-slate-950 sm:text-2xl">Set up your firm profile and drafting defaults.</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Smart Pages prepares legal drafts for lawyer review. Review and approve before sending, filing, or signing. Applicable law, court rules, and citations must be verified by the lawyer.
        </p>
      </section>

      {notice ? <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">{notice}</div> : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="premium-card premium-card-hover rounded-2xl p-4 sm:p-5">
          <h2 className="text-lg font-black text-slate-950">Profile</h2>
          <div className="mt-4 grid gap-3">
            <Field label="Lawyer name" value={profile.name} onChange={(value) => setProfile((current) => ({ ...current, name: value }))} />
            <Field label="Firm name" value={firm.name} onChange={(value) => setFirm((current) => ({ ...current, name: value }))} />
            <Field label="Firm address" value={firm.address} onChange={(value) => setFirm((current) => ({ ...current, address: value }))} />
            <Field
              label="Phone / email"
              value={firm.contact || profile.phoneEmail}
              onChange={(value) => {
                setFirm((current) => ({ ...current, contact: value }));
                setProfile((current) => ({ ...current, phoneEmail: value }));
              }}
            />
            <Field label="Jurisdiction" value={jurisdiction} onChange={setJurisdiction} />
            <Field label="City / district" value={cityDistrict} onChange={setCityDistrict} />
          </div>
        </section>

        <section className="premium-card premium-card-hover rounded-2xl p-4 sm:p-5">
          <h2 className="text-lg font-black text-slate-950">Preferences</h2>
          <div className="mt-4 grid gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Practice areas</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {PRACTICE_AREAS.map((area) => (
                  <button
                    key={area}
                    type="button"
                    onClick={() => togglePracticeArea(area)}
                    className={`rounded-full px-3 py-1.5 text-xs font-bold ${practiceAreas.includes(area) ? "bg-[color:var(--sc-primary-soft)] text-[color:var(--sc-primary)]" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
                  >
                    {area}
                  </button>
                ))}
              </div>
            </div>

            <ChoiceGroup label="Preferred tone" value={tone} options={TONES} onChange={setTone} />
            <ChoiceGroup label="Preferred output format" value={outputStyle} options={OUTPUT_STYLES} onChange={setOutputStyle} />

            <Field label="Signature block" value={signatureBlock} onChange={setSignatureBlock} textarea />
            <Field label="Common sign-off" value={commonSignOff} onChange={setCommonSignOff} />

            <label className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700">
              <span>Include Without Prejudice option</span>
              <input type="checkbox" checked={withoutPrejudice} onChange={(event) => setWithoutPrejudice(event.target.checked)} />
            </label>
            <label className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700">
              <span>Include lawyer review disclaimer</span>
              <input type="checkbox" checked={reviewDisclaimer} onChange={(event) => setReviewDisclaimer(event.target.checked)} />
            </label>
          </div>
        </section>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-primary min-h-11 px-4" onClick={() => void saveSettings()} disabled={saving}>
          {saving ? "Saving..." : "Save lawyer profile"}
        </button>
        <Link to="/lawyers/documents" className="btn btn-secondary min-h-11 px-4">
          Continue
        </Link>
        {profileComplete ? <span className="self-center text-xs font-semibold text-emerald-700">Profile details saved in this workspace.</span> : null}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  textarea = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  textarea?: boolean;
}) {
  return (
    <label className="grid gap-1.5 text-sm font-medium text-slate-700">
      <span>{label}</span>
      {textarea ? (
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="premium-control min-h-24 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-[color:var(--sc-primary)]"
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="premium-control rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-[color:var(--sc-primary)]"
        />
      )}
    </label>
  );
}

function ChoiceGroup({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            className={`rounded-full px-3 py-1.5 text-xs font-bold ${value === option ? "bg-[color:var(--sc-primary-soft)] text-[color:var(--sc-primary)]" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}
