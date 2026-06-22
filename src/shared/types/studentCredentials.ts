export type CredentialStatus = "ACTIVE" | "DEACTIVATED";
export type CredentialType = "NFC_WRISTBAND";
export type CredentialScanStatus = "ACTIVE" | "NOT_FOUND" | "DEACTIVATED" | "STUDENT_INACTIVE";
export type AttendanceDirection = "TAP_IN" | "TAP_OUT";
export type AttendanceScanSource = "NFC_WRISTBAND" | "QR_FALLBACK";
export type AttendanceScanStatus = "VALID" | "BLOCKED" | "DUPLICATE";
export type StudentWalletStatus = "ACTIVE" | "FROZEN";
export type GateScanResult = "ALLOWED" | "BLOCKED";

export type StudentCredential = {
  id: string;
  type: CredentialType;
  credentialUID: string;
  scanToken: string | null;
  nfcUrl: string | null;
  status: CredentialStatus;
  issuedAt: string;
  deactivatedAt: string | null;
  deactivatedReason: string | null;
  student: {
    id: string;
    name: string;
    admissionNumber: string;
    className: string | null;
    streamName: string | null;
    isActive: boolean;
  };
};

export type StudentCredentialScanResult = {
  status: CredentialScanStatus;
  student?: {
    id: string;
    name: string;
    admissionNumber: string;
    className: string | null;
    streamName: string | null;
    photoUrl?: string | null;
  };
  credential?: {
    id: string;
    credentialUID: string;
    scanToken?: string | null;
    nfcUrl?: string | null;
    issuedAt: string;
  };
};

export type NfcStudentSummary = {
  id: string;
  name: string;
  admissionNumber: string;
  className: string | null;
  streamName: string | null;
  photoUrl?: string | null;
};

export type NfcTokenMode = "PUBLIC_ID" | "GATE_SECURITY" | "CANTEEN_CHARGE" | "ATTENDANCE_SCAN" | "ADMIN_CREDENTIAL";

export type NfcTokenResolution = {
  found: boolean;
  mode: NfcTokenMode;
  targetPath?: string;
  valid: boolean;
  actionBlocked?: boolean;
  credentialStatus: "ACTIVE" | "DEACTIVATED" | "INVALID";
  studentStatus?: "ACTIVE" | "INACTIVE";
  student?: NfcStudentSummary & { schoolName: string };
  credential?: {
    id: string;
    nfcUrl: string;
  };
};

export type AllocationStatus = "ALLOCATED" | "UNALLOCATED" | "DEACTIVATED";

export type AllocationRow = {
  student: {
    id: string;
    name: string;
    admissionNumber: string;
    classId: string | null;
    className: string | null;
    streamId: string | null;
    streamName: string | null;
    isActive: boolean;
  };
  activeCredential: StudentCredential | null;
  deactivatedCredentialsCount: number;
  allocationStatus: AllocationStatus;
};

export type AllocationSummary = {
  totalStudents: number;
  allocated: number;
  unallocated: number;
  deactivated: number;
};

export type AllocationResult = {
  summary: AllocationSummary;
  rows: AllocationRow[];
};

export type NfcAttendanceEvent = {
  id: string;
  scannedAt: string;
  direction: AttendanceDirection;
  source: AttendanceScanSource;
  status: AttendanceScanStatus;
  reason: string | null;
  student: NfcStudentSummary;
};

export type NfcAttendanceDashboard = {
  summary: {
    totalTappedIn: number;
    totalTappedOut: number;
    lateArrivals: number;
    notYetTapped: number;
  };
  events: NfcAttendanceEvent[];
};

export type NfcWalletRow = {
  student: NfcStudentSummary;
  wallet: {
    id: string;
    balanceCents: number;
    status: StudentWalletStatus;
    frozenReason: string | null;
  };
  activeCredentialStatus: CredentialStatus | "NONE";
  lastTransaction: {
    amountCents: number;
    type: "TOP_UP" | "CHARGE" | "ADJUSTMENT";
    description: string | null;
    createdAt: string;
  } | null;
};

export type NfcWalletDashboard = {
  summary: {
    totalActiveWallets: number;
    totalBalanceCents: number;
    frozenWallets: number;
    todayCanteenSpendCents: number;
  };
  wallets: NfcWalletRow[];
};

export type NfcCanteenChargeResult = {
  ok: boolean;
  transaction?: {
    id: string;
    amountCents: number;
    description: string | null;
    createdAt: string;
  };
  student?: NfcStudentSummary;
  wallet?: {
    id: string;
    balanceCents: number;
    status: StudentWalletStatus;
  };
  reason?: string;
};

export type NfcGateScanResponse = {
  result: GateScanResult;
  reason: string | null;
  scannedAt: string;
  student?: NfcStudentSummary;
  credentialStatus?: CredentialStatus | "UNKNOWN";
  todayAttendanceStatus?: AttendanceDirection | "NONE";
};

export type NfcGateDashboard = {
  recentScans: NfcGateScanResponse[];
};
