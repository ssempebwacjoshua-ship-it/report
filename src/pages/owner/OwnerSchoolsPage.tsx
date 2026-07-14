import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import {
  createOwnerSchool,
  fetchOwnerSchools,
  fetchOwnerSchoolConsole,
  ownerResetMfa,
  ownerResetPasswordAdvanced,
  ownerTerminateUserSessions,
  ownerUnlockUser,
  patchOwnerSchool,
  requestOwnerMaintenance,
  requestOwnerReaderAction,
  rotateOwnerReaderToken,
  startOwnerSupportSession,
  updateOwnerFeatureFlags,
  updateOwnerSchoolDetails,
  updateOwnerSubscription,
  type CreateOwnerSchoolResult,
  type OwnerFeatureFlag,
  type OwnerSchool,
  type OwnerSchoolConsole,
} from "../../client/ownerClient";
import { REPORT_LAB_PLANS } from "../../shared/constants/subscriptionPlans";

const SECTIONS = ["NURSERY", "PRIMARY", "SECONDARY"] as const;
type Section = (typeof SECTIONS)[number];
const STREAM_CODES = ["A", "B", "C", "D"] as const;
type StreamCode = (typeof STREAM_CODES)[number];
const MIN_ADMIN_TEMP_PASSWORD_LENGTH = 10;

const LOGIN_URL = `${window.location.origin}/login`;

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-UG", { year: "numeric", month: "short", day: "numeric" });
}

function formatUgx(n: number) {
  return `UGX ${n.toLocaleString("en-UG")}`;
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, string> = {
    ACTIVE: "border-emerald-200 bg-emerald-50 text-emerald-700",
    TRIAL: "border-blue-200 bg-blue-50 text-blue-700",
    EXPIRED: "border-red-200 bg-red-50 text-red-700",
    SUSPENDED: "border-slate-200 bg-slate-50 text-slate-500",
    PENDING: "border-amber-200 bg-amber-50 text-amber-700",
  };
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold ${variants[status] ?? "border-slate-200 bg-slate-50 text-slate-500"}`}>{status}</span>;
}

function SchoolBadge({ active }: { active: boolean }) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold ${active ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-600"}`}>
      {active ? "Active" : "Disabled"}
    </span>
  );
}

function PlanBadge({ plan }: { plan: string }) {
  return (
    <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-700">
      {plan}
    </span>
  );
}

type SchoolAction =
  | "view"
  | "users"
  | "reset-password"
  | "unlock"
  | "support"
  | "readers"
  | "subscription"
  | "health"
  | "features"
  | "api-keys"
  | "audit"
  | "toggle";

const ACTION_LABELS: Record<SchoolAction, string> = {
  view: "View School",
  users: "Manage Users",
  "reset-password": "Reset Password",
  unlock: "Unlock Account",
  support: "Support Session",
  readers: "Manage Readers",
  subscription: "Subscription",
  health: "Health",
  features: "Feature Flags",
  "api-keys": "API Keys",
  audit: "Audit Log",
  toggle: "Disable School",
};

function ActionsMenu({ school, onAction }: { school: OwnerSchool; onAction: (school: OwnerSchool, action: SchoolAction) => void }) {
  return (
    <details className="relative">
      <summary className="list-none rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-black text-blue-700 hover:bg-blue-100">
        Actions
      </summary>
      <div className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-2xl border border-slate-200 bg-white p-1 shadow-xl">
        {(Object.keys(ACTION_LABELS) as SchoolAction[]).map((action) => (
          <button
            key={action}
            type="button"
            onClick={() => onAction(school, action)}
            className={`block w-full rounded-xl px-3 py-2 text-left text-xs font-bold hover:bg-slate-50 ${action === "toggle" ? "text-red-600" : "text-slate-700"}`}
          >
            {action === "toggle" ? (school.isActive ? "Disable School" : "Enable School") : ACTION_LABELS[action]}
          </button>
        ))}
      </div>
    </details>
  );
}

function SchoolCard({ school, onAction }: { school: OwnerSchool; onAction: (school: OwnerSchool, action: SchoolAction) => void }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="line-clamp-2 text-sm font-black leading-snug text-slate-950">{school.name}</p>
          <p className="mt-1 font-mono text-xs text-slate-400">{school.code}</p>
        </div>
        <SchoolBadge active={school.isActive} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <PlanBadge plan={school.subscription?.planCode ?? "NO PLAN"} />
        {school.subscription ? <StatusBadge status={school.subscription.status} /> : <StatusBadge status="PENDING" />}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <div className="rounded-xl bg-slate-50 px-3 py-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Students</p>
          <p className="mt-0.5 text-sm font-semibold text-slate-900">{school.studentCount}</p>
        </div>
        <div className="rounded-xl bg-slate-50 px-3 py-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Admin</p>
          <p className="mt-0.5 break-words text-sm font-semibold text-slate-900">{school.primaryAdmin?.email ?? "-"}</p>
        </div>
        <div className="rounded-xl bg-slate-50 px-3 py-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Created</p>
          <p className="mt-0.5 text-sm font-semibold text-slate-900">{formatDate(school.createdAt)}</p>
        </div>
      </div>
      <div className="mt-3 flex justify-end">
        <ActionsMenu school={school} onAction={onAction} />
      </div>
    </article>
  );
}

export function OwnerSchoolsPage() {
  const [schools, setSchools] = useState<OwnerSchool[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    schoolName: "",
    schoolCode: "",
    phone: "",
    address: "",
    sections: ["PRIMARY"] as Section[],
    defaultStreamCodes: ["A"] as StreamCode[],
    planCode: "REPORT_LAB_500",
    trialDays: "30",
    adminName: "",
    adminEmail: "",
    adminTemporaryPassword: "",
  });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [creationResult, setCreationResult] = useState<CreateOwnerSchoolResult | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedSchool, setSelectedSchool] = useState<OwnerSchool | null>(null);
  const [selectedSection, setSelectedSection] = useState<SchoolAction>("view");
  const [consoleData, setConsoleData] = useState<OwnerSchoolConsole | null>(null);
  const [consoleLoading, setConsoleLoading] = useState(false);
  const [consoleError, setConsoleError] = useState("");
  const [oneTimeSecret, setOneTimeSecret] = useState("");

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

  function toggleStreamCode(code: StreamCode) {
    setForm((f) => ({
      ...f,
      defaultStreamCodes: f.defaultStreamCodes.includes(code)
        ? f.defaultStreamCodes.filter((value) => value !== code)
        : [...f.defaultStreamCodes, code],
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
        defaultStreamCodes: form.defaultStreamCodes,
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
    setForm({
      schoolName: "",
      schoolCode: "",
      phone: "",
      address: "",
      sections: ["PRIMARY"],
      defaultStreamCodes: ["A"],
      planCode: "REPORT_LAB_500",
      trialDays: "30",
      adminName: "",
      adminEmail: "",
      adminTemporaryPassword: "",
    });
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

  async function loadSchoolConsole(school: OwnerSchool, section: SchoolAction = "view") {
    setSelectedSchool(school);
    setSelectedSection(section === "toggle" ? "view" : section);
    setConsoleLoading(true);
    setConsoleError("");
    setOneTimeSecret("");
    try {
      setConsoleData(await fetchOwnerSchoolConsole(school.id));
    } catch (e: unknown) {
      setConsoleError(e instanceof Error ? e.message : "Could not load school console.");
    } finally {
      setConsoleLoading(false);
    }
  }

  async function handleSchoolAction(school: OwnerSchool, action: SchoolAction) {
    if (action === "toggle") {
      await handleToggle(school);
      return;
    }
    await loadSchoolConsole(school, action);
  }

  async function refreshSelectedConsole() {
    if (selectedSchool) await loadSchoolConsole(selectedSchool, selectedSection);
  }

  const selectedPlan = useMemo(() => REPORT_LAB_PLANS.find((p) => p.code === form.planCode), [form.planCode]);
  const filteredSchools = useMemo(() => {
    const q = search.trim().toLowerCase();
    return schools.filter((school) => {
      const matchesQuery = !q || [school.name, school.code, school.primaryAdmin?.email, school.primaryAdmin?.name]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q));
      const matchesStatus = !statusFilter || (statusFilter === "active" ? school.isActive : !school.isActive);
      return matchesQuery && matchesStatus;
    });
  }, [schools, search, statusFilter]);

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">Owner Console</p>
          <h2 className="text-2xl font-black tracking-tight text-slate-950">Schools</h2>
          <p className="text-sm text-slate-500">Manage all onboarded schools and subscriptions.</p>
        </div>
        <button type="button" onClick={() => setShowCreate(true)} className="rounded-full bg-blue-600 px-4 py-2 text-sm font-black text-white shadow-sm hover:bg-blue-700">
          + Create school
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Schools" value={filteredSchools.length} />
        <StatCard label="Active" value={filteredSchools.filter((school) => school.isActive).length} />
        <StatCard label="Disabled" value={filteredSchools.filter((school) => !school.isActive).length} />
        <StatCard label="Plans" value={new Set(filteredSchools.map((school) => school.subscription?.planCode ?? "NONE")).size} />
      </div>

      {notice ? <NoticeBanner tone="success" message={notice} onDismiss={() => setNotice("")} /> : null}
      {error ? <NoticeBanner tone="error" message={error} onDismiss={() => setError("")} /> : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap gap-2">
          <input
            type="search"
            placeholder="Search school / admin"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 sm:w-72"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400"
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="disabled">Disabled</option>
          </select>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        {loading ? (
          <div className="p-6 text-center text-sm text-slate-400">Loading schools...</div>
        ) : filteredSchools.length === 0 ? (
          <div className="p-6 text-center text-sm text-slate-400">No schools yet. Create one above.</div>
        ) : (
          <>
            <div className="grid gap-3 md:hidden">
              {filteredSchools.map((school) => (
                <SchoolCard key={school.id} school={school} onAction={(item, action) => { void handleSchoolAction(item, action); }} />
              ))}
            </div>

            <div className="hidden overflow-hidden rounded-2xl border border-slate-200 md:block">
              <div className="max-h-[42rem] overflow-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
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
                    {filteredSchools.map((school) => (
                      <tr key={school.id} className="hover:bg-slate-50/50">
                        <td className="max-w-[20rem] px-4 py-3">
                          <p className="line-clamp-2 font-semibold text-slate-900">{school.name}</p>
                          <p className="mt-0.5 font-mono text-xs text-slate-400">{school.code}</p>
                        </td>
                        <td className="px-4 py-3"><PlanBadge plan={school.subscription?.planCode ?? "NO PLAN"} /></td>
                        <td className="px-4 py-3">{school.subscription ? <StatusBadge status={school.subscription.status} /> : <span className="text-xs text-slate-400">No subscription</span>}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-slate-600">{school.studentCount}</td>
                        <td className="max-w-[16rem] px-4 py-3 truncate text-slate-600">{school.primaryAdmin?.email ?? "?"}</td>
                        <td className="px-4 py-3"><SchoolBadge active={school.isActive} /></td>
                        <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-500">{formatDate(school.createdAt)}</td>
                        <td className="px-4 py-3">
                          <ActionsMenu school={school} onAction={(item, action) => { void handleSchoolAction(item, action); }} />
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
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
          <div className="max-h-[90vh] w-full overflow-y-auto rounded-t-2xl bg-white p-4 shadow-2xl sm:max-w-lg sm:rounded-2xl sm:p-6">
            {creationResult ? (
              <div className="grid gap-4">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-lg text-emerald-700">✓</span>
                  <h3 className="text-base font-black text-slate-900">School created successfully</h3>
                </div>
                <div className="grid gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
                  <InfoRow label="School code" value={creationResult.school.code} />
                  <InfoRow label="Admin email" value={creationResult.admin.email} />
                  <InfoRow label="Login URL" value={LOGIN_URL} strong={false} mono />
                  <InfoRow label="Sections" value={creationResult.settings.schoolSections.join(", ")} />
                  <InfoRow label="Streams" value={creationResult.settings.defaultStreamCodes.join(", ")} />
                  <InfoRow label="Plan" value={creationResult.subscription.planCode} />
                  <InfoRow label="Status" value={creationResult.subscription.status} />
                  {creationResult.subscription.status === "TRIAL" ? <InfoRow label="Trial ends" value={formatDate(creationResult.subscription.currentPeriodEnd)} /> : null}
                  <InfoRow label="Invoice" value={`${formatUgx(creationResult.invoice.totalUgx)} (${creationResult.invoice.status})`} />
                  <InfoRow label="Classes seeded" value={`${creationResult.classesSeeded}`} />
                  <InfoRow label="Streams seeded" value={`${creationResult.streamsSeeded}`} />
                  <InfoRow label="Branding" value="Platform defaults applied" />
                </div>
                <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
                  Share the school code and admin email with the school. The temporary password was set during creation and will not be shown again.
                </p>
                <p className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs leading-5 text-blue-800">
                  Branding stays on platform defaults for the new school until it is centrally updated. Default report and marksheet footers were seeded automatically.
                </p>
                <button type="button" onClick={closeModal} className="w-full rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-black text-white">
                  Done
                </button>
              </div>
            ) : (
              <>
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-base font-black text-slate-900">Create school</h3>
                  <button type="button" onClick={closeModal} className="rounded-full border border-slate-200 px-3 py-1 text-sm text-slate-500">
                    Close
                  </button>
                </div>
                {createError ? <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{createError}</div> : null}
                <div className="grid gap-4 max-h-[60vh] overflow-y-auto pr-1">
                  <fieldset className="grid gap-3">
                    <legend className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">School</legend>
                    <input type="text" value={form.schoolName} onChange={(e) => setForm((f) => ({ ...f, schoolName: e.target.value }))} className="input w-full text-sm" placeholder="St. Julian Primary School" />
                    <input type="text" value={form.schoolCode} onChange={(e) => setForm((f) => ({ ...f, schoolCode: e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "") }))} className="input w-full text-sm font-mono uppercase" placeholder="STJULIAN" maxLength={50} />
                    <input type="text" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} className="input w-full text-sm" placeholder="+256 700 000 000" />
                    <input type="text" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} className="input w-full text-sm" placeholder="Kampala, Uganda" />
                  </fieldset>

                  <fieldset className="grid gap-3">
                    <legend className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Sections</legend>
                    <div className="flex flex-wrap gap-3">
                      {SECTIONS.map((section) => (
                        <label key={section} className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-700">
                          <input type="checkbox" checked={form.sections.includes(section)} onChange={() => toggleSection(section)} className="h-4 w-4 rounded border-slate-300 accent-blue-600" />
                          {section}
                        </label>
                      ))}
                    </div>
                  </fieldset>

                  <fieldset className="grid gap-3">
                    <legend className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Default streams</legend>
                    <div className="flex flex-wrap gap-3">
                      {STREAM_CODES.map((code) => (
                        <label key={code} className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-700">
                          <input type="checkbox" checked={form.defaultStreamCodes.includes(code)} onChange={() => toggleStreamCode(code)} className="h-4 w-4 rounded border-slate-300 accent-blue-600" />
                          {code}
                        </label>
                      ))}
                    </div>
                    <p className="text-xs text-slate-400">
                      These canonical stream codes are seeded across the selected classes during onboarding.
                    </p>
                  </fieldset>

                  <fieldset className="grid gap-3">
                    <legend className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Subscription</legend>
                    <select value={form.planCode} onChange={(e) => setForm((f) => ({ ...f, planCode: e.target.value }))} className="input w-full text-sm">
                      {REPORT_LAB_PLANS.map((plan) => <option key={plan.code} value={plan.code}>{plan.name} - {plan.code}</option>)}
                    </select>
                    {selectedPlan?.setupFeeUgx != null ? (
                      <p className="text-xs text-slate-400">
                        Setup: {formatUgx(selectedPlan.setupFeeUgx)} - Annual: {formatUgx(selectedPlan.annualLicenseUgx ?? 0)}
                      </p>
                    ) : null}
                    <input type="number" min="0" max="365" value={form.trialDays} onChange={(e) => setForm((f) => ({ ...f, trialDays: e.target.value }))} className="input w-full text-sm" placeholder="30" />
                  </fieldset>

                  <fieldset className="grid gap-3">
                    <legend className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Primary admin</legend>
                    <input type="text" value={form.adminName} onChange={(e) => setForm((f) => ({ ...f, adminName: e.target.value }))} className="input w-full text-sm" placeholder="John Doe" />
                    <input type="email" value={form.adminEmail} onChange={(e) => setForm((f) => ({ ...f, adminEmail: e.target.value }))} className="input w-full text-sm" placeholder="admin@stjulian.ac.ug" />
                    <input type="text" value={form.adminTemporaryPassword} onChange={(e) => setForm((f) => ({ ...f, adminTemporaryPassword: e.target.value }))} className="input w-full text-sm font-mono" placeholder="Min 10 characters" />
                  </fieldset>
                </div>
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={() => void handleCreate()}
                    disabled={creating || !form.schoolName.trim() || !form.schoolCode.trim() || form.sections.length === 0 || form.defaultStreamCodes.length === 0 || !form.adminName.trim() || !form.adminEmail.trim() || form.adminTemporaryPassword.length < MIN_ADMIN_TEMP_PASSWORD_LENGTH}
                    className="btn btn-primary flex-1 text-sm"
                  >
                    {creating ? "Creating..." : "Create school"}
                  </button>
                  <button type="button" onClick={closeModal} className="btn flex-1 text-sm">Cancel</button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}

      {selectedSchool ? (
        <OwnerSchoolConsoleDrawer
          school={selectedSchool}
          section={selectedSection}
          setSection={setSelectedSection}
          data={consoleData}
          loading={consoleLoading}
          error={consoleError}
          oneTimeSecret={oneTimeSecret}
          setOneTimeSecret={setOneTimeSecret}
          onClose={() => { setSelectedSchool(null); setConsoleData(null); setConsoleError(""); setOneTimeSecret(""); }}
          onRefresh={() => { void refreshSelectedConsole(); }}
          onNotice={setNotice}
          onError={setError}
        />
      ) : null}
    </div>
  );
}

function OwnerSchoolConsoleDrawer({
  school,
  section,
  setSection,
  data,
  loading,
  error,
  oneTimeSecret,
  setOneTimeSecret,
  onClose,
  onRefresh,
  onNotice,
  onError,
}: {
  school: OwnerSchool;
  section: SchoolAction;
  setSection: (section: SchoolAction) => void;
  data: OwnerSchoolConsole | null;
  loading: boolean;
  error: string;
  oneTimeSecret: string;
  setOneTimeSecret: (value: string) => void;
  onClose: () => void;
  onRefresh: () => void;
  onNotice: (value: string) => void;
  onError: (value: string) => void;
}) {
  async function run(label: string, action: () => Promise<void>) {
    try {
      await action();
      onNotice(label);
      onRefresh();
    } catch (e: unknown) {
      onError(e instanceof Error ? e.message : "Owner action failed.");
    }
  }

  async function resetPassword(userId: string) {
    const generated = await ownerResetPasswordAdvanced(userId, { generateTemporaryPassword: true });
    setOneTimeSecret(generated.temporaryPassword ? `Temporary password: ${generated.temporaryPassword}` : "");
    onNotice("Temporary password generated. It is shown once in this browser session.");
    onRefresh();
  }

  async function startSupport(mode: "READ_ONLY" | "WRITE") {
    const reason = window.prompt("Support reason for audit log?");
    if (!reason) return;
    const writeConfirmed = mode === "WRITE" ? window.confirm("Write-mode support session requires explicit confirmation. Continue?") : false;
    if (mode === "WRITE" && !writeConfirmed) return;
    const result = await startOwnerSupportSession(school.id, { mode, reason, durationMinutes: 30, writeConfirmed });
    onNotice(`${result.supportSession.banner}. Expires ${new Date(result.supportSession.expiresAt).toLocaleString()}.`);
    onRefresh();
  }

  const tabs: Array<{ key: SchoolAction; label: string }> = [
    { key: "view", label: "View" },
    { key: "users", label: "Users" },
    { key: "support", label: "Support" },
    { key: "readers", label: "Readers" },
    { key: "subscription", label: "Subscription" },
    { key: "health", label: "Health" },
    { key: "features", label: "Feature Flags" },
    { key: "api-keys", label: "API Keys" },
    { key: "audit", label: "Audit Log" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/35">
      <aside className="h-full w-full overflow-y-auto bg-white p-4 shadow-2xl sm:max-w-4xl sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">Owner School Management</p>
            <h3 className="text-xl font-black text-slate-950">{school.name}</h3>
            <p className="font-mono text-xs text-slate-400">{school.code}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full border border-slate-200 px-3 py-1.5 text-sm font-bold text-slate-600">Close</button>
        </div>

        <div className="my-4 flex gap-2 overflow-x-auto pb-1">
          {tabs.map((tab) => (
            <button key={tab.key} type="button" onClick={() => setSection(tab.key)} className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-black ${section === tab.key ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700"}`}>
              {tab.label}
            </button>
          ))}
        </div>

        {oneTimeSecret ? (
          <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-900">
            {oneTimeSecret}
          </div>
        ) : null}
        {loading ? <div className="rounded-2xl border border-slate-200 p-6 text-center text-sm text-slate-500">Loading owner console...</div> : null}
        {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
        {!loading && data ? (
          <div className="grid gap-4">
            {section === "view" || section === "reset-password" || section === "unlock" ? (
              <section className="rounded-2xl border border-slate-200 p-4">
                <h4 className="font-black text-slate-900">School Details</h4>
                <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                  <InfoRow label="Name" value={data.school.name} />
                  <InfoRow label="Phone" value={data.school.phone ?? "-"} />
                  <InfoRow label="Email" value={data.school.email ?? "-"} />
                  <InfoRow label="Address" value={data.school.address ?? "-"} />
                  <InfoRow label="Timezone" value={data.school.timezone ?? "-"} />
                  <InfoRow label="Branding" value={data.school.brandingMode ?? "PLATFORM_DEFAULTS"} />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" className="btn text-sm" onClick={() => {
                    const name = window.prompt("School name", data.school.name);
                    if (name) void run("School details updated.", () => updateOwnerSchoolDetails(school.id, { name }));
                  }}>Edit name</button>
                  <button type="button" className="btn text-sm" onClick={() => {
                    const email = window.prompt("School email", data.school.email ?? "");
                    if (email !== null) void run("School email updated.", () => updateOwnerSchoolDetails(school.id, { email: email || null }));
                  }}>Edit email</button>
                </div>
              </section>
            ) : null}

            {section === "users" || section === "reset-password" || section === "unlock" ? (
              <section className="rounded-2xl border border-slate-200 p-4">
                <h4 className="font-black text-slate-900">Manage Users</h4>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                      <tr><th className="px-3 py-2 text-left">User</th><th className="px-3 py-2 text-left">Role</th><th className="px-3 py-2 text-left">Status</th><th className="px-3 py-2 text-left">Actions</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.users.map((user) => (
                        <tr key={user.id}>
                          <td className="px-3 py-2"><b>{user.name}</b><br /><span className="text-xs text-slate-500">{user.email}</span></td>
                          <td className="px-3 py-2">{user.role}</td>
                          <td className="px-3 py-2">{user.isActive ? "Active" : "Suspended"}</td>
                          <td className="px-3 py-2">
                            <div className="flex flex-wrap gap-2">
                              <button type="button" className="text-xs font-bold text-blue-700" onClick={() => { void resetPassword(user.id); }}>Reset Password</button>
                              <button type="button" className="text-xs font-bold text-emerald-700" onClick={() => { void run("Account unlocked.", () => ownerUnlockUser(user.id)); }}>Unlock</button>
                              <button type="button" className="text-xs font-bold text-slate-700" onClick={() => { void run("Sessions terminated.", () => ownerTerminateUserSessions(user.id)); }}>Terminate Session</button>
                              <button type="button" className="text-xs font-bold text-amber-700" onClick={() => { void run("MFA reset checked.", async () => { await ownerResetMfa(user.id); }); }}>Reset MFA</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : null}

            {section === "support" ? (
              <section className="rounded-2xl border border-slate-200 p-4">
                <h4 className="font-black text-slate-900">Support Session</h4>
                <p className="mt-1 text-sm text-slate-500">Start a time-limited support session without using a school user's password. Read-only is the default.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" className="btn btn-primary text-sm" onClick={() => { void startSupport("READ_ONLY"); }}>Start Read-only Session</button>
                  <button type="button" className="btn text-sm" onClick={() => { void startSupport("WRITE"); }}>Start Write Session</button>
                </div>
                <div className="mt-4 grid gap-2">
                  {data.supportSessions.map((session) => (
                    <div key={session.id} className="rounded-xl bg-slate-50 p-3 text-sm">
                      <b>{session.mode}</b> - {session.status} - expires {new Date(session.expiresAt).toLocaleString()}
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {section === "readers" || section === "api-keys" ? (
              <section className="rounded-2xl border border-slate-200 p-4">
                <h4 className="font-black text-slate-900">Manage Readers</h4>
                <div className="mt-3 grid gap-3">
                  {data.readers.length === 0 ? <p className="text-sm text-slate-500">No readers registered.</p> : data.readers.map((reader) => (
                    <div key={reader.id} className="rounded-2xl border border-slate-100 p-3">
                      <div className="flex flex-wrap justify-between gap-2">
                        <div className="min-w-0">
                          <b className="break-words">{reader.name}</b>
                          <p className="break-all font-mono text-xs text-slate-400">{reader.deviceKey}</p>
                          <p className="mt-1 text-xs text-slate-500">{reader.school?.name ?? school.name}</p>
                        </div>
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold ${reader.onlineStatus === "ONLINE" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-600"}`}>
                          {reader.onlineStatus === "ONLINE" ? "Online" : "Offline"}
                        </span>
                      </div>
                      <div className="mt-2 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
                        <DetailMini label="Heartbeat" value={reader.lastHeartbeatAt ?? reader.lastSeenAt ?? "-"} />
                        <DetailMini label="Location" value={reader.locationName ?? reader.location ?? "-"} />
                        <DetailMini label="Type" value={reader.locationType ?? reader.mode} />
                        <DetailMini label="Seen" value={reader.lastSeenAt ?? "-"} />
                      </div>
                      <details className="mt-2 rounded-xl border border-slate-200 bg-slate-50/70">
                        <summary className="cursor-pointer list-none px-3 py-2 text-sm font-bold text-slate-700 marker:hidden">
                          More reader details
                        </summary>
                        <div className="grid gap-2 border-t border-slate-200 p-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                        <DetailMini label="Firmware" value={reader.firmwareVersion ?? "-"} />
                        <DetailMini label="OTA" value={reader.otaStatus ?? "UNKNOWN"} />
                        <DetailMini label="RSSI" value={reader.lastRssi != null ? `${reader.lastRssi} dBm` : "-"} />
                        <DetailMini label="Queue" value={`${reader.queueDepth}`} />
                        <DetailMini label="Memory" value={reader.freeHeap != null ? `${reader.freeHeap.toLocaleString("en-UG")} B` : "-"} />
                        </div>
                      </details>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:flex xl:flex-wrap xl:items-center">
                        <Link to={`/owner/readers/${encodeURIComponent(reader.id)}`} className="rounded-xl bg-blue-50 px-3 py-3 text-center text-xs font-bold text-blue-700 xl:px-3 xl:py-2">
                          Open detail
                        </Link>
                        {(["RESTART", "SYNC", "UPDATE_FIRMWARE", "RE_REGISTER"] as const).map((action) => (
                          <button key={action} type="button" className="rounded-xl bg-slate-100 px-3 py-3 text-xs font-bold text-slate-700 xl:px-3 xl:py-2" onClick={() => { void run(`Reader ${action.toLowerCase().replace(/_/g, " ")} requested.`, () => requestOwnerReaderAction(school.id, reader.id, action)); }}>
                            {action.replace(/_/g, " ")}
                          </button>
                        ))}
                        <button type="button" className="rounded-xl bg-amber-50 px-3 py-3 text-xs font-bold text-amber-800 xl:px-3 xl:py-2" onClick={async () => {
                          if (!window.confirm("Rotate this reader token? The new token is shown once.")) return;
                          try {
                            const rotated = await rotateOwnerReaderToken(school.id, reader.id);
                            setOneTimeSecret(`Reader ${rotated.deviceKey} token: ${rotated.oneTimeToken}`);
                            onRefresh();
                          } catch (e: unknown) {
                            onError(e instanceof Error ? e.message : "Could not rotate token.");
                          }
                        }}>Rotate Token</button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {section === "subscription" ? (
              <section className="rounded-2xl border border-slate-200 p-4">
                <h4 className="font-black text-slate-900">Subscription</h4>
                <p className="mt-1 text-sm text-slate-500">{data.school.subscription?.planCode ?? "No plan"} - {data.school.subscription?.status ?? "No subscription"}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" className="btn text-sm" onClick={() => { void run("Subscription extended.", () => updateOwnerSubscription(school.id, { action: "EXTEND", extendDays: 30 })); }}>Extend 30 days</button>
                  <button type="button" className="btn text-sm" onClick={() => { void run("Subscription paused.", () => updateOwnerSubscription(school.id, { action: "PAUSE" })); }}>Pause</button>
                  <button type="button" className="btn text-sm" onClick={() => { void run("Subscription cancelled.", () => updateOwnerSubscription(school.id, { action: "CANCEL" })); }}>Cancel</button>
                </div>
              </section>
            ) : null}

            {section === "health" ? (
              <section className="rounded-2xl border border-slate-200 p-4">
                <h4 className="font-black text-slate-900">School Health</h4>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  <DetailMini label="Students" value={`${data.health.studentCount}`} />
                  <DetailMini label="Reports" value={`${data.health.issuedReportCount}`} />
                  <DetailMini label="OCR usage" value={`${data.health.ocrUsage}`} />
                  <DetailMini label="Gateway" value={data.health.gatewayStatus} />
                  <DetailMini label="Storage" value={data.health.storageUsage ?? "Not configured"} />
                  <DetailMini label="Last backup" value={data.health.lastBackup ?? "Provider check required"} />
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {(["FORCE_SYNC", "REBUILD_SEARCH", "REPAIR_DOCUMENTS", "REGENERATE_QR_CODES", "RESEND_PENDING_EMAILS"] as const).map((action) => (
                    <button key={action} type="button" className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700" onClick={() => { void run(`${action.replace(/_/g, " ")} requested.`, () => requestOwnerMaintenance(school.id, action)); }}>
                      {action.replace(/_/g, " ")}
                    </button>
                  ))}
                </div>
              </section>
            ) : null}

            {section === "features" ? (
              <section className="rounded-2xl border border-slate-200 p-4">
                <h4 className="font-black text-slate-900">Feature Flags</h4>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {data.featureFlags.map((flag) => (
                    <label key={flag.feature} className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2 text-sm font-bold text-slate-700">
                      {flag.feature.replace(/_/g, " ")}
                      <input
                        type="checkbox"
                        checked={flag.enabled}
                        onChange={(event) => {
                          const nextFlags: OwnerFeatureFlag[] = data.featureFlags.map((item) => item.feature === flag.feature ? { ...item, enabled: event.target.checked } : item);
                          void run("Feature flags updated.", () => updateOwnerFeatureFlags(school.id, nextFlags));
                        }}
                      />
                    </label>
                  ))}
                </div>
              </section>
            ) : null}

            {section === "audit" ? (
              <section className="rounded-2xl border border-slate-200 p-4">
                <h4 className="font-black text-slate-900">Audit Log</h4>
                <div className="mt-3 grid gap-2">
                  {data.auditLogs.map((log) => (
                    <div key={log.id} className="rounded-xl bg-slate-50 p-3 text-sm">
                      <b>{log.action}</b><p className="text-xs text-slate-500">{new Date(log.createdAt).toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        ) : null}
      </aside>
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

function NoticeBanner({ message, tone, onDismiss }: { message: string; tone: "success" | "error"; onDismiss: () => void }) {
  const classes = tone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-700";
  return (
    <div className={`rounded-2xl border px-4 py-3 text-sm ${classes}`}>
      {message}
      <button type="button" className="ml-2 text-xs underline" onClick={onDismiss}>dismiss</button>
    </div>
  );
}

function InfoRow({ label, value, strong = true, mono = false }: { label: string; value: string; strong?: boolean; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-slate-500">{label}</span>
      <span className={`${strong ? "font-bold text-slate-900" : "text-slate-700"} ${mono ? "font-mono text-xs break-all" : ""}`}>{value}</span>
    </div>
  );
}

function DetailMini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-0.5 break-words text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}
