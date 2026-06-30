import type {
  ContactSummary,
  GuardianContactInput,
  StudentCreateInput,
  StudentImportJob,
  StudentImportPreview,
  StudentListItem,
  StudentsResponse,
} from "../shared/types/students";
import { getApiBaseUrl, makeSchoolRequestHeaders, parseApiError, TOKEN_KEY } from "./apiBase";

const API_BASE = getApiBaseUrl();

export async function fetchStudents(filters: { classId?: string; streamId?: string; search?: string; isActive?: string } = {}): Promise<StudentsResponse> {
  const params = new URLSearchParams();
  if (filters.classId) params.set("classId", filters.classId);
  if (filters.streamId) params.set("streamId", filters.streamId);
  if (filters.search) params.set("search", filters.search);
  if (filters.isActive) params.set("isActive", filters.isActive);
  const response = await fetch(`${API_BASE}/api/students?${params.toString()}`, {
    headers: makeSchoolRequestHeaders(),
  });
  if (!response.ok) throw new Error(await parseApiError(response, "Could not load students"));
  return response.json();
}

export async function createStudent(input: StudentCreateInput): Promise<{ admissionNumber: string }> {
  const response = await fetch(`${API_BASE}/api/students`, {
    method: "POST",
    headers: makeSchoolRequestHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error(await parseApiError(response, "Could not create student"));
  return response.json();
}

export async function previewStudentImport(formData: FormData): Promise<StudentImportPreview> {
  const response = await fetch(`${API_BASE}/api/students/import/preview`, {
    method: "POST",
    headers: makeSchoolRequestHeaders(),
    body: formData,
  });
  if (!response.ok) throw new Error(await parseApiError(response, "Could not preview import"));
  return response.json();
}

export async function commitStudentImport(formData: FormData): Promise<StudentImportJob> {
  const response = await fetch(`${API_BASE}/api/students/import-jobs/upload`, {
    method: "POST",
    headers: makeSchoolRequestHeaders(),
    body: formData,
  });
  if (!response.ok) throw new Error(await parseApiError(response, "Could not commit import"));
  return response.json();
}

export async function createStudentImportJob(formData: FormData): Promise<StudentImportJob> {
  const response = await fetch(`${API_BASE}/api/students/import-jobs/upload`, {
    method: "POST",
    headers: makeSchoolRequestHeaders(),
    body: formData,
  });
  if (!response.ok) throw new Error(await parseApiError(response, "Could not queue import"));
  return response.json();
}

export async function fetchStudentImportJob(jobId: string) {
  const response = await fetch(`${API_BASE}/api/students/import-jobs/${encodeURIComponent(jobId)}`, {
    headers: makeSchoolRequestHeaders(),
  });
  if (!response.ok) throw new Error(await parseApiError(response, "Could not load import job"));
  return response.json() as Promise<StudentImportJob>;
}

export async function downloadStudentTemplateCsv(): Promise<string> {
  const response = await fetch(`${API_BASE}/templates/student-import-template.csv`);
  if (!response.ok) throw new Error(await parseApiError(response, "Could not download template"));
  return response.text();
}

export async function fetchStudentContactSummary(): Promise<ContactSummary> {
  const response = await fetch(`${API_BASE}/api/students/contact-summary`, {
    headers: makeSchoolRequestHeaders(),
  });
  if (!response.ok) throw new Error(await parseApiError(response, "Could not load contact summary"));
  return response.json();
}

export async function createGuardianContact(studentId: string, input: GuardianContactInput): Promise<void> {
  const response = await fetch(`${API_BASE}/api/students/${studentId}/contacts`, {
    method: "POST",
    headers: makeSchoolRequestHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error(await parseApiError(response, "Could not create contact"));
}

export async function updateGuardianContact(studentId: string, contactId: string, input: GuardianContactInput): Promise<void> {
  const response = await fetch(`${API_BASE}/api/students/${studentId}/contacts/${contactId}`, {
    method: "PATCH",
    headers: makeSchoolRequestHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error(await parseApiError(response, "Could not update contact"));
}

export async function deleteGuardianContact(studentId: string, contactId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/api/students/${studentId}/contacts/${contactId}`, {
    method: "DELETE",
    headers: makeSchoolRequestHeaders(),
  });
  if (!response.ok) throw new Error(await parseApiError(response, "Could not delete contact"));
}

export async function uploadStudentPassportPhoto(studentId: string, file: File): Promise<{ studentId?: string; passportPhotoUrl: string; passportPhotoUpdatedAt: string; updatedAt?: string }> {
  const schoolToken = localStorage.getItem(TOKEN_KEY);
  if (!schoolToken) {
    throw new Error("Please log in again.");
  }
  const formData = new FormData();
  formData.set("file", file);
  const response = await fetch(`${API_BASE}/api/students/${studentId}/passport-photo`, {
    method: "POST",
    headers: makeSchoolRequestHeaders(),
    credentials: "include",
    body: formData,
  });
  if (!response.ok) throw new Error(await parseApiError(response, "Could not upload passport photo"));
  return response.json();
}

export async function deleteStudentPassportPhoto(studentId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/api/students/${studentId}/passport-photo`, {
    method: "DELETE",
    headers: makeSchoolRequestHeaders(),
  });
  if (!response.ok) throw new Error(await parseApiError(response, "Could not delete passport photo"));
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

