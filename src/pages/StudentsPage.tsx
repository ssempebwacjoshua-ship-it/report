import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { fetchReportContext } from "../client/reportsClient";
import {
  createGuardianContact,
  deleteGuardianContact,
  EMPTY_CONTACT_INPUT,
  fetchStudents,
  updateGuardianContact,
} from "../client/studentsClient";
import { Icon } from "../components/layout/Icon";
import type { ReportContext, ReportFilters } from "../shared/types/reports";
import type { GuardianContact, GuardianContactInput, StudentListItem } from "../shared/types/students";

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
                className={`rounded-2xl border px-3 py-3 text-left transition-all duration-200 ${
                  selectedId === student.id
                    ? "border-blue-300 bg-gradient-to-br from-white via-blue-50 to-emerald-50 shadow-[0_14px_30px_rgba(37,99,235,0.16)] ring-2 ring-blue-100"
                    : "border-slate-200 bg-white shadow-sm hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50/50 hover:shadow-md"
                }`}
              >
                <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-slate-950">{student.studentName}</p>
                    <p className="mt-0.5 text-xs font-semibold text-slate-500">{student.admissionNumber}</p>
                    <p className="mt-1 text-xs font-semibold text-slate-600">{student.className} / {student.streamName}</p>
                  </div>
                  <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700">{student.enrollmentStatus}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        <section className="premium-card min-w-0 rounded-2xl p-5">
          {selected ? (
            <div className="grid gap-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-blue-600">Student profile</p>
                  <h2 className="mt-1 text-2xl font-bold text-slate-950">{selected.studentName}</h2>
                  <p className="text-sm text-slate-500">{selected.admissionNumber} - {selected.className} / {selected.streamName}</p>
                </div>
                <Link className="btn btn-secondary" to={`/reports`}>
                  <Icon name="file" className="h-4 w-4" />
                  View report
                </Link>
              </div>

              <div className="grid gap-3 md:grid-cols-4">
                {[
                  ["Enrollment", selected.enrollmentStatus],
                  ["Class", selected.className],
                  ["Stream", selected.streamName],
                  ["Reports", contactLabels[selected.contactReadiness]],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
                    <p className="mt-1 text-sm font-black text-slate-950">{value}</p>
                  </div>
                ))}
              </div>

              <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-950">Report readiness</h3>
                    <p className="mt-1 text-sm text-slate-600">{selected.contactSummary}</p>
                  </div>
                  <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${readinessClass(selected.contactReadiness)}`}>
                    {contactLabels[selected.contactReadiness]}
                  </span>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-950">Parent / guardian contacts</h3>
                    <p className="text-xs text-slate-500">{contactLabels[selected.contactReadiness]}</p>
                  </div>
                  <button type="button" className="btn btn-primary" onClick={addContact}>Add contact</button>
                </div>

                <div className="mt-4 grid gap-3">
                  {selected.guardianContacts.map((contact) => (
                    <div key={contact.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-bold text-slate-950">{contact.guardianName}</p>
                          <p className="text-xs text-slate-500">{contact.relationship} - {contact.preferredContactMethod}</p>
                          <p className="mt-2 text-sm text-slate-600">{contact.phone || "No phone"} / {contact.email || "No email"}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {contact.isPrimary ? <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-bold text-blue-700">Primary</span> : null}
                          {contact.canReceiveReports ? <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700">Reports</span> : <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-bold text-red-700">No reports</span>}
                          <button type="button" className="btn btn-secondary min-h-8 px-3 py-1 text-xs" onClick={() => editContact(contact)}>Edit</button>
                          <button type="button" className="btn btn-danger-light min-h-8 px-3 py-1 text-xs" onClick={() => void removeContact(contact.id)}>Remove</button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {selected.guardianContacts.length === 0 ? <p className="text-sm text-slate-500">No guardian contacts yet.</p> : null}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <h3 className="text-sm font-bold text-slate-950">{editingContactId ? "Edit contact" : "Add contact"}</h3>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <input className="premium-control h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none" value={contactInput.guardianName} onChange={(event) => setContactInput({ ...contactInput, guardianName: event.target.value })} placeholder="Guardian name" />
                  <input className="premium-control h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none" value={contactInput.relationship} onChange={(event) => setContactInput({ ...contactInput, relationship: event.target.value })} placeholder="Relationship" />
                  <input className="premium-control h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none" value={contactInput.phone ?? ""} onChange={(event) => setContactInput({ ...contactInput, phone: event.target.value })} placeholder="Phone" />
                  <input className="premium-control h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none" value={contactInput.email ?? ""} onChange={(event) => setContactInput({ ...contactInput, email: event.target.value })} placeholder="Email" />
                  <select className="premium-control h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none" value={contactInput.preferredContactMethod} onChange={(event) => setContactInput({ ...contactInput, preferredContactMethod: event.target.value as GuardianContactInput["preferredContactMethod"] })}>
                    <option value="PHONE">Phone</option>
                    <option value="SMS">SMS</option>
                    <option value="EMAIL">Email</option>
                    <option value="WHATSAPP">WhatsApp</option>
                  </select>
                  <input className="premium-control h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none" value={contactInput.notes ?? ""} onChange={(event) => setContactInput({ ...contactInput, notes: event.target.value })} placeholder="Notes" />
                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <input type="checkbox" checked={contactInput.isPrimary} onChange={(event) => setContactInput({ ...contactInput, isPrimary: event.target.checked })} />
                    Primary contact
                  </label>
                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <input type="checkbox" checked={contactInput.canReceiveReports} onChange={(event) => setContactInput({ ...contactInput, canReceiveReports: event.target.checked })} />
                    Can receive reports
                  </label>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button type="button" className="btn btn-success" onClick={() => void saveContact()}>Save contact</button>
                  <button type="button" className="btn btn-secondary" onClick={() => { setEditingContactId(null); setContactInput(EMPTY_CONTACT_INPUT); }}>Reset</button>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500">Select an enrolled student to view contacts.</p>
          )}
        </section>
      </section>
    </main>
  );
}
