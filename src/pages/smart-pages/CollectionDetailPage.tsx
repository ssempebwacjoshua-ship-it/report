import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useParams } from "react-router";
import {
  getCollection,
  addRecord,
  deleteRecord,
  importCSV,
  type Collection,
  type CollectionRecord,
} from "../../client/collectionsClient";

export function CollectionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [collection, setCollection] = useState<Collection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddRecord, setShowAddRecord] = useState(false);
  const [recordJson, setRecordJson] = useState("{\n  \n}");
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [addingRecord, setAddingRecord] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setError(null);
      const data = await getCollection(id);
      setCollection(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load collection.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  async function handleAddRecord(e: React.FormEvent) {
    e.preventDefault();
    setJsonError(null);
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(recordJson) as Record<string, unknown>;
    } catch {
      setJsonError("Invalid JSON. Check your syntax.");
      return;
    }
    if (!id) return;
    setAddingRecord(true);
    try {
      const result = await addRecord(id, data);
      const newRecord: CollectionRecord = { id: result.id, data, sortOrder: (collection?.records?.length ?? 0) };
      setCollection((prev) => prev ? {
        ...prev,
        records: [...(prev.records ?? []), newRecord],
      } : prev);
      setShowAddRecord(false);
      setRecordJson("{\n  \n}");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add record.");
    } finally {
      setAddingRecord(false);
    }
  }

  async function handleDeleteRecord(recordId: string) {
    if (!id || !confirm("Delete this record?")) return;
    setDeletingId(recordId);
    try {
      await deleteRecord(id, recordId);
      setCollection((prev) => prev ? {
        ...prev,
        records: (prev.records ?? []).filter((r) => r.id !== recordId),
      } : prev);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed.");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleCSVImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !id) return;
    setImportStatus("Importing…");
    setError(null);
    try {
      const result = await importCSV(id, file);
      setImportStatus(`Imported ${result.imported} records${result.skipped > 0 ? `, ${result.skipped} skipped` : ""}.`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "CSV import failed.");
      setImportStatus(null);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const records = collection?.records ?? [];
  const fieldKeys = records.length > 0
    ? Array.from(new Set(records.flatMap((r) => Object.keys(r.data))))
    : [];

  if (loading) return <div className="p-8 text-center text-sm text-slate-500">Loading…</div>;
  if (!collection) return <div className="p-8 text-center text-sm text-red-500">{error ?? "Collection not found."}</div>;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex items-center gap-3">
        <button
          onClick={() => navigate("/collections")}
          className="text-sm text-slate-400 hover:text-slate-700"
        >
          ← Collections
        </button>
        <span className="text-slate-200">/</span>
        <h1 className="text-xl font-black text-slate-900">{collection.name}</h1>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
          {collection.type.charAt(0) + collection.type.slice(1).toLowerCase()}
        </span>
      </div>

      {error ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}
      {importStatus ? (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{importStatus}</div>
      ) : null}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          onClick={() => navigate(`/collections/${id}/bulk-generate`)}
          className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700"
        >
          Generate Documents
        </button>
        <button
          onClick={() => setShowAddRecord(true)}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
        >
          + Add Record
        </button>
        <label className="cursor-pointer rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">
          Import CSV
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => { void handleCSVImport(e); }}
          />
        </label>
      </div>

      {showAddRecord ? (
        <form
          onSubmit={(e) => { void handleAddRecord(e); }}
          className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <h2 className="mb-3 text-sm font-bold text-slate-900">Add Record (JSON)</h2>
          <textarea
            autoFocus
            value={recordJson}
            onChange={(e) => { setRecordJson(e.target.value); setJsonError(null); }}
            rows={6}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs focus:border-blue-500 focus:outline-none"
            placeholder='{ "name": "Alice", "score": 92 }'
          />
          {jsonError ? <p className="mt-1 text-xs text-red-500">{jsonError}</p> : null}
          <div className="mt-3 flex gap-2">
            <button
              type="submit"
              disabled={addingRecord}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {addingRecord ? "Adding…" : "Add"}
            </button>
            <button
              type="button"
              onClick={() => { setShowAddRecord(false); setJsonError(null); }}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      {records.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 py-16 text-center">
          <p className="text-sm text-slate-400">No records yet. Add records or import a CSV file.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                {fieldKeys.map((key) => (
                  <th key={key} className="px-4 py-3 text-left font-bold text-slate-600">{key}</th>
                ))}
                <th className="px-4 py-3 text-right font-bold text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record, i) => (
                <tr key={record.id} className={i % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
                  {fieldKeys.map((key) => (
                    <td key={key} className="max-w-[200px] truncate px-4 py-3 text-slate-700">
                      {record.data[key] != null ? String(record.data[key]) : <span className="text-slate-300">—</span>}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => { void handleDeleteRecord(record.id); }}
                      disabled={deletingId === record.id}
                      className="text-red-400 hover:text-red-600 disabled:opacity-50 text-xs"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
