export type NfcTagStatus =
  | "UNASSIGNED"   // legacy URL tag, not yet linked to student
  | "ASSIGNED"     // linked to student
  | "DISABLED"     // disabled
  // New statuses:
  | "GENERATED"    // URL tag: record created, writtenUrl set
  | "WRITTEN"      // URL tag: physically written to chip
  | "VERIFIED"     // tapped/scanned and confirmed working
  | "REGISTERED"   // UID wristband: imported into inventory
  | "UNALLOCATED"  // ready to assign (synonym of UNASSIGNED for new tags)
  | "LOST";

export type NfcTagMode = "URL" | "UID";
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
  batchId: string | null;
  publicCode: string;
  physicalUid: string | null;
  tagMode: NfcTagMode;
  label: string | null;
  type: string;
  purpose: string;
  status: NfcTagStatus;
  studentId: string | null;
  student: NfcTagStudent | null;
  writtenUrl: string | null;
  issuedAt: string | null;
  writtenAt: string | null;
  verifiedAt: string | null;
  assignedAt: string | null;
  lastSeenAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NfcTagBatch {
  id: string;
  name: string;
  tagMode: NfcTagMode;
  quantity: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface NfcTagBatchSummary extends NfcTagBatch {
  totalTags: number;
  written: number;
  verified: number;
  unallocated: number;
  assigned: number;
  disabled: number;
  lost: number;
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

export interface NfcTagBatchListResponse {
  batches: NfcTagBatchSummary[];
  total: number;
}

export interface NfcTagInventoryResponse {
  tags: NfcTag[];
  total: number;
}

export interface NfcUrlBatchCreateResponse {
  batch: NfcTagBatch;
  tags: NfcTag[];
  generated: number;
}

export interface NfcUidImportResponse {
  batch: NfcTagBatch;
  tags: NfcTag[];
  registered: number;
}

export interface NfcInventoryAllocateResponse {
  tags: NfcTag[];
  credentialCount: number;
}
