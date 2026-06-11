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
