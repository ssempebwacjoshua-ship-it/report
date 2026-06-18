import { useEffect, useState } from "react";
import {
  fetchOwnerSchools,
  createOwnerSchool,
  patchOwnerSchool,
  type OwnerSchool,
  type CreateOwnerSchoolResult,
} from "../../client/ownerClient";
import { REPORT_LAB_PLANS } from "../../shared/constants/subscriptionPlans";

const SECTIONS = ["NURSERY", "PRIMARY", "SECONDARY"] as const;
type Section = (typeof SECTIONS)[number];

const LOGIN_URL = `${window.location.origin}/login`;

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, string> = {
    ACTIVE: "border-emerald-200 bg-emerald-50 text-emerald-700",
    TRIAL: "border-blue-200 bg-blue-50 text-blue-700",
    EXPIRED: "border-red-200 bg-red-50 text-red-700",
    SUSPENDED: "border-slate-200 bg-slate-50 text-slate-500",
    PENDING: "border-amber-200 bg-amber-50 text-amber-700",
  };
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-bold ${variants[status] ?? "border-slate-200 bg-slate-50 text-slate-500"}`}>
      {status}
    </span>
  );
}

function SchoolBadge({ active }: { active: boolean }) {
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-bold ${active ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-600"}`}>
      {active ? "Active" : "Disabled"}
    </span>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-UG", { year: "numeric", month: "short", day: "numeric" });
}

function formatUgx(n: number) {
  return `UGX ${n.toLocaleString("en-UG")}`;
}

const defaultForm = {
  schoolName: "",
  schoolCode: "",
  phone: "",
  address: "",
  sections: ["PRIMARY"] as Section[],
  planCode: "REPORT_LAB_500",
  trialDays: "30",
  adminName: "",
  adminEmail: "",
  adminTemporaryPassword: "",
};

export function OwnerSchoolsPage() {
  const [schools, setSchools] = useState<OwnerSchool[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ ...defaultForm });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [creationResult, setCreationResult] = useState<CreateOwnerSchoolResult | null>(null);

  async function loadSchools() {
    setLoading(true);
    try {
      const res = await fetchOwnerSchools();
      setSchools(res.schools);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not load schools.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadSchools(); }, []);

  function toggleSection(s: Section) {
    setForm((f) => ({
      ...f,
      sections: f.sections.includes(s) ? f.sections.filter((x) => x !== s) : [...f.sections, s],
    }));
  }

  async function handleCreate() {
    setCreateError("");
    setCreating(true);
    try {
      const trialDays = form.trialDays.trim() ? parseInt(form.trialDays, 10) : 0;
      const result = await createOwnerSchool({
        schoolName: form.schoolName.trim(),
        schoolCode: form.schoolCode.trim().toUpperCase(),
        phone: form.phone.trim() || undefined,
        address: form.address.trim() || undefined,
        sections: form.sections,
        planCode: form.planCode,
        trialDays: trialDays > 0 ? trialDays : undefined,
        adminName: form.adminName.trim(),
        adminEmail: form.adminEmail.trim(),
        adminTemporaryPassword: form.adminTemporaryPassword,
      });
      setCreationResult(result);
      void loadSchools();
    } catch (e: unknown) {
      setCreateError(e instanceof Error ? e.message : "Could not create school.");
    } finally {
      setCreating(false);
    }
  }

  function closeModal() {
    setShowCreate(false);
    setForm({ ...defaultForm });
    setCreationResult(null);
    setCreateError("");
  }

  async function handleToggle(school: OwnerSchool) {
    try {
      await patchOwnerSchool(school.id, { isActive: !school.isActive });
      setNotice(school.isActive ? `${school.name} disabled.` : `${school.name} enabled.`);
      void loadSchools();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not update school.");
    }
  }

  const selectedPlan = REPORT_LAB_PLANS.find((p) => p.code === form.planCode);

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-slate-950">Schools</h2>
          <p className="text-sm text-slate-500">Manage all onboarded schools and their subscriptions.</p>
        </div>
        <button type="button" onClick={() => setShowCreate(true)} className="btn btn-primary text-sm">
          + Create school
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

      <section className="premium-card rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-6 text-center text-sm text-slate-400">Loadingâ€¦</div>
        ) : schools.length === 0 ? (
          <div className="p-6 text-center text-sm text-slate-400">No schools yet. Create one above.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left">School</th>
                  <th className="px-4 py-3 text-left">Plan</th>
                  <th className="px-4 py-3 text-left">Subscription</th>
                  <th className="px-4 py-3 text-left">Students</th>
                  <th className="px-4 py-3 text-left">Admin</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Created</th>
                  <th className="px-4 py-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {schools.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3">
                      <span className="font-semibold text-slate-900">{s.name}</span>
                      <span className="ml-1.5 font-mono text-xs text-slate-400">({s.code})</span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{s.subscription?.planCode ?? "â€”"}</td>
                    <td className="px-4 py-3">
                      {s.subscription ? (
                        <StatusBadge status={s.subscription.status} />
                      ) : (
                        <span className="text-xs text-slate-400">No subscription</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{s.studentCount}</td>
                    <td className="px-4 py-3 text-slate-600 text-xs">{s.primaryAdmin?.email ?? "â€”"}</td>
                    <td className="px-4 py-3"><SchoolBadge active={s.isActive} /></td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{formatDate(s.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => void handleToggle(s)}
                          className={`text-xs font-semibold hover:underline ${s.isActive ? "text-red-600" : "text-emerald-600"}`}
                        >
                          {s.isActive ? "Disable" : "Enable"}
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

      {/* Create school modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 py-8">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            {creationResult ? (
              /* â”€â”€ Success panel â”€â”€ */
              <div className="grid gap-4">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-lg">âœ“</span>
                  <h3 className="text-base font-black text-slate-900">School created successfully</h3>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 font-mono text-sm grid gap-2">
                  <div className="flex justify-between">
                    <span className="text-slate-500">School Code</span>
                    <span className="font-bold text-slate-900">{creationResult.school.code}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Admin Email</span>
                    <span className="font-bold text-slate-900">{creationResult.admin.email}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Login URL</span>
                    <span className="text-blue-600 text-xs break-all">{LOGIN_URL}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Plan</span>
                    <span className="font-bold text-slate-900">{creationResult.subscription.planCode}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Status</span>
                    <StatusBadge status={creationResult.subscription.status} />
                  </div>
                  {creationResult.subscription.status === "TRIAL" && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Trial ends</span>
                      <span className="font-bold text-slate-900">{formatDate(creationResult.subscription.currentPeriodEnd)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-slate-500">Invoice</span>
                    <span className="font-bold text-slate-900">{formatUgx(creationResult.invoice.totalUgx)} ({creationResult.invoice.status})</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Classes seeded</span>
                    <span className="font-bold text-slate-900">{creationResult.classesSeeded}</span>
                  </div>
                </div>
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Share the school code and admin email with the school. The temporary password was set during creation and will not be shown again. The admin must change it on first login.
                </p>
                <button type="button" onClick={closeModal} className="btn btn-primary w-full">Done</button>
              </div>
            ) : (
              /* â”€â”€ Create form â”€â”€ */
              <>
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-base font-black text-slate-900">Create school</h3>
                  <button type="button" onClick={closeModal} className="text-slate-400 hover:text-slate-700">âœ•</button>
                </div>
                {createError && (
                  <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{createError}</div>
                )}
                <div className="grid gap-4 max-h-[60vh] overflow-y-auto pr-1">
                  {/* School identity */}
                  <fieldset>
                    <legend className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">School</legend>
                    <div className="grid gap-3">
                      <div>
                        <label className="mb-1 block text-xs font-bold text-slate-700">School name</label>
                        <input type="text" value={form.schoolName} onChange={(e) => setForm((f) => ({ ...f, schoolName: e.target.value }))} className="input w-full text-sm" placeholder="St. Julian Primary School" />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-bold text-slate-700">School code</label>
                        <input
                          type="text"
                          value={form.schoolCode}
                          onChange={(e) => setForm((f) => ({ ...f, schoolCode: e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "") }))}
                          className="input w-full text-sm font-mono uppercase"
                          placeholder="STJULIAN"
                          maxLength={50}
                        />
                        <p className="mt-1 text-xs text-slate-400">Uppercase letters, digits, hyphens only. Used to log in.</p>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-bold text-slate-700">Phone / contact <span className="font-normal text-slate-400">(optional)</span></label>
                        <input type="text" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} className="input w-full text-sm" placeholder="+256 700 000 000" />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-bold text-slate-700">Address <span className="font-normal text-slate-400">(optional)</span></label>
                        <input type="text" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} className="input w-full text-sm" placeholder="Kampala, Uganda" />
                      </div>
                    </div>
                  </fieldset>

                  {/* Sections */}
                  <fieldset>
                    <legend className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">Sections</legend>
                    <div className="flex gap-3">
                      {SECTIONS.map((s) => (
                        <label key={s} className="flex cursor-pointer items-center gap-1.5 text-sm font-semibold text-slate-700">
                          <input
                            type="checkbox"
                            checked={form.sections.includes(s)}
                            onChange={() => toggleSection(s)}
                            className="h-4 w-4 rounded border-slate-300 accent-blue-600"
                          />
                          {s}
                        </label>
                      ))}
                    </div>
                  </fieldset>

                  {/* Subscription */}
                  <fieldset>
                    <legend className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">Subscription</legend>
                    <div className="grid gap-3">
                      <div>
                        <label className="mb-1 block text-xs font-bold text-slate-700">Plan</label>
                        <select value={form.planCode} onChange={(e) => setForm((f) => ({ ...f, planCode: e.target.value }))} className="input w-full text-sm">
                          {REPORT_LAB_PLANS.map((p) => (
                            <option key={p.code} value={p.code}>{p.name} â€” {p.code}</option>
                          ))}
                        </select>
                        {selectedPlan && selectedPlan.setupFeeUgx !== null && (
                          <p className="mt-1 text-xs text-slate-400">
                            Setup: {formatUgx(selectedPlan.setupFeeUgx)} Â· Annual: {formatUgx(selectedPlan.annualLicenseUgx ?? 0)} Â· Total: {formatUgx((selectedPlan.setupFeeUgx ?? 0) + (selectedPlan.annualLicenseUgx ?? 0))}
                          </p>
                        )}
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-bold text-slate-700">Trial days <span className="font-normal text-slate-400">(0 = no trial, start active)</span></label>
                        <input type="number" min="0" max="365" value={form.trialDays} onChange={(e) => setForm((f) => ({ ...f, trialDays: e.target.value }))} className="input w-full text-sm" placeholder="30" />
                      </div>
                    </div>
                  </fieldset>

                  {/* Admin user */}
                  <fieldset>
                    <legend className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">Primary admin</legend>
                    <div className="grid gap-3">
                      <div>
                        <label className="mb-1 block text-xs font-bold text-slate-700">Admin name</label>
                        <input type="text" value={form.adminName} onChange={(e) => setForm((f) => ({ ...f, adminName: e.target.value }))} className="input w-full text-sm" placeholder="John Doe" />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-bold text-slate-700">Admin email</label>
                        <input type="email" value={form.adminEmail} onChange={(e) => setForm((f) => ({ ...f, adminEmail: e.target.value }))} className="input w-full text-sm" placeholder="admin@stjulian.ac.ug" />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-bold text-slate-700">Temporary password</label>
                        <input type="text" value={form.adminTemporaryPassword} onChange={(e) => setForm((f) => ({ ...f, adminTemporaryPassword: e.target.value }))} className="input w-full text-sm font-mono" placeholder="Min 8 characters" />
                        <p className="mt-1 text-xs text-slate-400">Admin must change this on first login.</p>
                      </div>
                    </div>
                  </fieldset>
                </div>

                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={() => void handleCreate()}
                    disabled={
                      creating ||
                      !form.schoolName.trim() ||
                      !form.schoolCode.trim() ||
                      form.sections.length === 0 ||
                      !form.adminName.trim() ||
                      !form.adminEmail.trim() ||
                      form.adminTemporaryPassword.length < 8
                    }
                    className="btn btn-primary flex-1 text-sm"
                  >
                    {creating ? "Creating schoolâ€¦" : "Create school"}
                  </button>
                  <button type="button" onClick={closeModal} className="btn flex-1 text-sm">Cancel</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

