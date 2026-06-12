import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { fetchReportContext } from "../client/reportsClient";
import {
  commitStudentImport,
  createGuardianContact,
  createStudent,
  downloadStudentTemplateCsv,
  deleteGuardianContact,
  EMPTY_CONTACT_INPUT,
  fetchStudents,
  previewStudentImport,
  updateGuardianContact,
} from "../client/studentsClient";
import { Icon } from "../components/layout/Icon";
import type { ReportContext, ReportFilters } from "../shared/types/reports";
import type { GuardianContact, GuardianContactInput, StudentImportPreview, StudentListItem } from "../shared/types/students";

const contactLabels = {
  READY: "Parent contact ready",
  NO_RECIPIENT: "No report recipient",
  MISSING_PHONE_EMAIL: "Missing phone/email",
};

function readinessClass(readiness: StudentListItem["contactReadiness"]) {
  if (readiness === "READY") return "bg-emerald-100 text-emerald-700";
  if (readiness === "NO_RECIPIENT") return "bg-red-100 text-red-700";
  return "bg-amber-100 text-amber-700";
}

function toContactInput(contact: GuardianContact): GuardianContactInput {
  return {
    guardianName: contact.guardianName,
    relationship: contact.relationship,
    phone: contact.phone ?? "",
    email: contact.email ?? "",
    preferredContactMethod: contact.preferredContactMethod,
    isPrimary: contact.isPrimary,
    canReceiveReports: contact.canReceiveReports,
    notes: contact.notes ?? "",
  };
}

export function StudentsPage() {
  const [context, setContext] = useState<ReportContext | null>(null);
  const [students, setStudents] = useState<StudentListItem[]>([]);
  const [filters, setFilters] = useState<Pick<ReportFilters, "classId" | "streamId" | "search">>({ classId: "", streamId: "", search: "" });
  const [selectedId, setSelectedId] = useState("");
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [contactInput, setContactInput] = useState<GuardianContactInput>(EMPTY_CONTACT_INPUT);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [studentForm, setStudentForm] = useState({ fullName: "", admissionNumber: "", gender: "", classId: "", streamId: "", isActive: true, guardianName: "", guardianPhone: "", guardianEmail: "", notes: "" });
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<StudentImportPreview | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchReportContext()
      .then((loaded) => {
        setContext(loaded);
        setFilters((current) => ({ ...current, classId: loaded.classes[0]?.id ?? "" }));
      })
      .catch((caught: Error) => setError(caught.message));
  }, []);

  useEffect(() => {
    fetchStudents(filters)
      .then((response) => {
        setStudents(response.students);
        setSelectedId((current) => (response.students.some((student) => student.id === current) ? current : response.students[0]?.id ?? ""));
      })
      .catch((caught: Error) => setError(caught.message));
  }, [filters]);

  const selected = useMemo(() => students.find((student) => student.id === selectedId) ?? null, [students, selectedId]);
  const streams = context?.streams.filter((stream) => stream.classId === filters.classId) ?? [];

  function editContact(contact: GuardianContact) {
    setEditingContactId(contact.id);
    setContactInput(toContactInput(contact));
  }

  function addContact() {
    setEditingContactId(null);
    setContactInput({ ...EMPTY_CONTACT_INPUT, isPrimary: selected?.guardianContacts.length === 0 });
  }

  async function submitStudent() {
    try {
      const result = await createStudent({ ...studentForm, schoolCode: context?.school?.code ?? "SCU-PREVIEW" });
      setError(`Student created: ${result.admissionNumber}`);
      setShowAddForm(false);
      const refreshed = await fetchStudents(filters);
      setStudents(refreshed.students);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create student");
    }
  }

  async function previewImport() {
    if (!importFile) return;
    const formData = new FormData();
    formData.set("file", importFile);
    const preview = await previewStudentImport(formData, context?.school?.code ?? "SCU-PREVIEW");
    setImportPreview(preview);
  }

  async function commitImport() {
    if (!importFile) return;
    const formData = new FormData();
    formData.set("file", importFile);
    const result = await commitStudentImport(formData, context?.school?.code ?? "SCU-PREVIEW");
    setImportPreview(result);
    const refreshed = await fetchStudents(filters);
    setStudents(refreshed.students);
  }

  async function saveContact() {
    if (!selected) return;
    setError("");
    try {
      if (editingContactId) await updateGuardianContact(selected.id, editingContactId, contactInput);
      else await createGuardianContact(selected.id, contactInput);
      const response = await fetchStudents(filters);
      setStudents(response.students);
      setEditingContactId(null);
      setContactInput(EMPTY_CONTACT_INPUT);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save contact");
    }
  }

  async function removeContact(contactId: string) {
    if (!selected) return;
    setError("");
    try {
      await deleteGuardianContact(selected.id, contactId);
      const response = await fetchStudents(filters);
      setStudents(response.students);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not delete contact");
    }
  }

  return (
    <main className="grid gap-5">
      <header className="page-header flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-blue-600">Students</p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">Enrolled students and report contacts</h1>
          <p className="mt-1 text-sm text-slate-500">Reports can only be issued for actively enrolled students.</p>
        </div>
        <Link className="btn btn-primary" to="/reports">Report Generation</Link>
      </header>

      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 shadow-sm">{error}</div> : null}

      <section className="grid gap-3 lg:grid-cols-2">
        <div className="premium-card rounded-2xl p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-950">Add Student</h2>
            <button type="button" className="btn btn-secondary" onClick={() => setShowAddForm((current) => !current)}>{showAddForm ? "Close" : "Add Student"}</button>
          </div>
          {showAddForm ? (
            <div className="grid gap-2 md:grid-cols-2">
              <input className="premium-control h-9 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm outline-none" placeholder="Full name" value={studentForm.fullName} onChange={(e) => setStudentForm({ ...studentForm, fullName: e.target.value })} />
              <input className="premium-control h-9 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm outline-none" placeholder="Admission number" value={studentForm.admissionNumber} onChange={(e) => setStudentForm({ ...studentForm, admissionNumber: e.target.value })} />
              <select className="premium-control h-9 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm outline-none" value={studentForm.classId} onChange={(e) => setStudentForm({ ...studentForm, classId: e.target.value })}>
                <option value="">Class</option>
                {context?.classes.map((klass) => <option key={klass.id} value={klass.id}>{klass.name}</option>)}
              </select>
              <select className="premium-control h-9 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm outline-none" value={studentForm.streamId} onChange={(e) => setStudentForm({ ...studentForm, streamId: e.target.value })}>
                <option value="">Stream</option>
                {streams.map((stream) => <option key={stream.id} value={stream.id}>{stream.name}</option>)}
              </select>
              <input className="premium-control h-9 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm outline-none" placeholder="Guardian name" value={studentForm.guardianName} onChange={(e) => setStudentForm({ ...studentForm, guardianName: e.target.value })} />
              <input className="premium-control h-9 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm outline-none" placeholder="Guardian phone" value={studentForm.guardianPhone} onChange={(e) => setStudentForm({ ...studentForm, guardianPhone: e.target.value })} />
              <input className="premium-control h-9 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm outline-none" placeholder="Guardian email" value={studentForm.guardianEmail} onChange={(e) => setStudentForm({ ...studentForm, guardianEmail: e.target.value })} />
              <button type="button" className="btn btn-primary" onClick={() => void submitStudent()}>Create</button>
            </div>
          ) : null}
        </div>

        <div className="premium-card rounded-2xl p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-950">Import Students</h2>
            <div className="flex gap-2">
              <a className="btn btn-secondary" href="/api/students/import/template.csv">CSV template</a>
              <a className="btn btn-secondary" href="/api/students/import/template.xlsx">XLSX template</a>
              <button type="button" className="btn btn-secondary" onClick={() => setShowImport((current) => !current)}>{showImport ? "Close" : "Import Students"}</button>
            </div>
          </div>
          {showImport ? (
            <div className="grid gap-3">
              <input type="file" accept=".csv,.xlsx" onChange={(e) => setImportFile(e.target.files?.[0] ?? null)} />
              <div className="flex gap-2">
                <button type="button" className="btn btn-primary" onClick={() => void previewImport()} disabled={!importFile}>Preview</button>
                <button type="button" className="btn btn-success" onClick={() => void commitImport()} disabled={!importPreview || importPreview.invalidRows > 0}>Commit</button>
              </div>
              {importPreview ? <pre className="overflow-auto rounded-xl bg-slate-950 p-3 text-xs text-slate-100">{JSON.stringify(importPreview, null, 2)}</pre> : null}
            </div>
          ) : null}
        </div>
      </section>

      <section className="premium-card rounded-2xl p-4">
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-4">
          <label className="grid gap-1 text-xs font-bold uppercase text-slate-500">
            Class
            <select className="premium-control h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-900 outline-none" value={filters.classId} onChange={(event) => setFilters({ ...filters, classId: event.target.value, streamId: "" })}>
              <option value="">All classes</option>
              {context?.classes.map((klass) => <option key={klass.id} value={klass.id}>{klass.name}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-bold uppercase text-slate-500">
            Stream
            <select className="premium-control h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-900 outline-none" value={filters.streamId ?? ""} onChange={(event) => setFilters({ ...filters, streamId: event.target.value })}>
              <option value="">All streams</option>
              {streams.map((stream) => <option key={stream.id} value={stream.id}>{stream.name}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-bold uppercase text-slate-500 md:col-span-1 xl:col-span-2">
            Search
            <input className="premium-control h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-900 outline-none" value={filters.search ?? ""} onChange={(event) => setFilters({ ...filters, search: event.target.value })} placeholder="Name, admission number, guardian phone" />
          </label>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(300px,0.78fr)_minmax(0,1.35fr)]">
        <div className="grid content-start gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-950">Enrolled students</h2>
            <span className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-sm font-bold text-blue-700 shadow-sm">{students.length} enrolled</span>
          </div>
          {students.length === 0 ? (
            <div className="premium-card rounded-2xl p-5 text-sm text-slate-600">No enrolled students found for this class and stream.</div>
          ) : null}
          <div className="grid gap-2">
            {students.map((student) => (
              <button
                key={student.id}
                type="button"
                onClick={() => setSelectedId(student.id)}
                className={`rounded-2xl border px-3 py-2 text-left transition-all duration-200 ${
                  selectedId === student.id
                    ? "border-blue-300 bg-gradient-to-br from-white via-blue-50 to-emerald-50 shadow-[0_14px_30px_rgba(37,99,235,0.16)] ring-2 ring-blue-100"
                    : "border-slate-200 bg-white shadow-sm hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50/50 hover:shadow-md"
                }`}
              >
                <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-950">{student.studentName}</p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="font-semibold">{student.admissionNumber}</span>
                      <span className="text-slate-400">•</span>
                      <span className="text-slate-600">{student.className} / {student.streamName}</span>
                    </div>
                  </div>
                  <span className="flex-shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700">{student.enrollmentStatus}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        <section className="premium-card min-w-0 rounded-2xl p-5">
          {selected ? (
            <div className="grid gap-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-blue-600">Student profile</p>
                  <h2 className="mt-1 text-2xl font-bold text-slate-950">{selected.studentName}</h2>
                  <p className="text-sm text-slate-500">{selected.admissionNumber}</p>
                </div>
                <Link className="btn btn-primary" to={`/reports`}>
                  <Icon name="file" className="h-4 w-4" />
                  View report
                </Link>
              </div>

              <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-600">Class:</span>
                  <span className="font-bold text-slate-950">{selected.className}</span>
                </div>
                <span className="text-slate-400">•</span>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-600">Stream:</span>
                  <span className="font-bold text-slate-950">{selected.streamName}</span>
                </div>
                <span className="text-slate-400">•</span>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-600">Status:</span>
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-bold ${selected.enrollmentStatus === "ACTIVE" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                    {selected.enrollmentStatus}
                  </span>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-950">Parent / guardian contacts</h3>
                    <p className="mt-1 text-xs text-slate-500">{selected.contactSummary}</p>
                  </div>
                  <button type="button" className="btn btn-primary" onClick={addContact}>Add contact</button>
                </div>

                <div className="mt-4 grid gap-3">
                  {selected.guardianContacts.map((contact) => (
                    <div key={contact.id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-bold text-slate-950">{contact.guardianName}</p>
                          <p className="mt-0.5 text-xs text-slate-500">{contact.relationship} • {contact.preferredContactMethod}</p>
                          <p className="mt-1 text-xs text-slate-600">{contact.phone || "—"} / {contact.email || "—"}</p>
                        </div>
                        <div className="flex flex-shrink-0 flex-wrap gap-1">
                          {contact.isPrimary ? <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-700">Primary</span> : null}
                          {contact.canReceiveReports ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700">Reports</span> : null}
                          <button type="button" className="btn btn-secondary min-h-7 px-2.5 py-0.5 text-xs" onClick={() => editContact(contact)}>Edit</button>
                          <button type="button" className="btn btn-danger-light min-h-7 px-2.5 py-0.5 text-xs" onClick={() => void removeContact(contact.id)}>Remove</button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {selected.guardianContacts.length === 0 ? <p className="text-sm text-slate-500">No guardian contacts yet.</p> : null}
                </div>
              </div>

              {editingContactId !== null && (
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <h3 className="text-sm font-bold text-slate-950">Edit contact</h3>
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    <input className="premium-control h-9 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm outline-none" value={contactInput.guardianName} onChange={(event) => setContactInput({ ...contactInput, guardianName: event.target.value })} placeholder="Guardian name" />
                    <input className="premium-control h-9 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm outline-none" value={contactInput.relationship} onChange={(event) => setContactInput({ ...contactInput, relationship: event.target.value })} placeholder="Relationship" />
                    <input className="premium-control h-9 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm outline-none" value={contactInput.phone ?? ""} onChange={(event) => setContactInput({ ...contactInput, phone: event.target.value })} placeholder="Phone" />
                    <input className="premium-control h-9 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm outline-none" value={contactInput.email ?? ""} onChange={(event) => setContactInput({ ...contactInput, email: event.target.value })} placeholder="Email" />
                    <select className="premium-control h-9 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm outline-none" value={contactInput.preferredContactMethod} onChange={(event) => setContactInput({ ...contactInput, preferredContactMethod: event.target.value as GuardianContactInput["preferredContactMethod"] })}>
                      <option value="PHONE">Phone</option>
                      <option value="SMS">SMS</option>
                      <option value="EMAIL">Email</option>
                      <option value="WHATSAPP">WhatsApp</option>
                    </select>
                    <input className="premium-control h-9 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm outline-none" value={contactInput.notes ?? ""} onChange={(event) => setContactInput({ ...contactInput, notes: event.target.value })} placeholder="Notes (optional)" />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                      <input type="checkbox" checked={contactInput.isPrimary} onChange={(event) => setContactInput({ ...contactInput, isPrimary: event.target.checked })} />
                      Primary
                    </label>
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                      <input type="checkbox" checked={contactInput.canReceiveReports} onChange={(event) => setContactInput({ ...contactInput, canReceiveReports: event.target.checked })} />
                      Can receive reports
                    </label>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" className="btn btn-success" onClick={() => void saveContact()}>Save</button>
                    <button type="button" className="btn btn-secondary" onClick={() => { setEditingContactId(null); setContactInput(EMPTY_CONTACT_INPUT); }}>Cancel</button>
                  </div>
                </div>
              )}

              {editingContactId === null && (
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <h3 className="text-sm font-bold text-slate-950">Add new contact</h3>
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    <input className="premium-control h-9 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm outline-none" value={contactInput.guardianName} onChange={(event) => setContactInput({ ...contactInput, guardianName: event.target.value })} placeholder="Guardian name" />
                    <input className="premium-control h-9 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm outline-none" value={contactInput.relationship} onChange={(event) => setContactInput({ ...contactInput, relationship: event.target.value })} placeholder="Relationship" />
                    <input className="premium-control h-9 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm outline-none" value={contactInput.phone ?? ""} onChange={(event) => setContactInput({ ...contactInput, phone: event.target.value })} placeholder="Phone" />
                    <input className="premium-control h-9 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm outline-none" value={contactInput.email ?? ""} onChange={(event) => setContactInput({ ...contactInput, email: event.target.value })} placeholder="Email" />
                    <select className="premium-control h-9 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm outline-none" value={contactInput.preferredContactMethod} onChange={(event) => setContactInput({ ...contactInput, preferredContactMethod: event.target.value as GuardianContactInput["preferredContactMethod"] })}>
                      <option value="PHONE">Phone</option>
                      <option value="SMS">SMS</option>
                      <option value="EMAIL">Email</option>
                      <option value="WHATSAPP">WhatsApp</option>
                    </select>
                    <input className="premium-control h-9 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm outline-none" value={contactInput.notes ?? ""} onChange={(event) => setContactInput({ ...contactInput, notes: event.target.value })} placeholder="Notes (optional)" />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                      <input type="checkbox" checked={contactInput.isPrimary} onChange={(event) => setContactInput({ ...contactInput, isPrimary: event.target.checked })} />
                      Primary
                    </label>
                    <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                      <input type="checkbox" checked={contactInput.canReceiveReports} onChange={(event) => setContactInput({ ...contactInput, canReceiveReports: event.target.checked })} />
                      Can receive reports
                    </label>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" className="btn btn-success" onClick={() => void saveContact()}>Add contact</button>
                    <button type="button" className="btn btn-secondary" onClick={() => setContactInput(EMPTY_CONTACT_INPUT)}>Reset</button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-500">Select an enrolled student to view contacts.</p>
          )}
        </section>
      </section>
    </main>
  );
}
