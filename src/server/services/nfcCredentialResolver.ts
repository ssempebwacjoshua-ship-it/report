import { CredentialStatus, CredentialType } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import {
  maskCredentialValue,
  normalizeCredentialForLookup,
  type CredentialNormalizationInput,
} from "../../shared/utils/credentialNormalization";

type StudentIdentity = {
  id: string;
  schoolId?: string | null;
  firstName: string;
  lastName: string;
  admissionNumber?: string | null;
  isActive: boolean;
  studentType?: "DAY" | "BOARDING" | null;
  attendanceProfile?: string | null;
  enrollments?: Array<{ classId?: string | null; streamId?: string | null }>;
};

type CredentialIdentity = {
  id: string;
  schoolId: string;
  studentId: string;
  credentialUID: string;
  scanToken: string | null;
  status: CredentialStatus;
  student: StudentIdentity;
};

type TagIdentity = {
  id: string;
  schoolId: string;
  studentId: string | null;
  publicCode: string;
  physicalUid: string | null;
  status: string;
  student: StudentIdentity | null;
};

type CredentialResolverDb = Pick<PrismaClient, "studentCredential" | "nfcTag">;

export type CredentialResolutionFailureReason =
  | "NO_MATCHING_CANDIDATE_FOUND"
  | "SCHOOL_MISMATCH"
  | "TAG_ORPHANED_NOT_LINKED_TO_STUDENT"
  | "CREDENTIAL_DISABLED"
  | "STUDENT_INACTIVE"
  | "UNSUPPORTED_WIEGAND_BIT_COUNT";

export type CredentialResolutionMatchSource =
  | "studentCredential.scanToken"
  | "studentCredential.credentialUID"
  | "nfcTag.publicCode"
  | "nfcTag.physicalUid";

export type CredentialResolutionInput = CredentialNormalizationInput & {
  schoolId: string;
  readerId?: string | null;
  deviceId?: string | null;
};

export type CredentialResolutionResult =
  | {
      ok: true;
      source: CredentialResolutionMatchSource;
      candidate: string;
      credential: CredentialIdentity | null;
      tag: TagIdentity | null;
      student: StudentIdentity;
    }
  | {
      ok: false;
      reason: CredentialResolutionFailureReason;
      candidate: string | null;
      credential: CredentialIdentity | null;
      tag: TagIdentity | null;
      student: StudentIdentity | null;
    };

const studentSelect = {
  id: true,
  schoolId: true,
  firstName: true,
  lastName: true,
  admissionNumber: true,
  isActive: true,
  studentType: true,
  attendanceProfile: true,
  enrollments: {
    where: { isActive: true, status: "ACTIVE" as const },
    orderBy: { createdAt: "desc" as const },
    take: 1,
    select: { classId: true, streamId: true },
  },
};

const credentialInclude = {
  student: { select: studentSelect },
};

const tagInclude = {
  student: { select: studentSelect },
};

function logResolution(
  input: CredentialResolutionInput,
  normalized: ReturnType<typeof normalizeCredentialForLookup>,
  result: CredentialResolutionResult,
) {
  const payload = {
    schoolId: input.schoolId,
    readerId: input.readerId ?? null,
    deviceId: input.deviceId ?? null,
    bitCount: input.rawWiegandBitCount ?? null,
    rawBinary: input.rawWiegandBinary ?? null,
    rawHexMasked: maskCredentialValue(input.rawWiegandHex),
    rawHexLength: input.rawWiegandHex?.replace(/^0x/i, "").length ?? 0,
    rawDecimalMasked: maskCredentialValue(input.rawWiegandDecimal),
    rawDecimalLength: input.rawWiegandDecimal?.length ?? 0,
    facilityCodeMasked: maskCredentialValue(input.facilityCode),
    cardNumberMasked: maskCredentialValue(input.cardNumber),
    candidateCount: normalized.lookupValues.length + normalized.tokenValues.length,
    lookupFieldsAttempted: [
      normalized.tokenValues.length ? "studentCredential.scanToken" : null,
      normalized.lookupValues.length ? "studentCredential.credentialUID" : null,
      normalized.tokenValues.length ? "nfcTag.publicCode" : null,
      normalized.lookupValues.length ? "nfcTag.physicalUid" : null,
    ].filter(Boolean),
    endpointResult: result.ok ? "MATCH" : "NO_MATCH",
    matchSource: result.ok ? result.source : null,
    failureReason: result.ok ? null : result.reason,
  };
  console.info("[nfc-credential-resolver]", payload);
}

function hasUnsupportedWiegandBitCount(input: CredentialResolutionInput) {
  if (!input.rawWiegandBitCount) return false;
  return input.rawWiegandBitCount !== 26 && input.rawWiegandBitCount !== 34;
}

async function findCredentialInSchool(
  db: CredentialResolverDb,
  schoolId: string,
  normalized: ReturnType<typeof normalizeCredentialForLookup>,
) {
  if (!normalized.tokenValues.length && !normalized.lookupValues.length) return null;
  return db.studentCredential.findFirst({
    where: {
      schoolId,
      type: CredentialType.NFC_WRISTBAND,
      OR: [
        ...normalized.tokenValues.map((value) => ({ scanToken: value })),
        ...normalized.lookupValues.map((value) => ({ credentialUID: value })),
      ],
    },
    include: credentialInclude,
  }) as Promise<CredentialIdentity | null>;
}

async function findTagInSchool(
  db: CredentialResolverDb,
  schoolId: string,
  normalized: ReturnType<typeof normalizeCredentialForLookup>,
) {
  if (!normalized.tokenValues.length && !normalized.lookupValues.length) return null;
  return db.nfcTag.findFirst({
    where: {
      schoolId,
      OR: [
        ...normalized.tokenValues.map((value) => ({ publicCode: value })),
        ...normalized.lookupValues.map((value) => ({ physicalUid: { equals: value, mode: "insensitive" as const } })),
      ],
    },
    include: tagInclude,
  }) as Promise<TagIdentity | null>;
}

async function findCredentialAnySchool(
  db: CredentialResolverDb,
  normalized: ReturnType<typeof normalizeCredentialForLookup>,
) {
  if (!normalized.tokenValues.length && !normalized.lookupValues.length) return null;
  return db.studentCredential.findFirst({
    where: {
      type: CredentialType.NFC_WRISTBAND,
      OR: [
        ...normalized.tokenValues.map((value) => ({ scanToken: value })),
        ...normalized.lookupValues.map((value) => ({ credentialUID: value })),
      ],
    },
    include: credentialInclude,
  }) as Promise<CredentialIdentity | null>;
}

async function findTagAnySchool(
  db: CredentialResolverDb,
  normalized: ReturnType<typeof normalizeCredentialForLookup>,
) {
  if (!normalized.tokenValues.length && !normalized.lookupValues.length) return null;
  return db.nfcTag.findFirst({
    where: {
      OR: [
        ...normalized.tokenValues.map((value) => ({ publicCode: value })),
        ...normalized.lookupValues.map((value) => ({ physicalUid: { equals: value, mode: "insensitive" as const } })),
      ],
    },
    include: tagInclude,
  }) as Promise<TagIdentity | null>;
}

function resolveCandidate(
  normalized: ReturnType<typeof normalizeCredentialForLookup>,
  value: string | null | undefined,
) {
  if (!value) return normalized.canonical || null;
  const upper = value.toUpperCase();
  return normalized.tokenValues.find((candidate) => candidate === value || candidate.toUpperCase() === upper)
    ?? normalized.lookupValues.find((candidate) => candidate === value || candidate.toUpperCase() === upper)
    ?? value;
}

export async function resolveNfcCredential(
  db: CredentialResolverDb,
  input: CredentialResolutionInput,
): Promise<CredentialResolutionResult> {
  const normalized = normalizeCredentialForLookup(input);
  let result: CredentialResolutionResult;

  if (hasUnsupportedWiegandBitCount(input)) {
    result = {
      ok: false,
      reason: "UNSUPPORTED_WIEGAND_BIT_COUNT",
      candidate: null,
      credential: null,
      tag: null,
      student: null,
    };
    logResolution(input, normalized, result);
    return result;
  }

  const credential = await findCredentialInSchool(db, input.schoolId, normalized);
  if (credential) {
    if (credential.status !== CredentialStatus.ACTIVE) {
      result = {
        ok: false,
        reason: "CREDENTIAL_DISABLED",
        candidate: resolveCandidate(normalized, credential.credentialUID),
        credential,
        tag: null,
        student: credential.student,
      };
      logResolution(input, normalized, result);
      return result;
    }
    if (!credential.student.isActive) {
      result = {
        ok: false,
        reason: "STUDENT_INACTIVE",
        candidate: resolveCandidate(normalized, credential.credentialUID),
        credential,
        tag: null,
        student: credential.student,
      };
      logResolution(input, normalized, result);
      return result;
    }
    result = {
      ok: true,
      source: normalized.tokenValues.includes(credential.scanToken ?? "") ? "studentCredential.scanToken" : "studentCredential.credentialUID",
      candidate: resolveCandidate(normalized, credential.scanToken ?? credential.credentialUID) ?? credential.credentialUID,
      credential,
      tag: null,
      student: credential.student,
    };
    logResolution(input, normalized, result);
    return result;
  }

  const tag = await findTagInSchool(db, input.schoolId, normalized);
  if (tag) {
    if (!tag.studentId || !tag.student) {
      result = {
        ok: false,
        reason: "TAG_ORPHANED_NOT_LINKED_TO_STUDENT",
        candidate: resolveCandidate(normalized, tag.publicCode || tag.physicalUid),
        credential: null,
        tag,
        student: null,
      };
      logResolution(input, normalized, result);
      return result;
    }
    if (tag.status === "DISABLED" || tag.status === "LOST") {
      result = {
        ok: false,
        reason: "CREDENTIAL_DISABLED",
        candidate: resolveCandidate(normalized, tag.physicalUid ?? tag.publicCode),
        credential: null,
        tag,
        student: tag.student,
      };
      logResolution(input, normalized, result);
      return result;
    }
    if (!tag.student.isActive) {
      result = {
        ok: false,
        reason: "STUDENT_INACTIVE",
        candidate: resolveCandidate(normalized, tag.physicalUid ?? tag.publicCode),
        credential: null,
        tag,
        student: tag.student,
      };
      logResolution(input, normalized, result);
      return result;
    }
    result = {
      ok: true,
      source: normalized.tokenValues.includes(tag.publicCode) ? "nfcTag.publicCode" : "nfcTag.physicalUid",
      candidate: resolveCandidate(normalized, tag.physicalUid ?? tag.publicCode) ?? tag.publicCode,
      credential: null,
      tag,
      student: tag.student,
    };
    logResolution(input, normalized, result);
    return result;
  }

  const wrongSchoolCredential = await findCredentialAnySchool(db, normalized);
  if (wrongSchoolCredential && wrongSchoolCredential.schoolId !== input.schoolId) {
    result = {
      ok: false,
      reason: "SCHOOL_MISMATCH",
      candidate: resolveCandidate(normalized, wrongSchoolCredential.scanToken ?? wrongSchoolCredential.credentialUID),
      credential: wrongSchoolCredential,
      tag: null,
      student: null,
    };
    logResolution(input, normalized, result);
    return result;
  }

  const wrongSchoolTag = await findTagAnySchool(db, normalized);
  if (wrongSchoolTag && wrongSchoolTag.schoolId !== input.schoolId) {
    result = {
      ok: false,
      reason: "SCHOOL_MISMATCH",
      candidate: resolveCandidate(normalized, wrongSchoolTag.physicalUid ?? wrongSchoolTag.publicCode),
      credential: null,
      tag: wrongSchoolTag,
      student: null,
    };
    logResolution(input, normalized, result);
    return result;
  }

  result = {
    ok: false,
    reason: "NO_MATCHING_CANDIDATE_FOUND",
    candidate: normalized.canonical || null,
    credential: null,
    tag: null,
    student: null,
  };
  logResolution(input, normalized, result);
  return result;
}

export function mapCredentialFailureReason(reason: CredentialResolutionFailureReason): string {
  switch (reason) {
    case "SCHOOL_MISMATCH":
      return "wrong school tag";
    case "TAG_ORPHANED_NOT_LINKED_TO_STUDENT":
      return "tag not assigned";
    case "CREDENTIAL_DISABLED":
      return "lost or deactivated wristband";
    case "STUDENT_INACTIVE":
      return "inactive student";
    case "UNSUPPORTED_WIEGAND_BIT_COUNT":
      return "unsupported Wiegand format";
    case "NO_MATCHING_CANDIDATE_FOUND":
    default:
      return "unknown token";
  }
}
