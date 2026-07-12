import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import {
  changeStaffRole,
  createStaffUser,
  fetchStaffUsers,
  resendStaffInvitation,
  resetStaffPassword,
  setStaffStatus,
  STAFF_ROLE_LABELS,
  type StaffUser,
  type StaffUserRole,
} from "../client/staffUsersClient";

const ROLES: StaffUserRole[] = ["ADMIN_OPERATOR", "GATE_SECURITY", "SECURITY", "CANTEEN", "CASHIER"];

const inputClass =
  "premium-control h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none focus:border-blue-400 focus:bg-white";
const labelClass = "block text-xs font-medium text-slate-500 mb-1";

function roleBadge(role: string) {
  const colors: Record<string, string> = {
    ADMIN_OPERATOR: "bg-purple-100 text-purple-800",
    GATE_SECURITY: "bg-blue-100 text-blue-800",
    SECURITY: "bg-blue-100 text-blue-800",
    CANTEEN: "bg-amber-100 text-amber-800",
    CASHIER: "bg-amber-100 text-amber-800",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${colors[role] ?? "bg-slate-100 text-slate-700"}`}>
      {STAFF_ROLE_LABELS[role as StaffUserRole] ?? role}
    </span>
  );
}

function statusBadge(isActive: boolean) {
  return isActive ? (
    <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">Active</span>
  ) : (
    <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-800">Disabled</span>
  );
}

function formatDate(iso: string | null) {
  if (!iso) return "Never";
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

type Modal =
  | { type: "create" }
  | { type: "role"; user: StaffUser }
  | { type: "status"; user: StaffUser; action: "enable" | "disable" }
  | { type: "password"; user: StaffUser };

export function StaffUsersPage() {
  const { user: authUser } = useAuth();
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modal, setModal] = useState<Modal | null>(null);
  const [search, setSearch] = useState("");
  const [actionMessage, setActionMessage] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await fetchStaffUsers();
      setUsers(data.users);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load staff users.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const filtered = search.trim()
    ? users.filter((u) =>
        u.name.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase()) ||
        STAFF_ROLE_LABELS[u.role as StaffUserRole]?.toLowerCase().includes(search.toLowerCase()),
      )
    : users;

  return (
    <main className="grid gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Staff Users</h1>
          <p className="mt-0.5 text-sm text-slate-500">Manage operator accounts, roles, and access for gate and canteen staff.</p>
        </div>
        <button
          onClick={() => setModal({ type: "create" })}
          className="premium-control h-10 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 active:bg-blue-800"
        >
          + Add Staff
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-4">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, or role…"
            className={`${inputClass} max-w-sm`}
          />
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-slate-400">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">{search ? "No results." : "No staff users yet."}</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map((u) => (
              <div key={u.id} className={`flex items-start gap-4 px-4 py-4 ${!u.isActive ? "opacity-60" : ""}`}>
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-600">
                  {u.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-slate-900">{u.name}</span>
                    {roleBadge(u.role)}
                    {statusBadge(u.isActive)}
                    {u.mustChangePassword && (
                      <span className="inline-flex items-center rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-semibold text-orange-700">
                        Must change password
                      </span>
                    )}
                    {!u.isActive && (
                      <span className="inline-flex items-center rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-semibold text-sky-700">
                        Invitation pending
                      </span>
                    )}
                    {u.id === authUser?.id && (
                      <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-600">You</span>
                    )}
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500">{u.email} · Last login: {formatDate(u.lastLoginAt)} · Added: {formatDate(u.createdAt)}</div>
                </div>
                <div className="flex flex-shrink-0 flex-wrap gap-2">
                  {!u.isActive && (
                    <button
                      onClick={async () => {
                        setActionMessage("");
                        try {
                          const result = await resendStaffInvitation(u.id);
                          setActionMessage(result.invitationDeliveryStatus === "SENT" ? "Invitation sent." : "Invitation pending; email delivery failed or is not configured.");
                          await load();
                        } catch (e) {
                          setError(e instanceof Error ? e.message : "Could not resend invitation.");
                        }
                      }}
                      className="premium-control rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50"
                    >
                      Resend setup email
                    </button>
                  )}
                  <button
                    onClick={() => setModal({ type: "role", user: u })}
                    className="premium-control rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Change Role
                  </button>
                  <button
                    onClick={() => setModal({ type: "password", user: u })}
                    className="premium-control rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Reset Password
                  </button>
                  {u.id !== authUser?.id && (
                    <button
                      onClick={() =>
                        setModal({ type: "status", user: u, action: u.isActive ? "disable" : "enable" })
                      }
                      className={`premium-control rounded-lg border px-3 py-1.5 text-xs font-medium ${
                        u.isActive
                          ? "border-red-200 bg-white text-red-600 hover:bg-red-50"
                          : "border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50"
                      }`}
                    >
                      {u.isActive ? "Disable" : "Enable"}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {modal?.type === "create" && (
        <CreateModal
          onDone={() => { setModal(null); void load(); }}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === "role" && (
        <ChangeRoleModal
          user={modal.user}
          onDone={() => { setModal(null); void load(); }}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === "status" && (
        <StatusModal
          user={modal.user}
          action={modal.action}
          onDone={() => { setModal(null); void load(); }}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === "password" && (
        <ResetPasswordModal
          user={modal.user}
          onDone={() => { setModal(null); void load(); }}
          onClose={() => setModal(null)}
        />
      )}
      {actionMessage && <div className="fixed bottom-4 right-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-lg">{actionMessage}</div>}
    </main>
  );
}

function ModalShell({ title, subtitle, children, onClose }: { title: string; subtitle?: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="border-b border-slate-100 p-5">
          <h2 className="text-base font-bold text-slate-900">{title}</h2>
          {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
        </div>
        <div className="p-5">{children}</div>
        <button onClick={onClose} className="absolute right-4 top-4 text-slate-400 hover:text-slate-600" aria-label="Close">✕</button>
      </div>
    </div>
  );
}

function CreateModal({ onDone, onClose }: { onDone: () => void; onClose: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<StaffUserRole>("GATE_SECURITY");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await createStaffUser({ name, email, role });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create staff user.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ModalShell title="Invite Staff User" subtitle="A setup email will be sent so the staff member can set their password." onClose={onClose}>
      <form onSubmit={submit} className="grid gap-4">
        <div>
          <label className={labelClass}>Full Name</label>
          <input required className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. John Doe" />
        </div>
        <div>
          <label className={labelClass}>Email</label>
          <input required type="email" className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="staff@school.ac.ug" />
        </div>
        <div>
          <label className={labelClass}>Role</label>
          <select className={inputClass} value={role} onChange={(e) => setRole(e.target.value as StaffUserRole)}>
            {ROLES.map((r) => <option key={r} value={r}>{STAFF_ROLE_LABELS[r]}</option>)}
          </select>
        </div>
        {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="premium-control h-10 rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
          <button type="submit" disabled={loading} className="premium-control h-10 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
            {loading ? "Creating…" : "Create Staff User"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function ChangeRoleModal({ user, onDone, onClose }: { user: StaffUser; onDone: () => void; onClose: () => void }) {
  const [role, setRole] = useState<StaffUserRole>(user.role as StaffUserRole);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const result = await changeStaffRole(user.id, { role, reason });
      if (result.requiresRelogin) {
        window.location.href = "/logout";
        return;
      }
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to change role.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ModalShell title={`Change Role — ${user.name}`} subtitle="Changing a role immediately invalidates the user's active session." onClose={onClose}>
      <form onSubmit={submit} className="grid gap-4">
        <div>
          <label className={labelClass}>New Role</label>
          <select className={inputClass} value={role} onChange={(e) => setRole(e.target.value as StaffUserRole)}>
            {ROLES.map((r) => <option key={r} value={r}>{STAFF_ROLE_LABELS[r]}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>Reason</label>
          <input required className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Promoted to Admin" />
        </div>
        {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="premium-control h-10 rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
          <button type="submit" disabled={loading || role === user.role} className="premium-control h-10 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
            {loading ? "Saving…" : "Change Role"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function StatusModal({ user, action, onDone, onClose }: { user: StaffUser; action: "enable" | "disable"; onDone: () => void; onClose: () => void }) {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await setStaffStatus(user.id, { isActive: action === "enable", reason });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update status.");
    } finally {
      setLoading(false);
    }
  }

  const isDisabling = action === "disable";
  return (
    <ModalShell
      title={isDisabling ? `Disable Account — ${user.name}` : `Enable Account — ${user.name}`}
      subtitle={isDisabling ? "The user will be logged out immediately and cannot log in until re-enabled." : "The user will be able to log in again."}
      onClose={onClose}
    >
      <form onSubmit={submit} className="grid gap-4">
        <div>
          <label className={labelClass}>Reason</label>
          <input required className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={isDisabling ? "e.g. Staff member left" : "e.g. Resolved issue"} />
        </div>
        {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="premium-control h-10 rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
          <button
            type="submit"
            disabled={loading}
            className={`premium-control h-10 rounded-xl px-4 text-sm font-semibold text-white disabled:opacity-50 ${isDisabling ? "bg-red-600 hover:bg-red-700" : "bg-emerald-600 hover:bg-emerald-700"}`}
          >
            {loading ? "Saving…" : isDisabling ? "Disable Account" : "Enable Account"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function ResetPasswordModal({ user, onDone, onClose }: { user: StaffUser; onDone: () => void; onClose: () => void }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) { setError("Passwords do not match."); return; }
    setLoading(true);
    setError("");
    try {
      await resetStaffPassword(user.id, { temporaryPassword: password, reason });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to reset password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ModalShell title={`Reset Password — ${user.name}`} subtitle="A temporary password will be set. The user must change it on next login." onClose={onClose}>
      <form onSubmit={submit} className="grid gap-4">
        <div>
          <label className={labelClass}>New Temporary Password</label>
          <input required type="password" className={inputClass} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 4 characters" minLength={4} />
        </div>
        <div>
          <label className={labelClass}>Confirm Password</label>
          <input required type="password" className={inputClass} value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Repeat password" minLength={4} />
        </div>
        <div>
          <label className={labelClass}>Reason</label>
          <input required className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Staff forgot password" />
        </div>
        {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="premium-control h-10 rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
          <button type="submit" disabled={loading} className="premium-control h-10 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
            {loading ? "Resetting…" : "Reset Password"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
