import { useEffect, useState } from "react";
import {
  createSchoolStream,
  deleteSchoolStream,
  fetchSchoolStructure,
  updateSchoolStructure,
  type CanonicalClassRecord,
  type SchoolSection,
  type SchoolStructureData,
} from "../../client/schoolStructureClient";

const fieldClass =
  "premium-control w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-400";

const SECTION_ORDER: SchoolSection[] = ["NURSERY", "PRIMARY", "SECONDARY"];

type AddStreamState = {
  name: string;
  code: string;
  saving: boolean;
  error: string;
};

function defaultAddStreamState(): AddStreamState {
  return { name: "", code: "", saving: false, error: "" };
}

export function SchoolStructureSection({ schoolCode = "SCU-PREVIEW" }: { schoolCode?: string }) {
  const [data, setData] = useState<SchoolStructureData | null>(null);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);

  const [draftSections, setDraftSections] = useState<SchoolSection[]>([]);
  const [savingSections, setSavingSections] = useState(false);
  const [savedSections, setSavedSections] = useState(false);
  const [sectionSaveError, setSectionSaveError] = useState("");

  const [addStreamState, setAddStreamState] = useState<Record<string, AddStreamState>>({});
  const [deletingStream, setDeletingStream] = useState<Record<string, boolean>>({});
  const [deleteStreamErrors, setDeleteStreamErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchSchoolStructure(schoolCode)
      .then((d) => {
        setData(d);
        setDraftSections(d.selectedSections);
      })
      .catch((e: Error) => setLoadError(e.message || "Failed to load school structure."))
      .finally(() => setLoading(false));
  }, [schoolCode]);

  function toggleSection(section: SchoolSection) {
    if (data?.lockWarnings?.[section]) return;
    setDraftSections((prev) =>
      prev.includes(section) ? prev.filter((s) => s !== section) : [...prev, section],
    );
    setSavedSections(false);
    setSectionSaveError("");
  }

  async function handleSaveSections() {
    if (draftSections.length === 0) {
      setSectionSaveError("At least one section must be selected.");
      return;
    }
    setSavingSections(true);
    setSavedSections(false);
    setSectionSaveError("");
    try {
      const updated = await updateSchoolStructure({ schoolCode, selectedSections: draftSections });
      setData(updated);
      setDraftSections(updated.selectedSections);
      setSavedSections(true);
    } catch (e) {
      setSectionSaveError(e instanceof Error ? e.message : "Failed to save sections.");
    } finally {
      setSavingSections(false);
    }
  }

  function getAddStreamState(classId: string): AddStreamState {
    return addStreamState[classId] ?? defaultAddStreamState();
  }

  function setStreamField(classId: string, patch: Partial<AddStreamState>) {
    setAddStreamState((prev) => ({
      ...prev,
      [classId]: { ...(prev[classId] ?? defaultAddStreamState()), ...patch },
    }));
  }

  async function handleAddStream(cls: CanonicalClassRecord) {
    const state = getAddStreamState(cls.id);
    const trimmedName = state.name.trim();
    if (!trimmedName) return;
    setStreamField(cls.id, { saving: true, error: "" });
    try {
      await createSchoolStream({
        schoolCode,
        classId: cls.id,
        name: trimmedName,
        code: state.code || trimmedName.toUpperCase(),
      });
      const updated = await fetchSchoolStructure(schoolCode);
      setData(updated);
      setDraftSections(updated.selectedSections);
      setStreamField(cls.id, { name: "", code: "", saving: false, error: "" });
    } catch (e) {
      setStreamField(cls.id, { saving: false, error: e instanceof Error ? e.message : "Failed to add stream." });
    }
  }

  async function handleDeleteStream(streamId: string) {
    setDeletingStream((prev) => ({ ...prev, [streamId]: true }));
    setDeleteStreamErrors((prev) => ({ ...prev, [streamId]: "" }));
    try {
      await deleteSchoolStream(streamId, schoolCode);
      const updated = await fetchSchoolStructure(schoolCode);
      setData(updated);
      setDraftSections(updated.selectedSections);
    } catch (e) {
      setDeleteStreamErrors((prev) => ({
        ...prev,
        [streamId]: e instanceof Error ? e.message : "Failed to delete stream.",
      }));
    } finally {
      setDeletingStream((prev) => ({ ...prev, [streamId]: false }));
    }
  }

  if (loading) {
    return (
      <section className="premium-card rounded-xl p-4">
        <div className="text-sm text-slate-500">Loading school structure…</div>
      </section>
    );
  }

  if (loadError || !data) {
    return (
      <section className="premium-card rounded-xl p-4">
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {loadError || "Failed to load school structure."}
        </div>
      </section>
    );
  }

  const lockWarningEntries = Object.entries(data.lockWarnings ?? {}) as [SchoolSection, string][];

  return (
    <div className="grid gap-4">
      <section className="premium-card rounded-xl p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-black text-slate-950">School Structure</h2>
          <div className="flex flex-wrap items-center gap-2">
            {savedSections ? <span className="text-xs font-bold text-emerald-700">Saved</span> : null}
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void handleSaveSections()}
              disabled={savingSections}
            >
              {savingSections ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </div>

        <p className="mb-4 text-sm text-slate-600">
          Choose which sections this school offers. The system will create the standard classes for each
          section. Streams within each class are managed below.
        </p>

        <div className="flex flex-wrap gap-3">
          {data.availableSections.map((section) => {
            const locked = data.lockWarnings?.[section.code];
            return (
              <label
                key={section.code}
                className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700"
              >
                <input
                  type="checkbox"
                  checked={draftSections.includes(section.code)}
                  disabled={Boolean(locked)}
                  onChange={() => toggleSection(section.code)}
                  className="h-4 w-4"
                />
                {section.label}
                {locked ? (
                  <span className="ml-1 rounded-md bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700">
                    locked
                  </span>
                ) : null}
              </label>
            );
          })}
        </div>

        {lockWarningEntries.length > 0 ? (
          <div className="mt-3 grid gap-1">
            {lockWarningEntries.map(([section, msg]) => (
              <p key={section} className="text-xs text-amber-700">
                {msg}
              </p>
            ))}
          </div>
        ) : null}

        {sectionSaveError ? (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {sectionSaveError}
          </div>
        ) : null}
      </section>

      {SECTION_ORDER.map((section) => {
        const sectionClasses = data.canonicalClasses.filter((c) => c.section === section);
        if (sectionClasses.length === 0) return null;
        const sectionLabel = data.availableSections.find((s) => s.code === section)?.label ?? section;

        return (
          <section key={section} className="premium-card rounded-xl p-4">
            <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">
              {sectionLabel}
            </h3>
            <div className="grid gap-3">
              {sectionClasses.map((cls) => {
                const streamState = getAddStreamState(cls.id);
                return (
                  <div key={cls.id} className="rounded-lg border border-slate-200 bg-white p-3">
                    <p className="mb-2 text-sm font-bold text-slate-900">{cls.name}</p>

                    <div className="flex flex-wrap items-center gap-2">
                      {cls.streams.map((stream) => (
                        <div key={stream.id} className="flex items-center gap-1">
                          <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-700">
                            {stream.name}
                          </span>
                          <button
                            type="button"
                            className="rounded p-0.5 text-slate-400 hover:text-red-600 disabled:opacity-40"
                            disabled={deletingStream[stream.id]}
                            onClick={() => void handleDeleteStream(stream.id)}
                            aria-label={`Remove stream ${stream.name} from ${cls.name}`}
                            title="Remove stream"
                          >
                            ×
                          </button>
                          {deleteStreamErrors[stream.id] ? (
                            <span className="text-xs text-red-600">{deleteStreamErrors[stream.id]}</span>
                          ) : null}
                        </div>
                      ))}
                      {cls.streams.length === 0 ? (
                        <span className="text-xs text-slate-400">No streams yet</span>
                      ) : null}
                    </div>

                    <div className="mt-2 flex flex-wrap items-end gap-2">
                      <input
                        className={`${fieldClass} w-40`}
                        placeholder="Stream name, e.g. A"
                        value={streamState.name}
                        disabled={streamState.saving}
                        aria-label={`New stream name for ${cls.name}`}
                        onChange={(e) =>
                          setStreamField(cls.id, {
                            name: e.target.value,
                            code: e.target.value.trim().toUpperCase(),
                          })
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") void handleAddStream(cls);
                        }}
                      />
                      <button
                        type="button"
                        className="btn btn-secondary"
                        disabled={streamState.saving || !streamState.name.trim()}
                        onClick={() => void handleAddStream(cls)}
                      >
                        {streamState.saving ? "Adding…" : "Add stream"}
                      </button>
                      {streamState.error ? (
                        <span className="text-xs text-red-600">{streamState.error}</span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
