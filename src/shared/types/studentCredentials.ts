export type CredentialStatus = "ACTIVE" | "DEACTIVATED";
export type CredentialType = "NFC_WRISTBAND";
export type CredentialScanStatus = "ACTIVE" | "NOT_FOUND" | "DEACTIVATED" | "STUDENT_INACTIVE";

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

export type NfcTokenMode = "PUBLIC_ID" | "GATE_SECURITY" | "CANTEEN_CHARGE" | "ATTENDANCE_SCAN" | "ADMIN_CREDENTIAL";

export type NfcTokenResolution = {
  found: boolean;
  mode: NfcTokenMode;
  targetPath?: string;
  valid: boolean;
  actionBlocked?: boolean;
  credentialStatus: "ACTIVE" | "DEACTIVATED" | "INVALID";
  studentStatus?: "ACTIVE" | "INACTIVE";
  student?: {
    id: string;
    name: string;
    admissionNumber: string;
    className: string | null;
    streamName: string | null;
    photoUrl?: string | null;
    schoolName: string;
  };
  credential?: {
    id: string;
    nfcUrl: string;
  };
};
