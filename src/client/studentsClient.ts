import type { ContactSummary, GuardianContactInput, StudentListItem, StudentsResponse } from "../shared/types/students";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4300";

async function readError(response: Response, fallback: string): Promise<string> {
  try {
    const body = await response.json();
    if (typeof body?.error === "string") return body.error;
    if (Array.isArray(body?.issues)) return body.issues.map((issue: { message?: string }) => issue.message).filter(Boolean).join("; ");
  } catch {
    return fallback;
  }
  return fallback;
}

export async function fetchStudents(filters: { schoolCode?: string; classId?: string; streamId?: string; search?: string } = {}): Promise<StudentsResponse> {
  const params = new URLSearchParams();
  params.set("schoolCode", filters.schoolCode ?? "SCU-PREVIEW");
  if (filters.classId) params.set("classId", filters.classId);
  if (filters.streamId) params.set("streamId", filters.streamId);
  if (filters.search) params.set("search", filters.search);
  const response = await fetch(`${API_BASE}/internal/students?${params.toString()}`);
  if (!response.ok) throw new Error(await readError(response, "Could not load students"));
  return response.json();
}

export async function fetchStudentContactSummary(schoolCode = "SCU-PREVIEW"): Promise<ContactSummary> {
  const response = await fetch(`${API_BASE}/internal/students/contact-summary?schoolCode=${encodeURIComponent(schoolCode)}`);
  if (!response.ok) throw new Error(await readError(response, "Could not load contact summary"));
  return response.json();
}

export async function createGuardianContact(studentId: string, input: GuardianContactInput): Promise<void> {
  const response = await fetch(`${API_BASE}/internal/students/${studentId}/contacts?schoolCode=SCU-PREVIEW`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error(await readError(response, "Could not create contact"));
}

export async function updateGuardianContact(studentId: string, contactId: string, input: GuardianContactInput): Promise<void> {
  const response = await fetch(`${API_BASE}/internal/students/${studentId}/contacts/${contactId}?schoolCode=SCU-PREVIEW`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error(await readError(response, "Could not update contact"));
}

export async function deleteGuardianContact(studentId: string, contactId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/internal/students/${studentId}/contacts/${contactId}?schoolCode=SCU-PREVIEW`, {
    method: "DELETE",
  });
  if (!response.ok) throw new Error(await readError(response, "Could not delete contact"));
}

export const EMPTY_CONTACT_INPUT: GuardianContactInput = {
  guardianName: "",
  relationship: "Parent",
  phone: "",
  email: "",
  preferredContactMethod: "PHONE",
  isPrimary: false,
  canReceiveReports: true,
  notes: "",
};
