export type CredentialStatus = "ACTIVE" | "DEACTIVATED";
export type CredentialType = "NFC_WRISTBAND";
export type CredentialScanStatus = "ACTIVE" | "NOT_FOUND" | "DEACTIVATED" | "STUDENT_INACTIVE";
export type AttendanceDirection = "TAP_IN" | "TAP_OUT";
export type AttendanceScanSource = "NFC_WRISTBAND" | "QR_FALLBACK";
export type AttendanceScanStatus = "VALID" | "LATE" | "BLOCKED" | "DUPLICATE";
export type StudentWalletStatus = "ACTIVE" | "FROZEN";
export type GateScanResult = "ALLOWED" | "BLOCKED";
export type FeeDefaulterBlockScope = "DAY_SCHOLARS_ONLY" | "ALL_STUDENTS";
export type AttendanceLateAction = "BLOCK_AND_MARK_ABSENT" | "ALLOW_BUT_MARK_LATE";
export type StudentFeeHoldStatus = "ACTIVE" | "CLEARED" | "CANCELLED";

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

export type NfcTokenMode = "PUBLIC_ID" | "GATE_SECURITY" | "CANTEEN_CHARGE" | "ATTENDANCE_SCAN" | "ADMIN_CREDENTIAL" | "WALLET_TOP_UP";

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

export type NfcAttendanceScanEvent = {
  student: NfcStudentSummary;
  direction: AttendanceDirection;
  status: AttendanceScanStatus;
  reason: string | null;
  scannedAt: string;
};

export type NfcAttendanceScanResponse = NfcAttendanceDashboard & {
  scan: NfcAttendanceScanEvent;
};

export type AttendanceCurrentStatus = "ABSENT" | "PRESENT" | "LATE" | "OUT" | "OUT_ONLY" | "BLOCKED" | "DUPLICATE";

export type NfcWalletRow = {
  student: NfcStudentSummary;
  wallet: {
    id: string;
    balanceCents: number;
    status: StudentWalletStatus;
    frozenReason: string | null;
    pinSet: boolean;
    pinLockedUntil: string | null;
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

export type WalletPinStatus = {
  pinSet: boolean;
  locked: boolean;
  pinLockedUntil: string | null;
  pinFailedAttempts: number;
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

export type WalletPaymentMethod = "CASH" | "MOBILE_MONEY" | "PARENT_DEPOSIT" | "ADJUSTMENT";
export type WalletTransactionType = "TOP_UP" | "CHARGE" | "REVERSAL" | "ADJUSTMENT";

export type WalletTransactionRow = {
  id: string;
  type: WalletTransactionType;
  amountCents: number;
  balanceAfterCents: number | null;
  paymentMethod: string | null;
  reference: string | null;
  description: string | null;
  idempotencyKey: string | null;
  reversalOfId: string | null;
  cashierUserId: string | null;
  createdAt: string;
  student: NfcStudentSummary;
};

export type WalletTransactionListResponse = {
  transactions: WalletTransactionRow[];
};

export type WalletReversalResult = {
  ok: boolean;
  reversal?: {
    id: string;
    amountCents: number;
    description: string | null;
    reversalOfId: string;
    createdAt: string;
  };
  wallet?: { id: string; balanceCents: number; status: StudentWalletStatus };
};

export type WalletAdjustResult = {
  ok: boolean;
  transaction?: { id: string; amountCents: number; description: string | null; createdAt: string };
  student?: NfcStudentSummary;
  walletBefore?: { id: string; balanceCents: number };
  wallet?: { id: string; balanceCents: number; status: StudentWalletStatus };
};

export type DailySummary = {
  date: string;
  summary: {
    totalChargesCents: number;
    totalTopUpsCents: number;
    totalReversalsCents: number;
    netSpendCents: number;
    chargeCount: number;
    topUpCount: number;
    reversalCount: number;
    adjustmentCount: number;
  };
  transactions: Array<{
    id: string;
    type: WalletTransactionType;
    amountCents: number;
    balanceAfterCents: number | null;
    description: string | null;
    studentId: string;
    cashierUserId: string | null;
    createdAt: string;
  }>;
};

export type CanteenReconciliationTransactionRow = {
  id: string;
  time: string;
  student: NfcStudentSummary;
  type: WalletTransactionType;
  method: string | null;
  amountCents: number;
  balanceAfterCents: number | null;
  cashierOperator: string | null;
  reference: string | null;
  status: "COMPLETED" | "PENDING" | "FAILED" | "REVERSED";
};

export type CanteenReconciliationSummary = {
  openingWalletBalanceCents: number;
  totalTopUpsCents: number;
  totalCashTopUpsCents: number;
  totalMobileMoneyTopUpsCents: number;
  totalParentDepositTopUpsCents: number;
  totalAdjustmentTopUpsCents: number;
  totalCanteenChargesCents: number;
  totalReversalsCents: number;
  netCanteenPayableCents: number;
  closingWalletBalanceCents: number;
  netWalletMovementCents: number;
  declaredCashCents: number;
  declaredMobileMoneyCents: number;
  varianceCents: number;
};

export type CanteenReconciliationRecord = {
  id: string;
  schoolId: string;
  date: string;
  shiftName: string | null;
  cashierUserId: string | null;
  canteenOperatorUserId: string | null;
  openingWalletBalanceCents: number;
  totalTopUpsCents: number;
  totalCashTopUpsCents: number;
  totalMobileMoneyTopUpsCents: number;
  totalParentDepositTopUpsCents: number;
  totalAdjustmentTopUpsCents: number;
  totalCanteenChargesCents: number;
  totalReversalsCents: number;
  netCanteenPayableCents: number;
  closingWalletBalanceCents: number;
  declaredCashCents: number | null;
  declaredMobileMoneyCents: number | null;
  varianceCents: number;
  status: "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED";
  notes: string | null;
  submittedByUserId: string | null;
  approvedByUserId: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type NfcCanteenReconciliationResponse = {
  date: string;
  cashierUserId: string | null;
  cashier: { id: string; name: string } | null;
  shiftName: string | null;
  summary: CanteenReconciliationSummary;
  reconciliation: CanteenReconciliationRecord | null;
  transactions: CanteenReconciliationTransactionRow[];
  canClose: boolean;
  canApprove: boolean;
  canReject: boolean;
};

export type NfcPolicy = {
  id: string;
  schoolId: string;
  feeDefaulterBlockingEnabled: boolean;
  feeDefaulterBlockScope: FeeDefaulterBlockScope;
  attendanceTapInCutoffEnabled: boolean;
  tapInCutoffTime: string | null;
  cutoffLateAction: AttendanceLateAction;
  timezone: string;
  gateOfflineEnabled: boolean;
  canteenOfflineEnabled: boolean;
  gateSnapshotValidHours: number;
  canteenSnapshotValidHours: number;
  maxOfflineSpendPerStudentPerDay: number;
  maxOfflineSpendPerTransaction: number;
  maxOfflineSpendPerDeviceSession: number;
  unknownCardOfflinePolicy: "DENY";
  frozenCardOfflinePolicy: "DENY";
  deactivatedCardOfflinePolicy: "DENY";
  offlineConflictPolicy: "ALLOW_AND_FLAG" | "HOLD_FOR_BURSAR_REVIEW";
  updatedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type NfcFeeHold = {
  id: string;
  schoolId: string;
  studentId: string;
  status: StudentFeeHoldStatus;
  reason: string | null;
  balanceDueCents: number | null;
  effectiveFrom: string | null;
  clearedAt: string | null;
  createdByUserId: string | null;
  clearedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
  student: NfcStudentSummary & { studentType: "DAY" | "BOARDING" | null };
};

export type NfcPolicyResponse = {
  policy: NfcPolicy;
};

export type NfcFeeHoldListResponse = {
  policy: NfcPolicy;
  feeHolds: NfcFeeHold[];
};

export type NfcWalletStudentResolution = {
  student: NfcStudentSummary;
  wallet: { id: string; balanceCents: number; status: StudentWalletStatus; pinSet: boolean } | null;
  credentialId: string | null;
};

export type NfcWalletTopUpResult = {
  ok: boolean;
  duplicate?: boolean;
  transaction?: {
    id: string;
    amountCents: number;
    paymentMethod: string | null;
    reference: string | null;
    createdAt: string;
  };
  student?: NfcStudentSummary;
  walletBefore?: { id: string; balanceCents: number };
  wallet?: { id: string; balanceCents: number; status: StudentWalletStatus };
  reason?: string;
};

export type StudentWalletTransactionRow = {
  id: string;
  type: WalletTransactionType;
  amountCents: number;
  balanceAfterCents: number | null;
  paymentMethod: string | null;
  reference: string | null;
  description: string | null;
  createdAt: string;
};

export type StudentWalletDetail = {
  student: NfcStudentSummary;
  wallet: {
    id: string;
    balanceCents: number;
    status: StudentWalletStatus;
    currency: "UGX";
  } | null;
  transactions: StudentWalletTransactionRow[];
};
