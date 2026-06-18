import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router";
import {
  listCollections,
  createCollection,
  deleteCollection,
  type Collection,
} from "../../client/collectionsClient";

const COLLECTION_TYPES = ["CUSTOM", "STUDENTS", "PATIENTS", "CLIENTS", "EMPLOYEES"] as const;

export function CollectionsPage() {
  const navigate = useNavigate();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("CUSTOM");
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await listCollections();
      setCollections(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load collections.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const col = await createCollection(newName.trim(), newType);
      setCollections((prev) => [col, ...prev]);
      setShowCreate(false);
      setNewName("");
      setNewType("CUSTOM");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create collection.");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this collection and all its records?")) return;
    setDeletingId(id);
    try {
      await deleteCollection(id);
      setCollections((prev) => prev.filter((c) => c.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed.");
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) return <div className="p-8 text-center text-sm text-slate-500">Loading collections?</div>;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Collections</h1>
          <p className="mt-1 text-sm text-slate-500">Group records for bulk document generation</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700"
        >
          + New Collection
        </button>
      </div>

      {error ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}

      {showCreate ? (
        <form
          onSubmit={(e) => { void handleCreate(e); }}
          className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <h2 className="mb-4 text-base font-bold text-slate-900">New Collection</h2>
          <div className="grid gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Name</label>
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Grade 7A Students"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Type</label>
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              >
                {COLLECTION_TYPES.map((t) => (
                  <option key={t} value={t}>{t.charAt(0) + t.slice(1).toLowerCase()}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              type="submit"
              disabled={creating || !newName.trim()}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {creating ? "Creating?" : "Create"}
            </button>
            <button
              type="button"
              onClick={() => { setShowCreate(false); setNewName(""); }}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      {collections.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 py-16 text-center">
          <p className="text-sm text-slate-400">No collections yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {collections.map((col) => (
            <div
              key={col.id}
              className="group flex items-center gap-4 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm hover:border-blue-200 hover:shadow-md transition-all"
            >
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-base font-black text-blue-600">
                {col.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1 cursor-pointer" onClick={() => navigate(`/collections/${col.id}`)}>
                <p className="font-bold text-slate-900">{col.name}</p>
                <p className="text-xs text-slate-400">{col.type.charAt(0) + col.type.slice(1).toLowerCase()} ? {new Date(col.updatedAt).toLocaleDateString()}</p>
              </div>
              <div className="flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  onClick={() => navigate(`/collections/${col.id}/bulk-generate`)}
                  className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100"
                >
                  Generate
                </button>
                <button
                  onClick={() => { void handleDelete(col.id); }}
                  disabled={deletingId === col.id}
                  className="rounded-lg px-2 py-1.5 text-xs text-red-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

