import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router";
import { getCollection, createBulkJob, type Collection } from "../../client/collectionsClient";
import { SmartPageTemplatePicker } from "../../components/smart-pages/SmartPageTemplatePicker";
import { getSmartPageTemplates } from "../../shared/smartPagesTemplates";

const INTENT_SUGGESTIONS = [
  "Generate a student report card with name, score, grade, and teacher remarks",
  "Create a patient summary with diagnosis, treatment, and appointment details",
  "Build an employee performance review with goals and feedback",
  "Design a client profile with contact info and account status",
];

export function BulkGeneratePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [collection, setCollection] = useState<Collection | null>(null);
  const [loading, setLoading] = useState(true);
  const [intent, setIntent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bulkTemplates = getSmartPageTemplates("bulk");

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const data = await getCollection(id);
      setCollection(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load collection.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!id || !intent.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const job = await createBulkJob(id, intent.trim());
      navigate(`/bulk-jobs/${job.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start generation.");
      setSubmitting(false);
    }
  }

  const records = collection?.records ?? [];

  if (loading) return <div className="p-8 text-center text-sm text-slate-500">Loading...</div>;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6 flex items-center gap-3">
        <button
          onClick={() => navigate(`/collections/${id}`)}
          className="text-sm text-slate-400 hover:text-slate-700"
        >
          Back to {collection?.name ?? "Collection"}
        </button>
        <span className="text-slate-200">/</span>
        <h1 className="text-xl font-black text-slate-900">Generate Documents</h1>
      </div>

      {collection ? (
        <div className="mb-6 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
          <p className="text-sm text-blue-800">
            <span className="font-bold">{records.length} records</span> will each get their own document.
            One Gemini call creates the template; records are filled in instantly.
          </p>
        </div>
      ) : null}

      {error ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}

      <form onSubmit={(e) => { void handleSubmit(e); }} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-base font-bold text-slate-900">Describe what to generate</h2>

        <div className="mb-4">
          <SmartPageTemplatePicker
            templates={bulkTemplates}
            scope="bulk"
            onPickTemplate={(template) => {
              setIntent(template.buildPrompt({
                collectionName: collection?.name,
                recordCount: records.length,
              }));
            }}
          />
        </div>

        <textarea
          autoFocus
          value={intent}
          onChange={(e) => setIntent(e.target.value)}
          rows={4}
          placeholder="Describe the document you want to generate for each record."
          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm leading-relaxed focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />

        <div className="mt-3 flex flex-wrap gap-2">
          {INTENT_SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setIntent(s)}
              className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 transition-colors"
            >
              {s.length > 60 ? `${s.slice(0, 58)}...` : s}
            </button>
          ))}
        </div>

        <div className="mt-5 flex gap-3">
          <button
            type="submit"
            disabled={submitting || !intent.trim() || records.length === 0}
            className="flex-1 rounded-xl bg-blue-600 py-3 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? "Starting..." : `Generate ${records.length} Document${records.length !== 1 ? "s" : ""}`}
          </button>
          <button
            type="button"
            onClick={() => navigate(`/collections/${id}`)}
            className="rounded-xl border border-slate-200 px-5 py-3 text-sm text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
        </div>

        {records.length === 0 ? (
          <p className="mt-3 text-xs text-amber-600">Add records to the collection first before generating.</p>
        ) : null}
      </form>
    </div>
  );
}

