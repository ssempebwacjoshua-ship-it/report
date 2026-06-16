import { useEffect, useState } from "react";
import {
  fetchOwnerUsers,
  fetchOwnerSchools,
  createOwnerUser,
  ownerResetPassword,
  ownerDisableUser,
  ownerEnableUser,
  type OwnerUser,
  type OwnerSchool,
} from "../../client/ownerClient";

function Badge({ active }: { active: boolean }) {
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-bold ${active ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-500"}`}>
      {active ? "Active" : "Disabled"}
    </span>
  );
}

function formatDate(iso: string | null) {
  if (!iso) return "Never";
  return new Date(iso).toLocaleDateString("en-UG", { year: "numeric", month: "short", day: "numeric" });
}

export function OwnerUsersPage() {
  const [users, setUsers] = useState<OwnerUser[]>([]);
  const [schools, setSchools] = useState<OwnerSchool[]>([]);
  const [search, setSearch] = useState("");
  const [schoolFilter, setSchoolFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // Create user modal
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ schoolId: "", name: "", email: "", temporaryPassword: "" });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  // Reset password modal
  const [resetUserId, setResetUserId] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resetting, setResetting] = useState(false);

  async function loadUsers() {
    setLoading(true);
    try {
      const [usersRes, schoolsRes] = await Promise.all([
        fetchOwnerUsers({ search: search || undefined, schoolId: schoolFilter || undefined, isActive: statusFilter || undefined }),
        fetchOwnerSchools(),
      ]);
      setUsers(usersRes.users);
      setSchools(schoolsRes.schools);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not load users.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadUsers(); }, [search, schoolFilter, statusFilter]);

  async function handleCreate() {
    setCreateError("");
    setCreating(true);
    try {
      await createOwnerUser({ ...createForm, role: "ADMIN_OPERATOR" });
      setShowCreate(false);
      setCreateForm({ schoolId: "", name: "", email: "", temporaryPassword: "" });
      setNotice("User created successfully. They must change their password on first login.");
      void loadUsers();
    } catch (e: unknown) {
      setCreateError(e instanceof Error ? e.message : "Could not create user. Please check the details and try again.");
    } finally {
      setCreating(false);
    }
  }

  async function handleReset() {
    if (!resetUserId || resetPassword.length < 8) return;
    setResetting(true);
    try {
      await ownerResetPassword(resetUserId, resetPassword);
      setResetUserId(null);
      setResetPassword("");
      setNotice("Password reset link generated. User must change password on next login.");
      void loadUsers();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not reset password.");
    } finally {
      setResetting(false);
    }
  }

  async function handleToggle(userId: string, isActive: boolean) {
    try {
      if (isActive) await ownerDisableUser(userId);
      else await ownerEnableUser(userId);
      setNotice(isActive ? "User disabled successfully." : "User enabled successfully.");
      void loadUsers();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not update user status.");
    }
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-slate-950">Users</h2>
          <p className="text-sm text-slate-500">Manage users across all schools.</p>
        </div>
        <button
          type="button"
          onClick={() => { setShowCreate(true); setCreateError(""); }}
          className="btn btn-primary text-sm"
        >
          + Create user
        </button>
      </div>

      {notice && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800">
          {notice}
          <button type="button" className="ml-2 text-xs underline" onClick={() => setNotice("")}>dismiss</button>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
          <button type="button" className="ml-2 text-xs underline" onClick={() => setError("")}>dismiss</button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          type="search"
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input w-64 text-sm"
        />
        <select
          value={schoolFilter}
          onChange={(e) => setSchoolFilter(e.target.value)}
          className="input text-sm"
        >
          <option value="">All schools</option>
          {schools.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="input text-sm"
        >
          <option value="">All statuses</option>
          <option value="true">Active</option>
          <option value="false">Disabled</option>
        </select>
      </div>

      {/* Users table */}
      <section className="premium-card rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-6 text-center text-sm text-slate-400">Loading…</div>
        ) : users.length === 0 ? (
          <div className="p-6 text-center text-sm text-slate-400">No users found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left">Name</th>
                  <th className="px-4 py-3 text-left">Email</th>
                  <th className="px-4 py-3 text-left">School</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Last login</th>
                  <th className="px-4 py-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3 font-semibold text-slate-900">
                      {u.name}
                      {u.mustChangePassword && (
                        <span className="ml-1.5 inline-flex rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-xs text-amber-700">must change pw</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-slate-700">{u.school.name}</span>
                      <span className="ml-1 font-mono text-xs text-slate-400">({u.school.code})</span>
                    </td>
                    <td className="px-4 py-3"><Badge active={u.isActive} /></td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(u.lastLoginAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => { setResetUserId(u.id); setResetPassword(""); }}
                          className="text-xs font-semibold text-blue-600 hover:underline"
                        >
                          Reset pw
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleToggle(u.id, u.isActive)}
                          className={`text-xs font-semibold hover:underline ${u.isActive ? "text-red-600" : "text-emerald-600"}`}
                        >
                          {u.isActive ? "Disable" : "Enable"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Create user modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-black text-slate-900">Create user</h3>
              <button type="button" onClick={() => setShowCreate(false)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>
            {createError && <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{createError}</div>}
            <div className="grid gap-3">
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">School</label>
                <select
                  value={createForm.schoolId}
                  onChange={(e) => setCreateForm((f) => ({ ...f, schoolId: e.target.value }))}
                  className="input w-full text-sm"
                >
                  <option value="">Select a school…</option>
                  {schools.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">Full name</label>
                <input
                  type="text"
                  value={createForm.name}
                  onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                  className="input w-full text-sm"
                  placeholder="John Doe"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">Email address</label>
                <input
                  type="email"
                  value={createForm.email}
                  onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
                  className="input w-full text-sm"
                  placeholder="user@school.ac.ug"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-700">Temporary password</label>
                <input
                  type="text"
                  value={createForm.temporaryPassword}
                  onChange={(e) => setCreateForm((f) => ({ ...f, temporaryPassword: e.target.value }))}
                  className="input w-full text-sm font-mono"
                  placeholder="Min 8 characters"
                />
                <p className="mt-1 text-xs text-slate-400">User must change this on first login.</p>
              </div>
            </div>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => void handleCreate()}
                disabled={creating || !createForm.schoolId || !createForm.name || !createForm.email || createForm.temporaryPassword.length < 8}
                className="btn btn-primary flex-1 text-sm"
              >
                {creating ? "Creating…" : "Create user"}
              </button>
              <button type="button" onClick={() => setShowCreate(false)} className="btn flex-1 text-sm">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Reset password modal */}
      {resetUserId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-black text-slate-900">Reset password</h3>
              <button type="button" onClick={() => setResetUserId(null)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>
            <p className="mb-3 text-sm text-slate-600">Enter a new temporary password. The user must change it on next login.</p>
            <input
              type="text"
              value={resetPassword}
              onChange={(e) => setResetPassword(e.target.value)}
              className="input w-full font-mono text-sm"
              placeholder="Min 8 characters"
            />
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => void handleReset()}
                disabled={resetting || resetPassword.length < 8}
                className="btn btn-primary flex-1 text-sm"
              >
                {resetting ? "Resetting…" : "Set password"}
              </button>
              <button type="button" onClick={() => setResetUserId(null)} className="btn flex-1 text-sm">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
