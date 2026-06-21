import { CredentialStatus } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "../db/prisma";
import type { AuthPayload } from "./authService";

type NfcTokenClient = Pick<PrismaClient, "studentCredential">;

type CredentialForToken = {
  id: string;
  schoolId: string;
  scanToken: string | null;
  credentialUID: string;
  status: CredentialStatus;
  student: {
    id: string;
    admissionNumber: string;
    firstName: string;
    lastName: string;
    isActive: boolean;
    enrollments?: Array<{
      class?: { name: string } | null;
      stream?: { name: string } | null;
    }>;
  };
  school: {
    id: string;
    name: string;
    code: string;
  };
};

export type NfcTokenMode =
  | "PUBLIC_ID"
  | "GATE_SECURITY"
  | "CANTEEN_CHARGE"
  | "ATTENDANCE_SCAN"
  | "ADMIN_CREDENTIAL";

const credentialInclude = {
  school: { select: { id: true, name: true, code: true } },
  student: {
    select: {
      id: true,
      admissionNumber: true,
      firstName: true,
      lastName: true,
      isActive: true,
      enrollments: {
        where: { isActive: true, status: "ACTIVE" as const },
        include: { class: { select: { name: true } }, stream: { select: { name: true } } },
        orderBy: { createdAt: "desc" as const },
        take: 1,
      },
    },
  },
};

function safeStudentSummary(credential: CredentialForToken) {
  const enrollment = credential.student.enrollments?.[0];
  return {
    id: credential.student.id,
    name: `${credential.student.firstName} ${credential.student.lastName}`.trim(),
    admissionNumber: credential.student.admissionNumber,
    className: enrollment?.class?.name ?? null,
    streamName: enrollment?.stream?.name ?? null,
    photoUrl: null,
    schoolName: credential.school.name,
  };
}

function modeForRole(role: string | undefined): NfcTokenMode {
  switch (role) {
    case "SECURITY":
    case "GATE_SECURITY":
      return "GATE_SECURITY";
    case "CANTEEN":
    case "CASHIER":
      return "CANTEEN_CHARGE";
    case "TEACHER":
      return "ATTENDANCE_SCAN";
    case "ADMIN_OPERATOR":
      return "ADMIN_CREDENTIAL";
    default:
      return "PUBLIC_ID";
  }
}

function targetPathForMode(mode: NfcTokenMode, token: string, credentialId: string): string {
  switch (mode) {
    case "GATE_SECURITY":
      return `/gate/nfc/${encodeURIComponent(token)}`;
    case "CANTEEN_CHARGE":
      return `/canteen/nfc/${encodeURIComponent(token)}`;
    case "ATTENDANCE_SCAN":
      return `/attendance/nfc/${encodeURIComponent(token)}`;
    case "ADMIN_CREDENTIAL":
      return `/student-credentials?credentialId=${encodeURIComponent(credentialId)}`;
    case "PUBLIC_ID":
      return `/nfc/t/${encodeURIComponent(token)}`;
  }
}

export async function resolveNfcCredentialToken(
  token: string,
  auth: AuthPayload | null,
  db: NfcTokenClient = defaultPrisma,
) {
  const cleanToken = token.trim();
  if (!cleanToken) throw Object.assign(new Error("NFC token is required."), { status: 400 });

  const credential = await db.studentCredential.findUnique({
    where: { scanToken: cleanToken },
    include: credentialInclude,
  });

  if (!credential) {
    return {
      found: false,
      mode: "PUBLIC_ID" as const,
      credentialStatus: "INVALID" as const,
      valid: false,
    };
  }

  const typedCredential = credential as CredentialForToken;
  if (auth && auth.schoolId !== typedCredential.schoolId) {
    throw Object.assign(new Error("You do not have access to this NFC credential."), { status: 403 });
  }

  const credentialActive = typedCredential.status === CredentialStatus.ACTIVE;
  const studentActive = typedCredential.student.isActive;
  const actionBlocked = !credentialActive || !studentActive;
  const mode = auth ? modeForRole(auth.role) : "PUBLIC_ID";

  return {
    found: true,
    mode,
    targetPath: actionBlocked ? undefined : targetPathForMode(mode, cleanToken, typedCredential.id),
    valid: credentialActive && studentActive,
    actionBlocked,
    credentialStatus: typedCredential.status,
    studentStatus: studentActive ? "ACTIVE" : "INACTIVE",
    student: safeStudentSummary(typedCredential),
    credential: {
      id: typedCredential.id,
      nfcUrl: `/nfc/t/${cleanToken}`,
    },
  };
}
