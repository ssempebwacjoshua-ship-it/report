import { AttendanceDirection, AttendanceScanSource, CredentialStatus, CredentialType } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "../db/prisma";
import { normalizeCredentialUID, type StudentCredentialContext } from "./studentCredentialService";

export type AttendanceScanStatus =
  | "RECORDED"
  | "DUPLICATE_TAP_IN"
  | "NOT_FOUND"
  | "DEACTIVATED"
  | "STUDENT_INACTIVE";

type AttendanceClient = Pick<PrismaClient, "studentCredential" | "studentAttendanceEvent">;

type EnrollmentSummary = {
  classId: string;
  streamId: string;
  class?: { name: string } | null;
  stream?: { name: string } | null;
};

type CredentialForAttendance = {
  id: string;
  credentialUID: string;
  status: CredentialStatus;
  studentId: string;
  student: {
    id: string;
    admissionNumber: string;
    firstName: string;
    lastName: string;
    isActive: boolean;
    enrollments?: EnrollmentSummary[];
  };
};

const DUPLICATE_TAP_IN_WINDOW_MS = 2 * 60 * 1000;

const credentialInclude = {
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

function requireSchoolId(ctx: StudentCredentialContext): string {
  if (!ctx.schoolId) throw Object.assign(new Error("School context required."), { status: 401 });
  return ctx.schoolId;
}

function studentName(student: CredentialForAttendance["student"]) {
  return `${student.firstName} ${student.lastName}`.trim();
}

function safeStudentSummary(student: CredentialForAttendance["student"]) {
  const enrollment = student.enrollments?.[0];
  return {
    id: student.id,
    name: studentName(student),
    admissionNumber: student.admissionNumber,
    className: enrollment?.class?.name ?? null,
    streamName: enrollment?.stream?.name ?? null,
    photoUrl: null,
  };
}

function credentialSummary(credential: CredentialForAttendance) {
  return {
    id: credential.id,
    credentialUID: credential.credentialUID,
  };
}

export async function scanStudentAttendance(
  ctx: StudentCredentialContext,
  input: {
    credentialUID: string;
    direction?: AttendanceDirection;
    scannedAt?: Date;
    type?: CredentialType;
  },
  db: AttendanceClient = defaultPrisma,
) {
  const schoolId = requireSchoolId(ctx);
  const credentialUID = normalizeCredentialUID(input.credentialUID);
  if (!credentialUID) throw Object.assign(new Error("Credential UID is required."), { status: 400 });

  const direction = input.direction ?? AttendanceDirection.TAP_IN;
  const scannedAt = input.scannedAt ?? new Date();
  const credential = await db.studentCredential.findUnique({
    where: {
      schoolId_type_credentialUID: {
        schoolId,
        type: input.type ?? CredentialType.NFC_WRISTBAND,
        credentialUID,
      },
    },
    include: credentialInclude,
  });

  if (!credential) return { status: "NOT_FOUND" as const };
  const typedCredential = credential as CredentialForAttendance;

  if (typedCredential.status === CredentialStatus.DEACTIVATED) {
    return {
      status: "DEACTIVATED" as const,
      credential: credentialSummary(typedCredential),
    };
  }

  if (!typedCredential.student.isActive) {
    return {
      status: "STUDENT_INACTIVE" as const,
      student: safeStudentSummary(typedCredential.student),
      credential: credentialSummary(typedCredential),
    };
  }

  if (direction === AttendanceDirection.TAP_IN) {
    const duplicateSince = new Date(scannedAt.getTime() - DUPLICATE_TAP_IN_WINDOW_MS);
    const duplicate = await db.studentAttendanceEvent.findFirst({
      where: {
        schoolId,
        credentialId: typedCredential.id,
        direction: AttendanceDirection.TAP_IN,
        scannedAt: { gte: duplicateSince },
      },
      orderBy: { scannedAt: "desc" },
    });

    if (duplicate) {
      return {
        status: "DUPLICATE_TAP_IN" as const,
        student: safeStudentSummary(typedCredential.student),
        credential: credentialSummary(typedCredential),
        event: {
          id: duplicate.id,
          direction: duplicate.direction,
          scannedAt: duplicate.scannedAt.toISOString(),
          duplicateOf: duplicate.id,
        },
      };
    }
  }

  const enrollment = typedCredential.student.enrollments?.[0];
  const event = await db.studentAttendanceEvent.create({
    data: {
      schoolId,
      studentId: typedCredential.studentId,
      credentialId: typedCredential.id,
      classId: enrollment?.classId ?? null,
      streamId: enrollment?.streamId ?? null,
      direction,
      scanSource: AttendanceScanSource.NFC_WRISTBAND,
      scannedAt,
    },
  });

  return {
    status: "RECORDED" as const,
    student: safeStudentSummary(typedCredential.student),
    credential: credentialSummary(typedCredential),
    event: {
      id: event.id,
      direction: event.direction,
      scannedAt: event.scannedAt.toISOString(),
      scanSource: event.scanSource,
    },
  };
}
