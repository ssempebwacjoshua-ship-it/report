import { useState } from "react";
import { reindexDocumentOs, searchDocumentOs, type SearchResult } from "../../client/documentOsClient";

export function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [notice, setNotice] = useState("");

  async function search() {
    setResults(await searchDocumentOs(query));
  }

  async function reindex() {
    const count = await reindexDocumentOs();
    setNotice(`Indexed ${count} items.`);
  }

  return (
    <main className="grid gap-4">
      <header className="page-header flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-blue-600">Search Service</p>
          <h1 className="text-xl font-bold text-slate-950">Global Search</h1>
          <p className="mt-1 text-sm text-slate-500">Search documents, collections, records, versions, and published pages.</p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={() => void reindex()}>Rebuild index</button>
      </header>
      {notice ? <div className="premium-card rounded-xl p-3 text-sm text-slate-700">{notice}</div> : null}
      <section className="premium-card flex flex-col gap-2 rounded-xl p-4 sm:flex-row">
        <input className="input" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void search(); }} placeholder="Joshua math report, blood pressure report, case timeline..." />
        <button type="button" className="btn btn-primary" onClick={() => void search()}>Search</button>
      </section>
      <section className="grid gap-2">
        {results.map((result) => (
          <div key={result.id} className="premium-card rounded-xl p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-700">{result.entityType}</span>
              <p className="font-bold text-slate-950">{result.title ?? result.entityId}</p>
            </div>
            <p className="mt-2 text-sm text-slate-600">{result.snippet}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
