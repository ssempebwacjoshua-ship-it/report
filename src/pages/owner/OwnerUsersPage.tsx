import { type ReactNode, useEffect, useMemo, useState } from "react";
import {
  createOwnerUser,
  fetchOwnerSchools,
  fetchOwnerUsers,
  ownerDisableUser,
  ownerEnableUser,
  ownerResetPassword,
  type OwnerSchool,
  type OwnerUser,
} from "../../client/ownerClient";

function Badge({ active }: { active: boolean }) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold ${active ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-500"}`}>
      {active ? "Active" : "Disabled"}
    </span>
  );
}

function formatDate(iso: string | null) {
  if (!iso) return "Never";
  return new Date(iso).toLocaleDateString("en-UG", { year: "numeric", month: "short", day: "numeric" });
}

function UserCard({ user, onReset, onToggle }: { user: OwnerUser; onReset: (id: string) => void; onToggle: (user: OwnerUser) => void }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="line-clamp-2 text-sm font-black leading-snug text-slate-950">{user.name}</p>
          <p className="mt-1 break-words text-xs text-slate-500">{user.email}</p>
        </div>
        <Badge active={user.isActive} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Detail label="School" value={`${user.school.name} (${user.school.code})`} />
        <Detail label="Last login" value={formatDate(user.lastLoginAt)} />
        <Detail label="Password" value={user.mustChangePassword ? "Must change" : "Ready"} />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={() => onReset(user.id)} className="rounded-xl bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700">
          Reset pw
        </button>
        <button type="button" onClick={() => onToggle(user)} className={`rounded-xl px-3 py-2 text-xs font-bold ${user.isActive ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>
          {user.isActive ? "Disable" : "Enable"}
        </button>
      </div>
    </article>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-0.5 break-words text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
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
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ schoolId: "", name: "", email: "", temporaryPassword: "" });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
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

  async function handleToggle(user: OwnerUser) {
    try {
      if (user.isActive) await ownerDisableUser(user.id);
      else await ownerEnableUser(user.id);
      setNotice(user.isActive ? "User disabled successfully." : "User enabled successfully.");
      void loadUsers();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not update user status.");
    }
  }

  const filteredUsers = useMemo(() => users, [users]);

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">Owner Console</p>
          <h2 className="text-2xl font-black tracking-tight text-slate-950">Users</h2>
          <p className="text-sm text-slate-500">Manage users across all schools.</p>
        </div>
        <button type="button" onClick={() => { setShowCreate(true); setCreateError(""); }} className="rounded-full bg-blue-600 px-4 py-2 text-sm font-black text-white shadow-sm hover:bg-blue-700">
          + Create user
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Users" value={filteredUsers.length} />
        <StatCard label="Active" value={filteredUsers.filter((user) => user.isActive).length} />
        <StatCard label="Disabled" value={filteredUsers.filter((user) => !user.isActive).length} />
        <StatCard label="Schools" value={schools.length} />
      </div>

      {notice ? <Banner tone="success" message={notice} onDismiss={() => setNotice("")} /> : null}
      {error ? <Banner tone="error" message={error} onDismiss={() => setError("")} /> : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap gap-3">
          <input
            type="search"
            placeholder="Search by name or email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 sm:w-64"
          />
          <select value={schoolFilter} onChange={(e) => setSchoolFilter(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400">
            <option value="">All schools</option>
            {schools.map((school) => <option key={school.id} value={school.id}>{school.name} ({school.code})</option>)}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400">
            <option value="">All statuses</option>
            <option value="true">Active</option>
            <option value="false">Disabled</option>
          </select>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        {loading ? (
          <div className="p-6 text-center text-sm text-slate-400">Loading users...</div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-6 text-center text-sm text-slate-400">No users found.</div>
        ) : (
          <>
            <div className="grid gap-3 md:hidden">
              {filteredUsers.map((user) => (
                <UserCard key={user.id} user={user} onReset={(id) => { setResetUserId(id); setResetPassword(""); }} onToggle={(item) => void handleToggle(item)} />
              ))}
            </div>

            <div className="hidden overflow-hidden rounded-2xl border border-slate-200 md:block">
              <div className="max-h-[42rem] overflow-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
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
                    {filteredUsers.map((user) => (
                      <tr key={user.id} className="hover:bg-slate-50/50">
                        <td className="max-w-[18rem] px-4 py-3">
                          <p className="line-clamp-2 font-semibold text-slate-900">{user.name}</p>
                          {user.mustChangePassword ? <span className="mt-1 inline-flex rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-xs text-amber-700">must change pw</span> : null}
                        </td>
                        <td className="max-w-[18rem] px-4 py-3 truncate text-slate-600">{user.email}</td>
                        <td className="max-w-[16rem] px-4 py-3">
                          <p className="truncate font-medium text-slate-700">{user.school.name}</p>
                          <p className="font-mono text-xs text-slate-400">{user.school.code}</p>
                        </td>
                        <td className="px-4 py-3"><Badge active={user.isActive} /></td>
                        <td className="px-4 py-3 whitespace-nowrap text-slate-500">{formatDate(user.lastLoginAt)}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button type="button" onClick={() => { setResetUserId(user.id); setResetPassword(""); }} className="text-xs font-semibold text-blue-600 hover:underline">
                              Reset pw
                            </button>
                            <button type="button" onClick={() => void handleToggle(user)} className={`text-xs font-semibold hover:underline ${user.isActive ? "text-red-600" : "text-emerald-600"}`}>
                              {user.isActive ? "Disable" : "Enable"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </section>

      {showCreate ? (
        <Modal title="Create user" onClose={() => setShowCreate(false)}>
          {createError ? <Banner tone="error" message={createError} onDismiss={() => setCreateError("")} /> : null}
          <div className="grid gap-3">
            <select value={createForm.schoolId} onChange={(e) => setCreateForm((f) => ({ ...f, schoolId: e.target.value }))} className="input w-full text-sm">
              <option value="">Select a school</option>
              {schools.map((school) => <option key={school.id} value={school.id}>{school.name} ({school.code})</option>)}
            </select>
            <input type="text" value={createForm.name} onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))} className="input w-full text-sm" placeholder="Full name" />
            <input type="email" value={createForm.email} onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))} className="input w-full text-sm" placeholder="user@school.ac.ug" />
            <input type="text" value={createForm.temporaryPassword} onChange={(e) => setCreateForm((f) => ({ ...f, temporaryPassword: e.target.value }))} className="input w-full text-sm font-mono" placeholder="Min 8 characters" />
          </div>
          <div className="mt-5 flex gap-2">
            <button type="button" onClick={() => void handleCreate()} disabled={creating || !createForm.schoolId || !createForm.name || !createForm.email || createForm.temporaryPassword.length < 8} className="btn btn-primary flex-1 text-sm">
              {creating ? "Creating..." : "Create user"}
            </button>
            <button type="button" onClick={() => setShowCreate(false)} className="btn flex-1 text-sm">Cancel</button>
          </div>
        </Modal>
      ) : null}

      {resetUserId ? (
        <Modal title="Reset password" onClose={() => setResetUserId(null)}>
          <p className="mb-3 text-sm text-slate-600">Enter a new temporary password. The user must change it on next login.</p>
          <input
            type="text"
            value={resetPassword}
            onChange={(e) => setResetPassword(e.target.value)}
            className="input w-full font-mono text-sm"
            placeholder="Min 8 characters"
          />
          <div className="mt-4 flex gap-2">
            <button type="button" onClick={() => void handleReset()} disabled={resetting || resetPassword.length < 8} className="btn btn-primary flex-1 text-sm">
              {resetting ? "Resetting..." : "Set password"}
            </button>
            <button type="button" onClick={() => setResetUserId(null)} className="btn flex-1 text-sm">Cancel</button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-black tracking-tight text-slate-950">{value}</p>
    </div>
  );
}

function Banner({ message, tone, onDismiss }: { message: string; tone: "success" | "error"; onDismiss: () => void }) {
  const classes = tone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-700";
  return (
    <div className={`rounded-2xl border px-4 py-3 text-sm ${classes}`}>
      {message}
      <button type="button" className="ml-2 text-xs underline" onClick={onDismiss}>dismiss</button>
    </div>
  );
}

function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div className="max-h-[90vh] w-full overflow-y-auto rounded-t-2xl bg-white p-4 shadow-2xl sm:max-w-md sm:rounded-2xl sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-black text-slate-900">{title}</h3>
          <button type="button" onClick={onClose} className="rounded-full border border-slate-200 px-3 py-1 text-sm text-slate-500">Close</button>
        </div>
        {children}
      </div>
    </div>
  );
}
