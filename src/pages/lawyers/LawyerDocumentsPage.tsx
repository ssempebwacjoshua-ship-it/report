import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createDocument, listDocuments } from "../../client/documentIntelligenceClient";
import type { SmartDocumentSummary } from "../../shared/types/documentIntelligence";

export function LawyerDocumentsPage() {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState<SmartDocumentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    listDocuments()
      .then(setDocuments)
      .catch((error: Error) => setLoadError(error.message || "Failed to load documents."))
      .finally(() => setLoading(false));
  }, []);

  async function handleCreateDocument() {
    setCreating(true);
    try {
      const document = await createDocument("Untitled Legal Draft");
      void navigate(`/lawyers/documents/${document.id}`);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Failed to create document.");
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return <div className="flex min-h-[50vh] items-center justify-center text-sm text-slate-500">Loading...</div>;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[color:var(--sc-primary)]">Smart Pages for Lawyers</p>
          <h1 className="mt-1 text-2xl font-black text-slate-950">Documents</h1>
          <p className="mt-1 text-sm text-slate-600">Recent matters, drafts, and published client links.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => void handleCreateDocument()} disabled={creating}>
          {creating ? "Creating..." : "New Legal Document"}
        </button>
      </div>

      {loadError ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{loadError}</div> : null}

      {documents.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-8 text-center shadow-sm">
          <p className="text-lg font-black text-slate-950">No legal documents yet</p>
          <p className="mt-2 text-sm text-slate-500">Create a draft or upload client papers to begin.</p>
          <button type="button" className="btn btn-primary mt-4" onClick={() => void handleCreateDocument()} disabled={creating}>
            {creating ? "Creating..." : "Create first draft"}
          </button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {documents.map((doc) => (
            <button
              key={doc.id}
              type="button"
              onClick={() => void navigate(`/lawyers/documents/${doc.id}`)}
              className="rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[color:var(--sc-primary)] hover:shadow-lg"
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
    </div>
  );
}

