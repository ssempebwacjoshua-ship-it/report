export type CredentialStatus = "ACTIVE" | "DEACTIVATED";
export type CredentialType = "NFC_WRISTBAND";
export type CredentialScanStatus = "ACTIVE" | "NOT_FOUND" | "DEACTIVATED" | "STUDENT_INACTIVE";

export type StudentCredential = {
  id: string;
  type: CredentialType;
  credentialUID: string;
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
    issuedAt: string;
  };
};
