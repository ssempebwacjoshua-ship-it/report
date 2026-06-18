import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createDocument, listDocuments } from "../../client/documentIntelligenceClient";
import type { SmartDocumentSummary } from "../../shared/types/documentIntelligence";

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  PUBLISHED: "Published",
  ARCHIVED: "Archived",
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-600",
  PUBLISHED: "bg-emerald-100 text-emerald-700",
  ARCHIVED: "bg-amber-100 text-amber-700",
};

export function SmartPagesPage() {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState<SmartDocumentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [creating, setCreating] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  useEffect(() => {
    listDocuments()
      .then(setDocuments)
      .catch((e: Error) => setLoadError(e.message || "Failed to load documents."))
      .finally(() => setLoading(false));
  }, []);

  async function handleCreate() {
    const title = newTitle.trim() || "Untitled Document";
    setCreating(true);
    try {
      const doc = await createDocument(title);
      void navigate(`/smart-pages/${doc.id}`);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to create document.");
    } finally {
      setCreating(false);
      setShowModal(false);
      setNewTitle("");
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm text-slate-500">Loading documents...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-950">Smart Pages</h1>
          <p className="mt-0.5 text-sm text-slate-500">Upload anything. Describe what you want. AI builds it.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
            onClick={() => void navigate("/collections")}
          >
            Collections
          </button>
          <button
            type="button"
            className="btn btn-primary flex items-center gap-2"
            onClick={() => setShowModal(true)}
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 5v14M5 12h14" strokeLinecap="round" />
            </svg>
            New Document
          </button>
        </div>
      </div>

      {loadError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {loadError}
        </div>
      ) : null}

      {/* Document grid */}
      {documents.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl border-2 border-dashed border-slate-200 bg-white py-16 text-center">
          <div className="h-16 w-16 rounded-2xl bg-blue-50 grid place-items-center">
            <svg viewBox="0 0 24 24" className="h-8 w-8 text-blue-400" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M9 13h6m-3-3v6M21 12V7l-5-5H5a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h7" />
              <path d="M13 2v5h5" />
              <circle cx="18" cy="18" r="4" />
              <path d="M18 16v4M16 18h4" />
            </svg>
          </div>
          <div>
            <p className="font-bold text-slate-800">No documents yet</p>
            <p className="mt-1 text-sm text-slate-500">Create your first document to get started.</p>
          </div>
          <button type="button" className="btn btn-primary" onClick={() => setShowModal(true)}>
            Create Document
          </button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {documents.map((doc) => (
            <button
              key={doc.id}
              type="button"
              onClick={() => void navigate(`/smart-pages/${doc.id}`)}
              className="premium-card group rounded-xl p-4 text-left transition hover:border-blue-300 hover:shadow-lg"
            >
              <div className="mb-3 flex items-start justify-between gap-2">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-blue-50">
                  <svg viewBox="0 0 24 24" className="h-5 w-5 text-blue-500" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2Z" />
                    <path d="M14 2v6h6M10 12h4M10 16h4M8 8h.01" />
                  </svg>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_COLORS[doc.status] ?? "bg-slate-100 text-slate-500"}`}>
                  {STATUS_LABELS[doc.status] ?? doc.status}
                </span>
              </div>

              <p className="line-clamp-2 text-sm font-bold text-slate-900 group-hover:text-blue-700">
                {doc.title}
              </p>

              {doc.domain ? (
                <p className="mt-1 text-xs capitalize text-slate-500">{doc.domain}</p>
              ) : null}

              <div className="mt-3 flex items-center justify-between text-[10px] text-slate-400">
                <span>{doc.versionCount} {doc.versionCount === 1 ? "version" : "versions"}</span>
                <span>{new Date(doc.updatedAt).toLocaleDateString()}</span>
              </div>

              {doc.publishToken ? (
                <div className="mt-2 flex items-center gap-1 text-[10px] text-emerald-600">
                  <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Published
                </div>
              ) : null}
            </button>
          ))}
        </div>
      )}

      {/* Create modal */}
      {showModal ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-4 sm:items-center">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
            <h2 className="text-base font-black text-slate-900">New Document</h2>
            <p className="mt-1 text-sm text-slate-500">Give your document a name to get started.</p>
            <input
              autoFocus
              type="text"
              placeholder="e.g. End of Term Report, Patient Summary?"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void handleCreate(); }}
              className="premium-control mt-4 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-400"
            />
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                className="flex-1 rounded-lg border border-slate-200 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                onClick={() => { setShowModal(false); setNewTitle(""); }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary flex-1"
                disabled={creating}
                onClick={() => void handleCreate()}
              >
                {creating ? "Creating..." : "Create"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

