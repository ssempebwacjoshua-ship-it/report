import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getPublishedDocument } from "../../client/documentIntelligenceClient";
import { DocumentPreview } from "../../components/smart-pages/DocumentPreview";
import type { SmartDocumentDetail } from "../../shared/types/documentIntelligence";
import { DEFAULT_THEME } from "../../shared/types/documentIntelligence";

export function PublishedDocumentPage() {
  const { token } = useParams<{ token: string }>();
  const [doc, setDoc] = useState<SmartDocumentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [needsPassword, setNeedsPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [pwError, setPwError] = useState("");
  const [checking, setChecking] = useState(false);

  async function fetchDoc(pw?: string) {
    if (!token) { setError("Invalid link."); setLoading(false); return; }
    setChecking(true);
    try {
      const { document } = await getPublishedDocument(token, pw);
      setDoc(document);
      setNeedsPassword(false);
      setError("");
    } catch (e: any) {
      if (e?.code === "PASSWORD_REQUIRED") {
        setNeedsPassword(true);
      } else if (e?.code === "WRONG_PASSWORD") {
        setPwError("Incorrect password. Try again.");
      } else {
        setError(e instanceof Error ? e.message : "This document is not available.");
      }
    } finally {
      setLoading(false);
      setChecking(false);
    }
  }

  useEffect(() => { void fetchDoc(); }, [token]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-500">Loading…</p>
      </div>
    );
  }

  if (needsPassword) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 grid h-12 w-12 place-items-center rounded-xl bg-blue-50 text-blue-600">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <h1 className="text-base font-black text-slate-900">Password Required</h1>
          <p className="mt-1 text-sm text-slate-500">This document is password-protected.</p>
          <form
            onSubmit={(e) => { e.preventDefault(); setPwError(""); void fetchDoc(password); }}
            className="mt-4 grid gap-3"
          >
            <input
              autoFocus
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setPwError(""); }}
              placeholder="Enter password"
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:border-blue-400 focus:outline-none"
            />
            {pwError ? <p className="text-xs text-red-500">{pwError}</p> : null}
            <button
              type="submit"
              disabled={checking || !password}
              className="rounded-lg bg-blue-600 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {checking ? "Checking…" : "Unlock"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (error || !doc || !doc.activeVersion) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-4 text-center">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="text-lg font-black text-slate-900">Document not available</h1>
          <p className="mt-2 text-sm text-slate-500">{error || "This link may have expired or been removed."}</p>
        </div>
      </div>
    );
  }

  const schema = doc.activeVersion.schema ?? { theme: DEFAULT_THEME, components: [] };
  const componentTree = doc.activeVersion.componentTree ?? [];

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white px-4 py-3">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <p className="text-xs font-bold text-slate-500">Smart Pages</p>
          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" strokeLinecap="round" strokeLinejoin="round" />
              <rect x="6" y="14" width="12" height="8" rx="1" />
            </svg>
            Print
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-3xl p-4">
        <DocumentPreview schema={schema} componentTree={componentTree} />
      </main>
    </div>
  );
}
