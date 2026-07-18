import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  approveCommunicationCampaign,
  createCommunicationCampaign,
  fetchCommunicationCampaigns,
  fetchCommunicationTemplates,
  previewCommunicationRecipients,
  requestCommunicationCampaignApproval,
  saveCommunicationTemplate,
  sendCommunication,
  type CommunicationCampaign,
  type CommunicationTemplate,
} from "../client/communicationsClient";
import { useAuth } from "../contexts/AuthContext";
import { fetchReportContext } from "../client/reportsClient";
import { fetchStaffUsers, type StaffUser } from "../client/staffUsersClient";
import { fetchStudents } from "../client/studentsClient";
import {
  communicationAudienceTypes,
  communicationContactRoles,
  estimateSmsSegments,
  type AudienceDefinition,
  type AudienceResolution,
  type CommunicationAudienceType,
  type CommunicationChannel,
  type CommunicationContactRole,
} from "../shared/communications";
import { hasPermission } from "../shared/permissions";
import type { ReportContext, ReportContextOption } from "../shared/types/reports";
import type { StudentListItem } from "../shared/types/students";

type AudienceFormState = AudienceDefinition & {
  audienceType: CommunicationAudienceType;
  channel: CommunicationChannel;
  classId: string;
  streamId: string;
  studentIds: string[];
  guardianContactIds: string[];
  staffUserIds: string[];
  contactRoles: CommunicationContactRole[];
  includeInactive: boolean;
  search: string;
  page: number;
  pageSize: number;
  mode: "GENERAL" | "PER_STUDENT";
};

type TemplateFormState = {
  channel: "SMS" | "WHATSAPP";
  communicationType: string;
  name: string;
  status: "DRAFT" | "APPROVED" | "ACTIVE";
  languageCode: string;
  content: string;
  providerTemplateName: string;
  providerTemplateId: string;
};

type CommunicationTab = "Campaigns" | "Delivery" | "Templates";

const campaignTypes = [
  "ANNOUNCEMENT",
  "CIRCULAR",
  "REPORT_RELEASE",
  "EVENT",
  "EMERGENCY_ALERT",
  "FEE_NOTICE",
  "ATTENDANCE_ALERT",
  "RECEIPT",
  "VIDEO_MESSAGE",
  "CUSTOM",
];

const defaultAudience: AudienceFormState = {
  audienceType: "ALL_PARENTS_GUARDIANS",
  channel: "WHATSAPP",
  classId: "",
  streamId: "",
  studentIds: [],
  guardianContactIds: [],
  staffUserIds: [],
  contactRoles: [],
  includeInactive: false,
  search: "",
  page: 1,
  pageSize: 10,
  mode: "GENERAL",
};

const defaultTemplateForm: TemplateFormState = {
  channel: "SMS",
  communicationType: "ANNOUNCEMENT",
  name: "sms-announcement-default",
  status: "APPROVED",
  languageCode: "en",
  content: "Hello {{guardianName}}, {{schoolName}}: {{communicationTitle}}. {{message}}",
  providerTemplateName: "",
  providerTemplateId: "",
};

export function CommunicationsPage() {
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState<CommunicationCampaign[]>([]);
  const [templates, setTemplates] = useState<CommunicationTemplate[]>([]);
  const [reportContext, setReportContext] = useState<ReportContext | null>(null);
  const [students, setStudents] = useState<StudentListItem[]>([]);
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);
  const [staffError, setStaffError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<CommunicationTab>("Campaigns");
  const [creating, setCreating] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>("");
  const [preview, setPreview] = useState<AudienceResolution | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [form, setForm] = useState({ type: "ANNOUNCEMENT", title: "", subject: "", body: "" });
  const [templateForm, setTemplateForm] = useState<TemplateFormState>(defaultTemplateForm);
  const [audience, setAudience] = useState<AudienceFormState>(defaultAudience);
  const canRequestApproval = hasPermission(user?.role, "communications.requestApproval");
  const canApproveCampaigns = hasPermission(user?.role, "communications.approve");
  const canSendCampaigns = hasPermission(user?.role, "communications.send");
  const canManageTemplates = hasPermission(user?.role, "communications.templates.manage");

  async function load() {
    setLoading(true);
    setError(null);
    setNotice(null);
    setStaffError(null);
    try {
      const [campaignData, contextData, studentData, staffData, templateData] = await Promise.allSettled([
        fetchCommunicationCampaigns(),
        fetchReportContext(),
        fetchStudents({ isActive: "true" }),
        fetchStaffUsers(),
        canManageTemplates ? fetchCommunicationTemplates() : Promise.resolve({ templates: [] }),
      ]);
      if (campaignData.status === "fulfilled") {
        setCampaigns(campaignData.value.campaigns);
        setSelectedCampaignId((current) => current || campaignData.value.campaigns[0]?.id || "");
      } else {
        throw campaignData.reason;
      }
      if (contextData.status === "fulfilled") {
        setReportContext(contextData.value);
      }
      if (studentData.status === "fulfilled") {
        setStudents(studentData.value.students);
      }
      if (staffData.status === "fulfilled") {
        setStaffUsers(staffData.value.users);
      } else {
        setStaffUsers([]);
        setStaffError("Staff list unavailable for this account. The resolver still supports staff audiences if you have access.");
      }
      if (templateData.status === "fulfilled") {
        setTemplates(templateData.value.templates);
      } else if (canManageTemplates) {
        setTemplates([]);
        setError(templateData.reason instanceof Error ? templateData.reason.message : "Could not load communication templates");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load communication data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!selectedCampaignId) return;
    const timer = window.setTimeout(() => {
      void handlePreview(selectedCampaignId, audience);
    }, 250);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCampaignId, audience]);

  const counts = useMemo(
    () => ({
      drafts: campaigns.filter((c) => c.status === "DRAFT").length,
      approval: campaigns.filter((c) => c.status.includes("APPROVAL") || c.status === "READY_FOR_APPROVAL").length,
      scheduled: campaigns.filter((c) => c.status === "SCHEDULED").length,
      sending: campaigns.filter((c) => c.status === "QUEUED" || c.status === "SENDING").length,
      failed: campaigns.filter((c) => c.status === "FAILED" || c.status === "VALIDATION_FAILED").length,
    }),
    [campaigns],
  );

  const selectedCampaign = useMemo(
    () => campaigns.find((campaign) => campaign.id === selectedCampaignId) ?? null,
    [campaigns, selectedCampaignId],
  );

  const activeStudents = useMemo(() => {
    const query = audience.search.trim().toLowerCase();
    return students.filter((student) => {
      const matchesQuery = !query || [
        student.studentName,
        student.admissionNumber,
        student.className,
        student.streamName,
      ].filter(Boolean).join(" ").toLowerCase().includes(query);
      const matchesClass = !audience.classId || contextClassMatches(student, audience.classId);
      const matchesInactive = audience.includeInactive || student.isActive;
      return matchesQuery && matchesClass && matchesInactive;
    });
  }, [audience.classId, audience.includeInactive, audience.search, students]);

  const streamOptions = useMemo<ReportContextOption[]>(() => {
    if (!reportContext) return [];
    return reportContext.streams.filter((stream) => !audience.classId || stream.classId === audience.classId);
  }, [audience.classId, reportContext]);

  async function submitCampaign(event: FormEvent) {
    event.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const created = await createCommunicationCampaign({
        ...form,
        audience: audienceToDefinition(audience),
      });
      setForm({ type: "ANNOUNCEMENT", title: "", subject: "", body: "" });
      const data = await fetchCommunicationCampaigns();
      setCampaigns(data.campaigns);
      setSelectedCampaignId(created.campaign.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create communication campaign");
    } finally {
      setCreating(false);
    }
  }

  async function handlePreview(campaignId: string, requestAudience: AudienceFormState) {
    if (!campaignId) return;
    setPreviewLoading(true);
    setError(null);
    try {
      const data = await previewCommunicationRecipients(campaignId, audienceToDefinition(requestAudience));
      setPreview(data.preview);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not preview recipients");
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleSend(campaignId: string) {
    if (!preview || preview.eligibleRecipientsCount === 0) {
      setError("Preview an audience with at least one eligible recipient before sending.");
      return;
    }
    const confirmation = buildActionConfirmation({
      action: "send",
      campaign: selectedCampaign,
      preview,
      channel: audience.channel,
    });
    const confirmed = window.confirm(confirmation);
    if (!confirmed) return;
    setSendingId(campaignId);
    setError(null);
    setNotice(null);
    try {
      const deliveryChannel = audience.channel === "SMS" ? "SMS" : "WHATSAPP";
      const result = await sendCommunication(campaignId, {
        channel: deliveryChannel,
        confirm: true,
        audience: audienceToDefinition(audience),
      });
      await load();
      setNotice(`Submitted ${result.result.submitted}; failed ${result.result.failed}; duplicates skipped ${result.result.skippedDuplicate}.`);
    } catch (err) {
      const deliveryChannel = audience.channel === "SMS" ? "SMS" : "WHATSAPP";
      setError(formatCommunicationSendError(err, deliveryChannel, selectedCampaign));
    } finally {
      setSendingId(null);
    }
  }

  async function handleSaveTemplate(event: FormEvent) {
    event.preventDefault();
    if (savingTemplate) return;
    setSavingTemplate(true);
    setError(null);
    setNotice(null);
    try {
      const result = await saveCommunicationTemplate({
        channel: templateForm.channel,
        communicationType: templateForm.communicationType,
        name: templateForm.name,
        status: templateForm.status,
        languageCode: templateForm.languageCode || "en",
        content: templateForm.content,
        providerTemplateName: templateForm.providerTemplateName || null,
        providerTemplateId: templateForm.providerTemplateId || null,
      });
      const data = await fetchCommunicationTemplates();
      setTemplates(data.templates);
      setTemplateForm((current) => ({ ...current, ...templateToForm(result.template) }));
      setNotice(`Template saved: ${result.template.channel} + ${result.template.communicationType}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save communication template");
    } finally {
      setSavingTemplate(false);
    }
  }

  async function handleApprove(campaign: CommunicationCampaign) {
    if (approvingId) return;
    const confirmation = buildActionConfirmation({
      action: "approve",
      campaign,
      preview: selectedCampaignId === campaign.id ? preview : null,
      channel: audience.channel,
    });
    if (!window.confirm(confirmation)) return;
    setApprovingId(campaign.id);
    setError(null);
    setNotice(null);
    try {
      await approveCommunicationCampaign(campaign.id);
      await load();
      setNotice(`Campaign approved: ${campaign.title}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not approve communication campaign");
    } finally {
      setApprovingId(null);
    }
  }

  async function handleSubmitForApproval(campaign: CommunicationCampaign) {
    if (submittingId) return;
    const confirmation = buildActionConfirmation({
      action: "submit",
      campaign,
      preview: selectedCampaignId === campaign.id ? preview : null,
      channel: audience.channel,
    });
    if (!window.confirm(confirmation)) return;
    setSubmittingId(campaign.id);
    setError(null);
    setNotice(null);
    try {
      const result = await requestCommunicationCampaignApproval(campaign.id);
      await load();
      setNotice(
        result.duplicate
          ? `Campaign already in approval flow: ${campaign.title}`
          : `Campaign submitted for approval: ${campaign.title} (${result.validation.validRecipientCount} valid recipient${result.validation.validRecipientCount === 1 ? "" : "s"})`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit communication campaign for approval");
    } finally {
      setSubmittingId(null);
    }
  }

  function toggleStudent(studentId: string) {
    setAudience((current) => ({
      ...current,
      studentIds: toggleValue(current.studentIds, studentId),
    }));
  }

  function toggleGuardian(contactId: string) {
    setAudience((current) => ({
      ...current,
      guardianContactIds: toggleValue(current.guardianContactIds, contactId),
    }));
  }

  function toggleStaff(staffId: string) {
    setAudience((current) => ({
      ...current,
      staffUserIds: toggleValue(current.staffUserIds, staffId),
    }));
  }

  function toggleContactRole(role: CommunicationContactRole) {
    setAudience((current) => ({
      ...current,
      contactRoles: toggleValue(current.contactRoles, role),
    }));
  }

  return (
    <main className="grid gap-4 pb-2">
      <header className="page-header flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-blue-600">Communication Center</p>
          <h1 className="text-xl font-bold tracking-tight text-slate-950 sm:text-2xl">Communication</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Campaigns, real school audiences, approvals and delivery operations for SMS and WhatsApp. Provider sending remains dry-run by default.
          </p>
        </div>
        <span className="inline-flex w-fit rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-black uppercase text-amber-800">
          DRY RUN
        </span>
      </header>

      {error ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{error}</span>
          {canManageTemplates && error.includes("Open Templates tab") ? (
            <button type="button" className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-black text-red-700" onClick={() => setTab("Templates")}>
              Open Templates
            </button>
          ) : null}
        </div>
      ) : null}
      {notice ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{notice}</div> : null}
      {staffError ? <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{staffError}</div> : null}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Metric label="Drafts" value={counts.drafts} />
        <Metric label="Approval" value={counts.approval} />
        <Metric label="Scheduled" value={counts.scheduled} />
        <Metric label="Sending" value={counts.sending} />
        <Metric label="Failed" value={counts.failed} />
      </section>

      <div className="tab-tray w-fit">
        {(["Campaigns", "Delivery", ...(canManageTemplates ? ["Templates"] : [])] as CommunicationTab[]).map((item) => (
          <button
            key={item}
            type="button"
            className={`tab-button ${tab === item ? "tab-button-active" : ""}`}
            onClick={() => setTab(item)}
          >
            {item}
          </button>
        ))}
      </div>

      {tab === "Campaigns" ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.06fr)_minmax(0,0.94fr)]">
          <form onSubmit={submitCampaign} className="grid gap-4">
            <section className="premium-card grid gap-3 rounded-xl p-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-black text-slate-900">Audience</h2>
                <button
                  type="button"
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700"
                  onClick={() => {
                    if (selectedCampaignId) {
                      void handlePreview(selectedCampaignId, audience);
                    }
                  }}
                >
                  Refresh preview
                </button>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="grid gap-1 text-xs font-bold uppercase text-slate-500">
                  Audience type
                  <select
                    className="premium-control rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                    value={audience.audienceType}
                    onChange={(event) => setAudience((current) => ({ ...current, audienceType: event.target.value as CommunicationAudienceType }))}
                  >
                    {communicationAudienceTypes.map((type) => (
                      <option key={type} value={type}>{audienceLabel(type)}</option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-1 text-xs font-bold uppercase text-slate-500">
                  Channel
                  <select
                    className="premium-control rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                    value={audience.channel}
                    onChange={(event) => setAudience((current) => ({ ...current, channel: event.target.value as CommunicationChannel }))}
                  >
                    <option value="WHATSAPP">WhatsApp</option>
                    <option value="SMS">SMS</option>
                  </select>
                </label>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="grid gap-1 text-xs font-bold uppercase text-slate-500">
                  Class
                  <select
                    className="premium-control rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                    value={audience.classId}
                    onChange={(event) => setAudience((current) => ({ ...current, classId: event.target.value, streamId: "" }))}
                  >
                    <option value="">All classes</option>
                    {reportContext?.classes.map((klass) => (
                      <option key={klass.id} value={klass.id}>{klass.name}</option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-1 text-xs font-bold uppercase text-slate-500">
                  Stream
                  <select
                    className="premium-control rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                    value={audience.streamId}
                    onChange={(event) => setAudience((current) => ({ ...current, streamId: event.target.value }))}
                  >
                    <option value="">All streams</option>
                    {streamOptions.map((stream) => (
                      <option key={stream.id} value={stream.id}>{stream.name}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="grid gap-1 text-xs font-bold uppercase text-slate-500">
                  Search
                  <input
                    className="premium-control rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                    value={audience.search}
                    onChange={(event) => setAudience((current) => ({ ...current, search: event.target.value, page: 1 }))}
                    placeholder="Search students or contacts"
                  />
                </label>

                <label className="grid gap-1 text-xs font-bold uppercase text-slate-500">
                  Page size
                  <select
                    className="premium-control rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                    value={audience.pageSize}
                    onChange={(event) => setAudience((current) => ({ ...current, pageSize: Number(event.target.value), page: 1 }))}
                  >
                    {[5, 10, 20, 50].map((value) => (
                      <option key={value} value={value}>{value} rows</option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={audience.includeInactive}
                    onChange={(event) => setAudience((current) => ({ ...current, includeInactive: event.target.checked }))}
                  />
                  Include inactive students
                </label>

                <label className="grid gap-1 text-xs font-bold uppercase text-slate-500">
                  Mode
                  <select
                    className="premium-control rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                    value={audience.mode}
                    onChange={(event) => setAudience((current) => ({ ...current, mode: event.target.value as "GENERAL" | "PER_STUDENT" }))}
                  >
                    <option value="GENERAL">General audience</option>
                    <option value="PER_STUDENT">Per student</option>
                  </select>
                </label>
              </div>

              <div className="grid gap-2">
                <p className="text-xs font-bold uppercase text-slate-500">Contact roles</p>
                <div className="flex flex-wrap gap-2">
                  {communicationContactRoles.map((role) => (
                    <button
                      key={role}
                      type="button"
                      className={`rounded-full border px-3 py-1.5 text-xs font-bold ${audience.contactRoles.includes(role) ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-600"}`}
                      onClick={() => toggleContactRole(role)}
                    >
                      {roleLabel(role)}
                    </button>
                  ))}
                </div>
              </div>

              {audience.audienceType === "PARENTS_OF_SELECTED_STUDENTS" ? (
                <SelectionPanel title="Selected students" hint="Choose the students whose parents or guardians should be included." count={audience.studentIds.length}>
                  <div className="max-h-72 overflow-auto pr-1">
                    {activeStudents.length === 0 ? (
                      <p className="px-2 py-4 text-sm text-slate-500">No matching students found.</p>
                    ) : activeStudents.map((student) => (
                      <label key={student.id} className="flex items-start gap-3 rounded-xl border border-slate-100 px-3 py-2 hover:bg-slate-50">
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={audience.studentIds.includes(student.id)}
                          onChange={() => toggleStudent(student.id)}
                        />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-slate-900">{student.studentName}</p>
                          <p className="truncate text-xs text-slate-500">{student.admissionNumber} - {student.className ?? "No class"}{student.streamName ? ` / ${student.streamName}` : ""}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </SelectionPanel>
              ) : null}

              {audience.audienceType === "CUSTOM_SELECTED_CONTACTS" ? (
                <SelectionPanel title="Selected contacts" hint="Pick specific parent or guardian contacts from student profiles." count={audience.guardianContactIds.length}>
                  <div className="max-h-72 space-y-3 overflow-auto pr-1">
                    {activeStudents.length === 0 ? (
                      <p className="px-2 py-4 text-sm text-slate-500">No matching students found.</p>
                    ) : activeStudents.map((student) => (
                      <div key={student.id} className="rounded-xl border border-slate-100 p-3">
                        <div className="mb-2">
                          <p className="text-sm font-bold text-slate-900">{student.studentName}</p>
                          <p className="text-xs text-slate-500">{student.admissionNumber} - {student.className ?? "No class"}{student.streamName ? ` / ${student.streamName}` : ""}</p>
                        </div>
                        <div className="space-y-2">
                          {student.guardianContacts.length === 0 ? (
                            <p className="text-xs text-slate-500">No guardian contacts on this student.</p>
                          ) : student.guardianContacts.map((contact) => (
                            <label key={contact.id} className="flex items-start gap-3 rounded-lg bg-slate-50 px-3 py-2">
                              <input
                                type="checkbox"
                                className="mt-1"
                                checked={audience.guardianContactIds.includes(contact.id)}
                                onChange={() => toggleGuardian(contact.id)}
                              />
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-slate-900">{contact.guardianName}</p>
                                <p className="truncate text-xs text-slate-500">{contact.relationship} - {contact.phone || contact.email || "No contact details"}</p>
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </SelectionPanel>
              ) : null}

              {audience.audienceType === "STAFF_TEACHERS" ? (
                <SelectionPanel title="Staff / teachers" hint="Pick staff members with school contact details." count={audience.staffUserIds.length}>
                  <div className="max-h-72 overflow-auto pr-1">
                    {staffUsers.length === 0 ? (
                      <p className="px-2 py-4 text-sm text-slate-500">No staff users loaded.</p>
                    ) : staffUsers.map((user) => (
                      <label key={user.id} className="flex items-start gap-3 rounded-xl border border-slate-100 px-3 py-2 hover:bg-slate-50">
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={audience.staffUserIds.includes(user.id)}
                          onChange={() => toggleStaff(user.id)}
                        />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-slate-900">{user.name}</p>
                          <p className="truncate text-xs text-slate-500">{user.email} - {user.role}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </SelectionPanel>
              ) : null}
            </section>

            <section className="premium-card grid gap-3 rounded-xl p-4">
              <h2 className="text-sm font-black text-slate-900">Create Communication</h2>
              <label className="grid gap-1 text-xs font-bold uppercase text-slate-500">
                Type
                <select className="premium-control rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900" value={form.type} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))}>
                  {campaignTypes.map((type) => (
                    <option key={type} value={type}>{type.replaceAll("_", " ")}</option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-xs font-bold uppercase text-slate-500">
                Title
                <input className="premium-control rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} />
              </label>
              <label className="grid gap-1 text-xs font-bold uppercase text-slate-500">
                Subject
                <input className="premium-control rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900" value={form.subject} onChange={(event) => setForm((current) => ({ ...current, subject: event.target.value }))} />
              </label>
              <label className="grid gap-1 text-xs font-bold uppercase text-slate-500">
                Body
                <textarea className="premium-control min-h-32 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900" value={form.body} onChange={(event) => setForm((current) => ({ ...current, body: event.target.value }))} />
              </label>
              <button type="submit" className="btn btn-primary" disabled={creating || !form.title.trim() || !form.body.trim()}>
                {creating ? "Creating..." : "Create draft"}
              </button>
            </section>
          </form>

          <section className="grid gap-4">
            <AudiencePreviewPanel
              preview={preview}
              selectedCampaignId={selectedCampaignId}
              selectedCampaign={selectedCampaign}
              previewLoading={previewLoading}
              onPreviousPage={() => setAudience((current) => ({ ...current, page: Math.max(1, current.page - 1) }))}
              onNextPage={() => setAudience((current) => ({ ...current, page: current.page + 1 }))}
              onSend={() => {
                if (selectedCampaignId) {
                  void handleSend(selectedCampaignId);
                }
              }}
              sending={sendingId === selectedCampaignId}
              canSend={Boolean(
                canSendCampaigns
                && preview
                && preview.eligibleRecipientsCount > 0
                && selectedCampaignId
                && selectedCampaign?.status === "APPROVED",
              )}
              canSendCampaigns={canSendCampaigns}
              channel={audience.channel}
            />

            <CampaignList
              loading={loading}
              campaigns={campaigns}
              canRequestApproval={canRequestApproval}
              canApproveCampaigns={canApproveCampaigns}
              canSendCampaigns={canSendCampaigns}
              selectedCampaignId={selectedCampaignId}
              preview={preview}
              submittingId={submittingId}
              sendingId={sendingId}
              approvingId={approvingId}
              onPreview={(campaignId) => {
                setSelectedCampaignId(campaignId);
                void handlePreview(campaignId, audience);
              }}
              onSubmitForApproval={(campaign) => {
                void handleSubmitForApproval(campaign);
              }}
              onApprove={(campaign) => {
                void handleApprove(campaign);
              }}
              onSend={(campaignId) => {
                void handleSend(campaignId);
              }}
            />
          </section>
        </div>
      ) : tab === "Templates" && canManageTemplates ? (
        <TemplatesPanel
          templates={templates}
          form={templateForm}
          saving={savingTemplate}
          onChange={setTemplateForm}
          onSave={handleSaveTemplate}
          onEdit={(template) => setTemplateForm(templateToForm(template))}
        />
      ) : (
        <DeliverySummary campaigns={campaigns} />
      )}
    </main>
  );
}

function TemplatesPanel({
  templates,
  form,
  saving,
  onChange,
  onSave,
  onEdit,
}: {
  templates: CommunicationTemplate[];
  form: TemplateFormState;
  saving: boolean;
  onChange: (form: TemplateFormState) => void;
  onSave: (event: FormEvent) => void;
  onEdit: (template: CommunicationTemplate) => void;
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
      <form onSubmit={onSave} className="premium-card grid gap-3 rounded-xl p-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-blue-600">Template setup</p>
          <h2 className="text-sm font-black text-slate-900">Set default SMS template</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Live SMS and WhatsApp sends require an approved school-scoped template. Provider IDs are optional for SMS and required by some WhatsApp providers.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="grid gap-1 text-xs font-bold uppercase text-slate-500">
            Channel
            <select className="premium-control rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900" value={form.channel} onChange={(event) => onChange({ ...form, channel: event.target.value as TemplateFormState["channel"] })}>
              <option value="SMS">SMS</option>
              <option value="WHATSAPP">WhatsApp</option>
            </select>
          </label>
          <label className="grid gap-1 text-xs font-bold uppercase text-slate-500">
            Type
            <select className="premium-control rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900" value={form.communicationType} onChange={(event) => onChange({ ...form, communicationType: event.target.value })}>
              {campaignTypes.map((type) => (
                <option key={type} value={type}>{type.replaceAll("_", " ")}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="grid gap-1 text-xs font-bold uppercase text-slate-500">
            Name
            <input className="premium-control rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900" value={form.name} onChange={(event) => onChange({ ...form, name: event.target.value })} />
          </label>
          <label className="grid gap-1 text-xs font-bold uppercase text-slate-500">
            Status
            <select className="premium-control rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900" value={form.status} onChange={(event) => onChange({ ...form, status: event.target.value as TemplateFormState["status"] })}>
              <option value="DRAFT">Draft</option>
              <option value="APPROVED">Approved</option>
              <option value="ACTIVE">Active</option>
            </select>
          </label>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <label className="grid gap-1 text-xs font-bold uppercase text-slate-500">
            Language
            <input className="premium-control rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900" value={form.languageCode} onChange={(event) => onChange({ ...form, languageCode: event.target.value })} />
          </label>
          <label className="grid gap-1 text-xs font-bold uppercase text-slate-500">
            Provider template name
            <input className="premium-control rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900" value={form.providerTemplateName} onChange={(event) => onChange({ ...form, providerTemplateName: event.target.value })} />
          </label>
        </div>

        <label className="grid gap-1 text-xs font-bold uppercase text-slate-500">
          Provider template ID
          <input className="premium-control rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900" value={form.providerTemplateId} onChange={(event) => onChange({ ...form, providerTemplateId: event.target.value })} />
        </label>

        <label className="grid gap-1 text-xs font-bold uppercase text-slate-500">
          Content
          <textarea className="premium-control min-h-36 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900" value={form.content} onChange={(event) => onChange({ ...form, content: event.target.value })} />
        </label>

        <button type="submit" className="btn btn-primary" disabled={saving || !form.name.trim() || !form.content.trim()}>
          {saving ? "Saving..." : "Save template"}
        </button>
      </form>

      <section className="premium-card grid gap-3 rounded-xl p-4">
        <div>
          <h2 className="text-sm font-black text-slate-900">Existing templates</h2>
          <p className="mt-1 text-xs text-slate-500">Templates are scoped to this school only.</p>
        </div>
        {templates.length === 0 ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-800">
            No communication templates are configured yet. Save the default SMS announcement template to unblock live SMS sending.
          </div>
        ) : (
          <div className="grid gap-3">
            {templates.map((template) => (
              <article key={template.id} className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-black text-slate-900">{template.name}</p>
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                      {template.channel} / {template.communicationType} / {template.status}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Provider: {template.providerTemplateName || template.providerTemplateId || "Not bound"}
                    </p>
                  </div>
                  <button type="button" className="btn btn-secondary" onClick={() => onEdit(template)}>
                    Edit
                  </button>
                </div>
                <p className="mt-3 line-clamp-2 text-sm text-slate-600">{template.content}</p>
                <p className="mt-2 text-xs text-slate-500">Variables: {template.variables.length > 0 ? template.variables.join(", ") : "None"}</p>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function buildActionConfirmation(input: {
  action: "submit" | "approve" | "send";
  campaign: CommunicationCampaign | null;
  preview: AudienceResolution | null;
  channel: CommunicationChannel;
}) {
  const campaign = input.campaign;
  if (!campaign) return "No campaign selected.";
  const body = campaign.contents?.[0]?.shortBody || campaign.contents?.[0]?.body || "";
  const segmentEstimate = estimateSmsSegments(body);
  const recipientCount = input.preview?.eligibleRecipientsCount ?? campaign._count?.recipients ?? 0;
  const totalBillableSegments = recipientCount * Math.max(segmentEstimate.segments, 0);
  const estimatedCost = input.channel === "SMS"
    ? `Approx ${totalBillableSegments} billable SMS segment${totalBillableSegments === 1 ? "" : "s"} before provider pricing.`
    : "Channel pricing varies by provider configuration and is confirmed later during delivery submission.";
  const actionLabel = input.action === "submit"
    ? "Submit campaign for approval"
    : input.action === "approve"
      ? "Approve campaign"
      : "Confirm send";
  return [
    `${actionLabel} "${campaign.title}"?`,
    "",
    `Recipient count: ${recipientCount}`,
    `Segment count: ${segmentEstimate.segments}`,
    `Estimated cost: ${estimatedCost}`,
  ].join("\n");
}

function templateToForm(template: CommunicationTemplate): TemplateFormState {
  return {
    channel: template.channel,
    communicationType: template.communicationType,
    name: template.name,
    status: template.status,
    languageCode: template.languageCode,
    content: template.content,
    providerTemplateName: template.providerTemplateName ?? "",
    providerTemplateId: template.providerTemplateId ?? "",
  };
}

function formatCommunicationSendError(err: unknown, channel: "SMS" | "WHATSAPP", campaign: CommunicationCampaign | null) {
  const message = err instanceof Error ? err.message : `${channel === "WHATSAPP" ? "WhatsApp" : "SMS"} is not configured yet. Contact platform owner.`;
  if (/approved communication template/i.test(message)) {
    return `Missing approved template for ${channel} + ${campaign?.type ?? "ANNOUNCEMENT"}. Open Templates tab and approve one.`;
  }
  return message;
}

function audienceToDefinition(audience: AudienceFormState): AudienceDefinition {
  return {
    audienceType: audience.audienceType,
    channel: audience.channel,
    classId: audience.classId || undefined,
    streamId: audience.streamId || undefined,
    studentIds: audience.studentIds,
    guardianContactIds: audience.guardianContactIds,
    staffUserIds: audience.staffUserIds,
    contactRoles: audience.contactRoles,
    includeInactive: audience.includeInactive,
    search: audience.search || undefined,
    page: audience.page,
    pageSize: audience.pageSize,
    mode: audience.mode,
  };
}

function toggleValue<T>(values: T[], value: T) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function audienceLabel(value: CommunicationAudienceType) {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function roleLabel(value: CommunicationContactRole) {
  return value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}

function contextClassMatches(student: StudentListItem, classId: string) {
  if (!classId) return true;
  return student.classId === classId;
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-bold uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-black text-slate-950">{value}</p>
    </div>
  );
}

function SelectionPanel({
  title,
  hint,
  count,
  children,
}: {
  title: string;
  hint: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-black text-slate-900">{title}</h3>
          <p className="text-xs text-slate-500">{hint}</p>
        </div>
        <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-xs font-black text-slate-700">{count}</span>
      </div>
      {children}
    </section>
  );
}

function AudiencePreviewPanel({
  preview,
  selectedCampaignId,
  selectedCampaign,
  previewLoading,
  onPreviousPage,
  onNextPage,
  onSend,
  sending,
  canSend,
  canSendCampaigns,
  channel,
}: {
  preview: AudienceResolution | null;
  selectedCampaignId: string;
  selectedCampaign: CommunicationCampaign | null;
  previewLoading: boolean;
  onPreviousPage: () => void;
  onNextPage: () => void;
  onSend: () => void;
  sending: boolean;
  canSend: boolean;
  canSendCampaigns: boolean;
  channel: CommunicationChannel;
}) {
  return (
    <section className="premium-card rounded-xl p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-black text-slate-900">Preview recipients</h2>
          <p className="text-xs text-slate-500">
            {selectedCampaign ? selectedCampaign.title : "Select a campaign"} - {channel}
          </p>
          {selectedCampaign ? (
            <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">
              Current status: {selectedCampaign.status.replaceAll("_", " ")}
            </p>
          ) : null}
        </div>
        {canSendCampaigns ? (
          <button
            type="button"
            className="btn btn-primary"
            onClick={onSend}
            disabled={!selectedCampaignId || !canSend || sending}
          >
            {sending ? "Sending..." : "Confirm send"}
          </button>
        ) : null}
      </div>

      {!preview ? (
        <p className="mt-4 text-sm text-slate-500">Preview an audience to see counts, eligibility, and recipient rows.</p>
      ) : (
        <div className="mt-3 grid gap-3">
          {!canSendCampaigns ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
              Confirm send requires the `communications.send` permission.
            </div>
          ) : !selectedCampaignId ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
              Select a campaign before sending.
            </div>
          ) : !selectedCampaign || selectedCampaign.status !== "APPROVED" ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
              Confirm send becomes available after approval.
            </div>
          ) : preview.eligibleRecipientsCount === 0 ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
              No eligible recipients are available for this preview yet.
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <PreviewMetric label="Matched students" value={preview.matchedStudentsCount} />
            <PreviewMetric label="Raw contacts" value={preview.rawContactsCount} />
            <PreviewMetric label="Eligible" value={preview.eligibleRecipientsCount} />
            <PreviewMetric label="Excluded" value={preview.excludedRecipientsCount} />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <PreviewMetric label="Missing contact" value={preview.missingContactsCount} />
            <PreviewMetric label="Duplicates removed" value={preview.duplicateContactsRemovedCount} />
            <PreviewMetric label="Opted out / invalid" value={preview.optedOutRecipientsCount + preview.invalidRecipientsCount + preview.bouncedRecipientsCount} />
          </div>

          <div className="flex items-center justify-between gap-3 text-xs text-slate-500">
            <span>
              Page {preview.page} of {preview.totalPages} - {preview.totalRecipients} total rows
            </span>
            <div className="flex gap-2">
              <button type="button" className="rounded-lg border border-slate-200 px-3 py-1.5 font-bold text-slate-700 disabled:opacity-50" onClick={onPreviousPage} disabled={preview.page <= 1 || previewLoading}>
                Previous
              </button>
              <button type="button" className="rounded-lg border border-slate-200 px-3 py-1.5 font-bold text-slate-700 disabled:opacity-50" onClick={onNextPage} disabled={preview.page >= preview.totalPages || previewLoading}>
                Next
              </button>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="max-h-[680px] overflow-auto">
              <table className="w-full table-fixed border-separate border-spacing-0">
                <thead className="sticky top-0 bg-slate-50 text-left text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">
                  <tr>
                    <th className="w-[18%] px-3 py-3">Student</th>
                    <th className="w-[20%] px-3 py-3">Contact</th>
                    <th className="w-[18%] px-3 py-3">Role</th>
                    <th className="w-[28%] px-3 py-3">Availability</th>
                    <th className="w-[16%] px-3 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.recipients.map((row) => (
                    <tr key={row.id} className="border-t border-slate-100 align-top">
                      <td className="px-3 py-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-slate-900">{row.studentName || "No student assigned"}</p>
                          <p className="truncate text-xs text-slate-500">{row.className ?? "No class"}{row.streamName ? ` / ${row.streamName}` : ""}</p>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900">{row.contactName}</p>
                          <p className="truncate text-xs text-slate-500">{row.phone ?? row.email ?? "No contact details"}</p>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-sm text-slate-600">
                        {row.relationship ?? "-"}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          <Badge active={row.channelAvailability.whatsapp}>WhatsApp</Badge>
                          <Badge active={row.channelAvailability.sms}>SMS</Badge>
                          <Badge active={row.channelAvailability.email}>Email</Badge>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="grid gap-1">
                          <StatusPill status={row.eligibilityStatus} />
                          {row.exclusionReason ? <p className="text-xs leading-5 text-slate-500">{row.exclusionReason}</p> : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function PreviewMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-black text-slate-950 sm:text-2xl">{value}</p>
    </div>
  );
}

function Badge({ active, children }: { active: boolean; children: ReactNode }) {
  return (
    <span className={`rounded-full border px-2.5 py-1 text-[11px] font-black ${active ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-100 text-slate-500"}`}>
      {children}
    </span>
  );
}

function StatusPill({ status }: { status: string }) {
  const classes =
    status === "ELIGIBLE" || status === "READY"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : status === "DUPLICATE_CONTACT" || status === "EXCLUDED"
        ? "border-slate-200 bg-slate-100 text-slate-600"
        : "border-rose-200 bg-rose-50 text-rose-700";
  return <span className={`w-fit rounded-full border px-2.5 py-1 text-[11px] font-black ${classes}`}>{status.replaceAll("_", " ")}</span>;
}

function CampaignList({
  loading,
  campaigns,
  canRequestApproval,
  canApproveCampaigns,
  canSendCampaigns,
  selectedCampaignId,
  preview,
  submittingId,
  sendingId,
  approvingId,
  onPreview,
  onSubmitForApproval,
  onApprove,
  onSend,
}: {
  loading: boolean;
  campaigns: CommunicationCampaign[];
  canRequestApproval: boolean;
  canApproveCampaigns: boolean;
  canSendCampaigns: boolean;
  selectedCampaignId: string;
  preview: AudienceResolution | null;
  submittingId: string | null;
  sendingId: string | null;
  approvingId: string | null;
  onPreview: (campaignId: string) => void;
  onSubmitForApproval: (campaign: CommunicationCampaign) => void;
  onApprove: (campaign: CommunicationCampaign) => void;
  onSend: (campaignId: string) => void;
}) {
  if (loading) return <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500">Loading...</div>;
  if (campaigns.length === 0) return <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500">No communication campaigns yet.</div>;
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      {campaigns.map((campaign) => (
        <article key={campaign.id} className="flex flex-col gap-2 border-b border-slate-100 p-3.5 last:border-0 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <h2 className="truncate font-black text-slate-900">{campaign.title}</h2>
            <p className="text-sm text-slate-600">
              {campaign.type.replaceAll("_", " ")} - {campaign._count?.recipients ?? 0} recipients - {campaign._count?.deliveries ?? 0} deliveries
            </p>
            <p className="mt-1 line-clamp-1 text-xs text-slate-500">{campaign.contents?.[0]?.body}</p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">
              Status: {campaign.status.replaceAll("_", " ")}
            </p>
            {selectedCampaignId === campaign.id && preview ? (
              <p className="mt-2 text-xs font-semibold text-slate-700">
                Preview: {preview.eligibleRecipientsCount} eligible - {preview.excludedRecipientsCount} excluded
              </p>
            ) : null}
            <p className="mt-2 text-xs text-slate-500">{describeCampaignActionState(campaign, {
              canRequestApproval,
              canApproveCampaigns,
              canSendCampaigns,
              isSelected: selectedCampaignId === campaign.id,
              preview,
            })}</p>
          </div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className="btn btn-secondary" onClick={() => onPreview(campaign.id)}>
                Preview
              </button>
              {campaign.status === "DRAFT" && canRequestApproval ? (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => onSubmitForApproval(campaign)}
                  disabled={submittingId !== null}
                >
                  {submittingId === campaign.id ? "Submitting..." : "Submit for approval"}
                </button>
              ) : null}
              {canApproveCampaigns && campaign.status === "APPROVAL_PENDING" ? (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => onApprove(campaign)}
                  disabled={approvingId !== null}
                >
                  {approvingId === campaign.id ? "Approving..." : "Approve"}
                </button>
              ) : null}
              {canSendCampaigns && campaign.status === "APPROVED" ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => onSend(campaign.id)}
                  disabled={
                    sendingId === campaign.id
                    || selectedCampaignId !== campaign.id
                    || !preview
                    || preview.eligibleRecipientsCount === 0
                    || campaign.status !== "APPROVED"
                  }
                >
                  {sendingId === campaign.id ? "Sending..." : "Confirm send"}
                </button>
              ) : null}
            <span className="w-fit rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-black uppercase text-slate-700">
              {campaign.status.replaceAll("_", " ")}
            </span>
          </div>
        </article>
      ))}
    </section>
  );
}

function describeCampaignActionState(
  campaign: CommunicationCampaign,
  input: {
    canRequestApproval: boolean;
    canApproveCampaigns: boolean;
    canSendCampaigns: boolean;
    isSelected: boolean;
    preview: AudienceResolution | null;
  },
) {
  if (campaign.status === "DRAFT") {
    if (!input.canRequestApproval) return "Submit for approval requires the communications.requestApproval permission.";
    return "Draft campaigns can be submitted for approval after message and audience checks pass on the backend.";
  }
  if (campaign.status === "APPROVAL_PENDING") {
    if (!input.canApproveCampaigns) return "Waiting for a user with communications.approve to review this campaign.";
    return "This campaign is waiting for approval.";
  }
  if (campaign.status === "APPROVED") {
    if (!input.canSendCampaigns) return "Confirm send requires the communications.send permission.";
    if (!input.isSelected) return "Preview this campaign before confirming send.";
    if (!input.preview) return "Load a recipient preview before confirming send.";
    if (input.preview.eligibleRecipientsCount === 0) return "No eligible recipients are available in the current preview.";
    return "This approved campaign is ready to send.";
  }
  if (campaign.status === "QUEUED" || campaign.status === "SENDING") {
    return "This campaign is already in progress.";
  }
  if (campaign.status === "FAILED") {
    return "This campaign failed during delivery. Review the delivery records before retrying.";
  }
  return "This campaign is waiting for the next workflow step.";
}

function DeliverySummary({ campaigns }: { campaigns: CommunicationCampaign[] }) {
  const totals = campaigns.reduce((sum, campaign) => sum + (campaign._count?.deliveries ?? 0), 0);
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
      <p className="font-bold text-slate-900">Delivery status</p>
      <p className="mt-1">{totals} delivery records created across current campaigns. Open a campaign row to preview and send SMS or WhatsApp.</p>
    </section>
  );
}
