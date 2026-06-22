export type NfcTagStatus = "UNASSIGNED" | "ASSIGNED" | "DISABLED";
export type NfcTagType = "STUDENT";
export type NfcResolveResult = "UNKNOWN" | "UNASSIGNED" | "ASSIGNED" | "DISABLED";

export interface NfcTagStudent {
  id: string;
  name: string;
  admissionNumber: string;
  className: string | null;
  streamName: string | null;
}

export interface NfcTag {
  id: string;
  schoolId: string;
  publicCode: string;
  label: string | null;
  type: string;
  status: NfcTagStatus;
  studentId: string | null;
  student: NfcTagStudent | null;
  writtenUrl: string | null;
  assignedAt: string | null;
  lastSeenAt: string | null;
  tapCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface NfcTapEvent {
  id: string;
  publicCode: string;
  result: string;
  userAgent: string | null;
  createdAt: string;
}

export interface NfcTagListResponse {
  tags: NfcTag[];
  total: number;
}

export interface NfcGenerateResponse {
  tags: NfcTag[];
  generated: number;
}

export interface NfcTagEventsResponse {
  events: NfcTapEvent[];
  total: number;
}

export interface NfcResolveResponse {
  result: NfcResolveResult;
  /** Present when result === "ASSIGNED" and caller is authenticated */
  student?: NfcTagStudent;
}
