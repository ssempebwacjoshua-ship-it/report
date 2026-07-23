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

export type NfcTagMode = "URL" | "UID" | "TEXT";
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
  writtenPayload: string | null;
  issuedAt: string | null;
  writtenAt: string | null;
  verifiedAt: string | null;
  assignedAt: string | null;
  lastSeenAt: string | null;
  tapCount: number;
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

export interface ReaderCredentialCapturePreview {
  maskedCanonicalCredential: string | null;
  maskedAliases: string[];
  credential: string | null;
  rawWiegandDecimal: string | null;
  rawWiegandHex: string | null;
  facilityCode: string | null;
  cardNumber: string | null;
  capturedAt: string;
  readerId: string;
  readerName: string;
}

export interface ReaderCredentialCaptureSession {
  captureId: string;
  tagId: string;
  studentId: string;
  deviceId: string | null;
  deviceLabel: string | null;
  createdAt: string;
  expiresAt: string;
  confirmedAt: string | null;
  status: "PENDING" | "CAPTURED" | "CONFIRMED" | "CANCELLED" | "EXPIRED";
  preview: ReaderCredentialCapturePreview | null;
}

export interface ReaderCredentialCaptureStartResponse extends ReaderCredentialCaptureSession {
  tag: {
    id: string;
    publicCode: string;
    label: string | null;
    student: {
      id: string;
      name: string;
      admissionNumber: string;
    };
  };
}

export interface ReaderCredentialLinkConfirmResponse {
  ok: true;
  captureId: string;
  maskedCanonicalCredential: string | null;
  credentialId: string;
  tag: {
    id: string;
    publicCode: string;
    physicalUid: string | null;
    studentId: string | null;
    student: {
      id: string;
      name: string;
      admissionNumber: string;
    } | null;
  };
}

export interface ReaderCredentialConflictResponse {
  ok: false;
  error: true;
  code: "READER_CREDENTIAL_CONFLICT";
  message: string;
  requestId: string;
  conflict: {
    code: "READER_CREDENTIAL_CONFLICT";
    message: string;
    previousStudent: {
      name: string;
      admissionNumber: string;
    };
    previousCredential: {
      status: string;
      maskedCredential: string | null;
    };
    previousTag: {
      label: string | null;
      publicCodePrefix: string | null;
      physicalUidMatched: boolean;
    } | null;
    matchedAliasMasked: string | null;
    matchedAliasSource: string | null;
    matchedAliasStrength: "STRONG" | "WEAK";
    canTransfer: boolean;
  };
}

export interface ReaderCredentialTransferResponse {
  ok: true;
  transfer: true;
  captureId: string;
  reason: string;
  previousStudent: {
    name: string;
    admissionNumber: string;
  };
  tag: {
    id: string;
    publicCode: string;
    physicalUid: string | null;
    studentId: string | null;
    student: {
      name: string;
      admissionNumber: string;
    } | null;
  };
  credentialId: string;
}

export interface NfcTagWriteCommandPayload {
  tagId: string;
  studentId: string;
  publicCode: string;
  payload: string;
  format: "NDEF_TEXT";
  verifyAfterWrite: boolean;
  captureReaderCredential: boolean;
}

export interface NfcTagWriteCommandSummary {
  id: string;
  type: "WRITE_NFC_TAG_PAYLOAD";
  status: "PENDING" | "SENT" | "WRITING" | "WRITTEN" | "VERIFYING" | "VERIFIED" | "FAILED";
  createdAt: string;
  requestedAt: string;
  sentAt: string | null;
  writeStartedAt: string | null;
  writeCompletedAt: string | null;
  verifyStartedAt: string | null;
  verifiedAt: string | null;
  failedAt: string | null;
  completedAt: string | null;
  lastStatusAt: string | null;
  lastStatusMessage: string | null;
  errorMessage: string | null;
  payload: NfcTagWriteCommandPayload;
  device: {
    id: string;
    name: string | null;
    deviceKey: string | null;
    label: string;
    onlineStatus: string | null;
    lastSeenAt: string | null;
    lastHeartbeatAt: string | null;
  } | null;
  tag: {
    id: string;
    publicCode: string;
    label: string | null;
    status: string | null;
    physicalUid: string | null;
    writtenPayload: string;
    student: {
      id: string;
      name: string;
      admissionNumber: string;
    } | null;
  };
  writtenPayload: string | null;
  readbackPayload: string | null;
  mobilePayloadStatus: "pending" | "written" | "verified" | "failed";
  readerCredentialStatus: "pending" | "linked" | "failed" | "not_requested";
  readerCredentialLinkedAt: string | null;
  readerCredentialError: string | null;
}
