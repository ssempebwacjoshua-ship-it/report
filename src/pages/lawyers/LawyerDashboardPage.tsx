import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createDocument, listDocuments } from "../../client/documentIntelligenceClient";
import { BrandedLoader } from "../../components/BrandedLoader";
import type { SmartDocumentSummary } from "../../shared/types/documentIntelligence";

function countByKeyword(documents: SmartDocumentSummary[], keyword: string): number {
  const needle = keyword.toLowerCase();
  return documents.filter((doc) => doc.title.toLowerCase().includes(needle) || (doc.domain ?? "").toLowerCase().includes(needle)).length;
}

export function LawyerDashboardPage() {
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

  const publishedCount = useMemo(() => documents.filter((doc) => Boolean(doc.publishToken)).length, [documents]);
  const noticeCount = useMemo(() => countByKeyword(documents, "notice"), [documents]);
  const affidavitCount = useMemo(() => countByKeyword(documents, "affidavit"), [documents]);
  const contractCount = useMemo(() => countByKeyword(documents, "contract"), [documents]);
  const evidenceCount = useMemo(() => countByKeyword(documents, "evidence"), [documents]);

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
    return <BrandedLoader message="Loading legal dashboard..." />;
  }

  const recent = documents.slice(0, 6);

  return (
    <div className="space-y-4">
      <section className="premium-card premium-card-hover rounded-2xl p-4">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[color:var(--sc-primary)]">Smart Pages for Lawyers</p>
        <h1 className="mt-2 text-xl font-black text-slate-950 sm:text-2xl">Built for Ugandan legal practice.</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Upload client notes, agreements, court papers, IDs, evidence, or scanned documents. Smart Pages for Lawyers turns them into editable drafts for lawyer review before final export.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-primary min-h-11 px-4"
            onClick={() => void handleCreateDocument()}
            disabled={creating}
          >
            {creating ? "Creating..." : "New Legal Document"}
          </button>
          <Link to="/lawyers/onboarding" className="btn btn-secondary min-h-11 px-4">
            Start onboarding
          </Link>
          <Link to="/lawyers/documents" className="btn btn-secondary min-h-11 px-4">
            View documents
          </Link>
        </div>
      </section>

      {loadError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{loadError}</div>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          { label: "Recent Matters", value: documents.length, hint: "Real documents in this workspace" },
          { label: "Published Client Links", value: publishedCount, hint: "Shared pages ready for clients" },
          { label: "Legal Notices", value: noticeCount, hint: "Keyword-derived from real documents" },
          { label: "Affidavits", value: affidavitCount, hint: "Keyword-derived from real documents" },
          { label: "Contracts Reviewed", value: contractCount, hint: "Keyword-derived from real documents" },
          { label: "Evidence Bundles", value: evidenceCount, hint: "Keyword-derived from real documents" },
        ].map((card) => (
          <article key={card.label} className="premium-card premium-card-hover rounded-2xl p-4">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">{card.label}</p>
            <p className="mt-3 text-2xl font-black text-slate-950 sm:text-3xl">{card.value}</p>
            <p className="mt-2 text-xs leading-5 text-slate-500">{card.hint}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
        <div className="premium-card premium-card-hover rounded-2xl p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[color:var(--sc-primary)]">Recent Matters / Documents</p>
              <h2 className="mt-1 text-lg font-black text-slate-950">Recent legal work</h2>
            </div>
            <Link to="/lawyers/documents" className="btn btn-secondary min-h-11 px-3">
              View all
            </Link>
          </div>

          {recent.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
              No documents yet. Create a first draft or upload client papers to begin.
            </div>
          ) : (
            <div className="mt-4 grid gap-3">
              {recent.map((doc) => (
                <button
                  key={doc.id}
                  type="button"
                  onClick={() => void navigate(`/lawyers/documents/${doc.id}`)}
                  className="premium-card premium-card-hover rounded-2xl p-4 text-left"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-slate-950">{doc.title}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{doc.domain ?? "legal"} - {doc.status.toLowerCase()}</p>
                    </div>
                    <span className="rounded-full bg-[color:var(--sc-primary-soft)] px-2 py-1 text-[10px] font-bold text-[color:var(--sc-primary)]">{doc.versionCount} versions</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400">
                    <span>{new Date(doc.updatedAt).toLocaleDateString()}</span>
                    <span>{doc.publishToken ? "Published" : "Draft"}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <aside className="grid gap-3">
          {[
            { title: "Legal Notices", body: "Draft notices and demand letters for client matters." },
            { title: "Affidavits", body: "Turn notes into affidavit-ready drafts for lawyer review." },
            { title: "Contracts", body: "Review agreements, risks, and missing clauses quickly." },
            { title: "Evidence Bundles", body: "Index supporting files and exhibits for court prep." },
          ].map((card) => (
            <article key={card.title} className="premium-card premium-card-hover rounded-2xl p-4">
              <p className="text-sm font-black text-slate-950">{card.title}</p>
              <p className="mt-1 text-sm leading-6 text-slate-600">{card.body}</p>
            </article>
          ))}
        </aside>
      </section>
    </div>
  );
}

