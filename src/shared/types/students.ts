export type EnrollmentStatus = "ACTIVE" | "TRANSFERRED" | "COMPLETED" | "INACTIVE";
export type PreferredContactMethod = "PHONE" | "SMS" | "EMAIL" | "WHATSAPP";
export type ContactReadiness = "READY" | "NO_RECIPIENT" | "MISSING_PHONE_EMAIL";

export type GuardianContact = {
  id: string;
  guardianName: string;
  relationship: string;
  phone: string | null;
  email: string | null;
  preferredContactMethod: PreferredContactMethod;
  isPrimary: boolean;
  canReceiveReports: boolean;
  notes: string | null;
};

export type StudentListItem = {
  id: string;
  admissionNumber: string;
  studentName: string;
  isActive: boolean;
  enrollmentStatus: EnrollmentStatus;
  className: string;
  classId: string;
  streamName: string;
  streamId: string;
  academicYearId: string;
  termId: string;
  contactReadiness: ContactReadiness;
  contactSummary: string;
  guardianContacts: GuardianContact[];
};

export type StudentsResponse = {
  students: StudentListItem[];
};

export type ContactSummary = {
  guardians: number;
  emailContacts: number;
  phoneContacts: number;
  reportRecipients: number;
};

export type GuardianContactInput = {
  guardianName: string;
  relationship: string;
  phone?: string;
  email?: string;
  preferredContactMethod: PreferredContactMethod;
  isPrimary: boolean;
  canReceiveReports: boolean;
  notes?: string;
};

export type StudentImportMode = "CREATE_ONLY" | "CREATE_AND_UPDATE_EXISTING";

export type StudentCreateInput = {
  fullName: string;
  admissionNumber?: string;
  gender?: string;
  classId: string;
  streamId: string;
  isActive: boolean;
  guardianName?: string;
  guardianPhone?: string;
  guardianEmail?: string;
  notes?: string;
  schoolCode?: string;
};

export type StudentImportRowInput = {
  admissionNumber?: string;
  fullName: string;
  gender?: string;
  className: string;
  streamName: string;
  guardianName?: string;
  guardianPhone?: string;
  guardianEmail?: string;
  status?: string;
};

export type StudentImportPreviewRow = {
  rowNumber: number;
  raw: StudentImportRowInput;
  isValid: boolean;
  errors: string[];
  action: "create" | "update" | "duplicate" | "invalid";
  existingStudentId?: string | null;
  generatedAdmissionNumber?: string | null;
};

export type StudentImportPreview = {
  status: "PREVIEW";
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  createRows: number;
  updateRows: number;
  rows: StudentImportPreviewRow[];
  mode: StudentImportMode;
};

export type StudentImportCommitResult = StudentImportPreview & {
  status: "COMMITTED";
  batchId: string;
};

export type StudentImportJob = {
  jobId: string;
  status: "QUEUED";
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
};

export type StudentListFilters = {
  schoolCode?: string;
  classId?: string;
  streamId?: string;
  search?: string;
  isActive?: string;
};
