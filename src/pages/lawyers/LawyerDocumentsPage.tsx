import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createDocument, listDocuments } from "../../client/documentIntelligenceClient";
import { getLawyerPageTemplates, type SmartPageTemplateDefinition } from "../../shared/lawyerTemplates";
import type { SmartDocumentSummary } from "../../shared/types/documentIntelligence";

export function LawyerDocumentsPage() {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState<SmartDocumentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [creating, setCreating] = useState(false);
  const templates = useMemo(() => getLawyerPageTemplates("parsed"), []);

  useEffect(() => {
    listDocuments()
      .then(setDocuments)
      .catch((error: Error) => setLoadError(error.message || "Failed to load documents."))
      .finally(() => setLoading(false));
  }, []);

  async function handleCreateDocument(title = "Untitled Legal Draft") {
    setCreating(true);
    try {
      const document = await createDocument(title);
      void navigate(`/lawyers/documents/${document.id}`);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Failed to create document.");
    } finally {
      setCreating(false);
    }
  }

  async function handleCreateFromTemplate(template: SmartPageTemplateDefinition) {
    setCreating(true);
    try {
      const document = await createDocument(template.name);
      void navigate(`/lawyers/documents/${document.id}?template=${encodeURIComponent(template.id)}`);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Failed to create document.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[color:var(--sc-primary)]">Smart Pages for Lawyers</p>
          <h1 className="mt-1 text-xl font-black text-slate-950 sm:text-2xl">Documents</h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">Recent matters, drafts, published client links, and starting points for new legal documents.</p>
        </div>
        <button type="button" className="btn btn-primary min-h-11 px-4" onClick={() => void handleCreateDocument()} disabled={creating}>
          {creating ? "Creating..." : "New Legal Document"}
        </button>
      </div>

      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Generated documents are drafts and must be reviewed by a qualified legal professional before use.
      </div>

      <section className="premium-card premium-card-hover rounded-2xl p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[color:var(--sc-primary)]">Start here</p>
            <h2 className="mt-1 text-lg font-black text-slate-950">Choose a lawyer template</h2>
            <p className="mt-1 text-sm text-slate-600">Create a new draft from a common legal workflow, then refine it in the editor.</p>
          </div>
          <Link to="/lawyers/onboarding" className="btn btn-secondary min-h-11 px-4">
            Update profile
          </Link>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {templates.map((template) => (
            <article key={template.id} className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-[color:var(--sc-primary)] hover:shadow-lg">
              <div className="absolute inset-x-0 top-0 h-1 bg-[color:var(--sc-primary)]" />
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[color:var(--sc-primary)]">{template.category}</p>
                  <h3 className="mt-2 text-base font-black text-slate-950">{template.name}</h3>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{template.description}</p>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between gap-3">
                <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-[color:var(--sc-primary)]">Editable output</span>
                <button
                  type="button"
                  className="btn btn-primary min-h-11 px-4 text-xs"
                  aria-label={`Use ${template.name}`}
                  onClick={() => void handleCreateFromTemplate(template)}
                  disabled={creating}
                >
                  Use template
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      {loadError ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{loadError}</div> : null}

      <section className="premium-card premium-card-hover rounded-2xl p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[color:var(--sc-primary)]">Recent matters</p>
            <h2 className="mt-1 text-lg font-black text-slate-950">Documents in this workspace</h2>
          </div>
          {loading ? <span className="text-xs font-semibold text-slate-500">Loading...</span> : null}
        </div>

        {loading ? (
          <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
            Loading lawyer documents...
          </div>
        ) : documents.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center shadow-sm">
            <p className="text-lg font-black text-slate-950">No legal documents yet</p>
            <p className="mt-2 text-sm text-slate-500">Create a draft or upload client papers to begin.</p>
            <button type="button" className="btn btn-primary mt-4 min-h-11 px-4" onClick={() => void handleCreateDocument()} disabled={creating}>
              {creating ? "Creating..." : "Create first draft"}
            </button>
          </div>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {documents.map((doc) => (
              <button
                key={doc.id}
                type="button"
                onClick={() => void navigate(`/lawyers/documents/${doc.id}`)}
                className="rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[color:var(--sc-primary)] hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--sc-primary)]/50"
              >
                <p className="text-sm font-black text-slate-950">{doc.title}</p>
                <p className="mt-1 text-xs text-slate-500">{doc.domain ?? "legal"} - {doc.status.toLowerCase()}</p>
                <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400">
                  <span>{doc.versionCount} {doc.versionCount === 1 ? "version" : "versions"}</span>
                  <span>{doc.publishToken ? "Published" : "Draft"}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

