import type { PrismaClient } from "@prisma/client";
import {
  communicationAudienceTypes,
  normalizePhoneToE164,
  type AudienceDefinition,
  type AudienceEligibilityStatus,
  type AudienceRecipientPreview,
  type AudienceResolution,
  type AudienceResolutionSummary,
  type CommunicationAudienceType,
  type CommunicationChannel,
  type CommunicationContactRole,
} from "../../shared/communications";
import { getZonedDateKey, getZonedDayRangeByKey } from "./nfcPolicyService";

export type CommunicationContext = {
  schoolId: string;
  schoolName: string;
  actorId?: string;
  actorName?: string;
};

type Db = PrismaClient;

type GuardianContactRow = {
  id: string;
  guardianName: string;
  relationship: string;
  phone: string | null;
  email: string | null;
  preferredContactMethod: string;
  isPrimary: boolean;
  canReceiveReports: boolean;
};

type StudentRow = {
  studentId: string;
  studentName: string;
  admissionNumber: string;
  isActive: boolean;
  className: string | null;
  streamName: string | null;
  guardianContacts: GuardianContactRow[];
};

type StaffRow = {
  id: string;
  name: string;
  email: string | null;
  role: string;
};

type Collection = {
  audienceType: CommunicationAudienceType;
  channel: CommunicationChannel;
  matchedStudentsCount: number;
  rawContactsCount: number;
  eligibleRecipientsCount: number;
  missingContactsCount: number;
  duplicateContactsRemovedCount: number;
  excludedRecipientsCount: number;
  optedOutRecipientsCount: number;
  bouncedRecipientsCount: number;
  invalidRecipientsCount: number;
  rows: AudienceRecipientPreview[];
};

const DEFAULT_PAGE_SIZE = 20;
const DEFAULT_COUNTRY_CODE = process.env.COMMUNICATION_DEFAULT_COUNTRY_CODE?.trim() || "256";
const STAFF_ROLES = ["ADMIN_OPERATOR", "TEACHER", "CASHIER", "CANTEEN", "SECURITY", "GATE_SECURITY"] as const;

function inferAudienceType(definition: AudienceDefinition): CommunicationAudienceType {
  if (definition.audienceType && communicationAudienceTypes.includes(definition.audienceType)) return definition.audienceType;
  if (definition.staffUserIds?.length) return "STAFF_TEACHERS";
  if (definition.guardianContactIds?.length) return "CUSTOM_SELECTED_CONTACTS";
  if (definition.studentIds?.length) return "PARENTS_OF_SELECTED_STUDENTS";
  if (definition.classId) return "PARENTS_BY_CLASS";
  if (definition.streamId) return "PARENTS_BY_STREAM";
  return "ALL_PARENTS_GUARDIANS";
}

function normalizeAudienceDefinition(definition: AudienceDefinition): AudienceDefinition {
  return {
    ...definition,
    audienceType: inferAudienceType(definition),
    channel: definition.channel ?? "WHATSAPP",
    mode: definition.mode ?? "GENERAL",
    page: definition.page ?? 1,
    pageSize: definition.pageSize ?? DEFAULT_PAGE_SIZE,
  };
}

function normalizeEmail(value: string | null | undefined) {
  const next = value?.trim().toLowerCase() ?? "";
  return next || null;
}

function isValidEmail(value: string | null | undefined) {
  const normalized = normalizeEmail(value);
  return Boolean(normalized && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized));
}

function titleCase(value: string | null | undefined) {
  const text = (value ?? "").trim();
  if (!text) return "";
  return text
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function normalizeContactRole(relationship: string | null | undefined): CommunicationContactRole | null {
  const value = (relationship ?? "").trim().toLowerCase();
  if (!value) return null;
  if (value.includes("mother") || value.includes("mum") || value.includes("mom")) return "MOTHER";
  if (value.includes("father") || value.includes("dad")) return "FATHER";
  if (value.includes("emergency")) return "EMERGENCY_CONTACT";
  if (value.includes("guardian")) return "GUARDIAN";
  if (value.includes("parent")) return "PARENT";
  return null;
}

function studentName(student: { firstName: string; lastName: string }) {
  return `${student.firstName} ${student.lastName}`.trim();
}

function buildAvailability(phone: string | null, email: string | null) {
  const phoneE164 = normalizePhoneToE164(phone, DEFAULT_COUNTRY_CODE);
  const emailNormalized = normalizeEmail(email);
  return {
    whatsapp: Boolean(phoneE164),
    sms: Boolean(phoneE164),
    email: Boolean(emailNormalized && isValidEmail(emailNormalized)),
  };
}

function dedupeKey(input: { source: "guardian" | "staff"; studentId: string | null; contactId: string; phone: string | null; email: string | null }) {
  const phoneKey = normalizePhoneToE164(input.phone, DEFAULT_COUNTRY_CODE);
  const emailKey = normalizeEmail(input.email);
  if (input.source === "staff") {
    return `staff:${emailKey ?? input.contactId}`;
  }
  return `guardian:${phoneKey ?? emailKey ?? `${input.studentId ?? "student"}:${input.contactId}`}`;
}

function buildGuardianCandidate(student: StudentRow, contact: GuardianContactRow, channel: CommunicationChannel): AudienceRecipientPreview {
  const phone = normalizePhoneToE164(contact.phone, DEFAULT_COUNTRY_CODE) ?? contact.phone?.trim() ?? null;
  const email = normalizeEmail(contact.email);
  return {
    id: `guardian:${contact.id}`,
    source: "guardian",
    studentId: student.studentId,
    studentName: student.studentName,
    className: student.className,
    streamName: student.streamName,
    contactName: contact.guardianName,
    relationship: contact.relationship,
    phone,
    email,
    channelAvailability: buildAvailability(contact.phone, contact.email),
    selectedChannel: channel,
    eligibilityStatus: "ELIGIBLE",
    exclusionReason: null,
    dedupeKey: dedupeKey({ source: "guardian", studentId: student.studentId, contactId: contact.id, phone, email }),
    contactRole: normalizeContactRole(contact.relationship),
  };
}

function buildStaffCandidate(staff: StaffRow, channel: CommunicationChannel): AudienceRecipientPreview {
  const email = normalizeEmail(staff.email);
  return {
    id: `staff:${staff.id}`,
    source: "staff",
    studentId: null,
    studentName: "",
    className: null,
    streamName: null,
    contactName: staff.name,
    relationship: titleCase(staff.role),
    phone: null,
    email,
    channelAvailability: buildAvailability(null, email),
    selectedChannel: channel,
    eligibilityStatus: "ELIGIBLE",
    exclusionReason: null,
    dedupeKey: dedupeKey({ source: "staff", studentId: null, contactId: staff.id, phone: null, email }),
    contactRole: null,
  };
}

function markExcluded(candidate: AudienceRecipientPreview, status: AudienceEligibilityStatus, reason: string): AudienceRecipientPreview {
  return { ...candidate, eligibilityStatus: status, exclusionReason: reason };
}

function evaluateCandidate(candidate: AudienceRecipientPreview, input: { channel: CommunicationChannel; studentInactive: boolean; contactAllowed: boolean }): AudienceRecipientPreview {
  if (input.studentInactive) {
    return markExcluded(candidate, "INACTIVE_STUDENT", "Student is inactive.");
  }
  if (!input.contactAllowed) {
    return markExcluded(candidate, "OPTED_OUT", "Contact is not opted in for school communications.");
  }

  if (input.channel === "EMAIL") {
    if (!candidate.channelAvailability.email) {
      return markExcluded(candidate, candidate.email ? "INVALID_EMAIL" : "MISSING_EMAIL", candidate.email ? "Invalid email address." : "Missing email address.");
    }
    return { ...candidate, selectedChannel: input.channel };
  }

  if (input.channel === "SMS" || input.channel === "WHATSAPP") {
    if (!candidate.channelAvailability.sms) {
      const rawPhone = candidate.phone ?? "";
      const normalized = normalizePhoneToE164(rawPhone, DEFAULT_COUNTRY_CODE);
      const status: AudienceEligibilityStatus = rawPhone ? (normalized ? "MISSING_PHONE" : "INVALID_PHONE") : "MISSING_PHONE";
      const reason = rawPhone ? (normalized ? "Phone number cannot be used for this channel." : "Invalid phone number.") : "Missing phone number.";
      return markExcluded(candidate, status, reason);
    }
  }

  return { ...candidate, selectedChannel: input.channel };
}

function searchRows(rows: AudienceRecipientPreview[], search?: string) {
  const needle = search?.trim().toLowerCase();
  if (!needle) return rows;
  return rows.filter((row) => [
    row.studentName,
    row.className,
    row.streamName,
    row.contactName,
    row.relationship,
    row.phone,
    row.email,
    row.eligibilityStatus,
    row.exclusionReason,
  ].filter(Boolean).join(" ").toLowerCase().includes(needle));
}

function pageRows(rows: AudienceRecipientPreview[], page: number, pageSize: number) {
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const start = (currentPage - 1) * pageSize;
  return {
    page: currentPage,
    totalPages,
    recipients: rows.slice(start, start + pageSize),
  };
}

async function loadSchool(db: Db, schoolId: string) {
  const school = await db.school.findUnique({
    where: { id: schoolId },
    select: { id: true, timezone: true },
  });
  if (!school) throw Object.assign(new Error("School not found."), { status: 404, expose: true });
  return school;
}

async function loadStudentRows(db: Db, schoolId: string, where: Record<string, unknown>): Promise<StudentRow[]> {
  const rows = await db.student.findMany({
    where: {
      schoolId,
      ...where,
    },
    include: {
      guardianContacts: {
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
      },
      enrollments: {
        where: { schoolId, isActive: true, status: "ACTIVE" },
        include: { class: true, stream: true },
        orderBy: [{ createdAt: "desc" }],
        take: 1,
      },
    },
  });
  return rows.map((student) => ({
    studentId: student.id,
    studentName: studentName(student),
    admissionNumber: student.admissionNumber,
    isActive: student.isActive,
    className: student.enrollments[0]?.class?.name ?? null,
    streamName: student.enrollments[0]?.stream?.name ?? null,
    guardianContacts: student.guardianContacts.map((contact) => ({
      id: contact.id,
      guardianName: contact.guardianName,
      relationship: contact.relationship,
      phone: contact.phone,
      email: contact.email,
      preferredContactMethod: contact.preferredContactMethod,
      isPrimary: contact.isPrimary,
      canReceiveReports: contact.canReceiveReports,
    })),
  }));
}

async function loadStudentRowsByAudience(db: Db, schoolId: string, definition: AudienceDefinition, audienceType: CommunicationAudienceType): Promise<StudentRow[]> {
  switch (audienceType) {
    case "ALL_PARENTS_GUARDIANS":
      return loadStudentRows(db, schoolId, {
        enrollments: { some: { schoolId, isActive: true, status: "ACTIVE" } },
      });
    case "PARENTS_BY_CLASS":
      if (!definition.classId) return [];
      return loadStudentRows(db, schoolId, {
        enrollments: { some: { schoolId, isActive: true, status: "ACTIVE", classId: definition.classId, ...(definition.streamId ? { streamId: definition.streamId } : {}) } },
      });
    case "PARENTS_BY_STREAM":
      if (!definition.streamId) return [];
      return loadStudentRows(db, schoolId, {
        enrollments: { some: { schoolId, isActive: true, status: "ACTIVE", streamId: definition.streamId } },
      });
    case "PARENTS_OF_SELECTED_STUDENTS":
      if (!definition.studentIds?.length) return [];
      return loadStudentRows(db, schoolId, {
        id: { in: definition.studentIds },
      });
    default:
      return [];
  }
}

async function loadFeeHoldRows(db: Db, schoolId: string): Promise<StudentRow[]> {
  const rows = await db.studentFeeHold.findMany({
    where: { schoolId, status: "ACTIVE", balanceDueCents: { gt: 0 } },
    include: {
      student: {
        include: {
          guardianContacts: {
            orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
          },
          enrollments: {
            where: { schoolId, isActive: true, status: "ACTIVE" },
            include: { class: true, stream: true },
            orderBy: [{ createdAt: "desc" }],
            take: 1,
          },
        },
      },
    },
  });
  return rows.map((hold) => ({
    studentId: hold.student.id,
    studentName: studentName(hold.student),
    admissionNumber: hold.student.admissionNumber,
    isActive: hold.student.isActive,
    className: hold.student.enrollments[0]?.class?.name ?? null,
    streamName: hold.student.enrollments[0]?.stream?.name ?? null,
    guardianContacts: hold.student.guardianContacts.map((contact) => ({
      id: contact.id,
      guardianName: contact.guardianName,
      relationship: contact.relationship,
      phone: contact.phone,
      email: contact.email,
      preferredContactMethod: contact.preferredContactMethod,
      isPrimary: contact.isPrimary,
      canReceiveReports: contact.canReceiveReports,
    })),
  }));
}

async function loadAbsentRows(db: Db, schoolId: string, timezone: string): Promise<StudentRow[]> {
  const dateKey = getZonedDateKey(new Date(), timezone);
  const { start, end } = getZonedDayRangeByKey(dateKey, timezone);
  const rows = await db.dailyAttendance.findMany({
    where: {
      schoolId,
      attendanceDate: { gte: start, lt: end },
      status: "ABSENT",
    },
    include: {
      student: {
        include: {
          guardianContacts: {
            orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
          },
          enrollments: {
            where: { schoolId, isActive: true, status: "ACTIVE" },
            include: { class: true, stream: true },
            orderBy: [{ createdAt: "desc" }],
            take: 1,
          },
        },
      },
    },
  });
  return rows.map((row) => ({
    studentId: row.student.id,
    studentName: studentName(row.student),
    admissionNumber: row.student.admissionNumber,
    isActive: row.student.isActive,
    className: row.student.enrollments[0]?.class?.name ?? null,
    streamName: row.student.enrollments[0]?.stream?.name ?? null,
    guardianContacts: row.student.guardianContacts.map((contact) => ({
      id: contact.id,
      guardianName: contact.guardianName,
      relationship: contact.relationship,
      phone: contact.phone,
      email: contact.email,
      preferredContactMethod: contact.preferredContactMethod,
      isPrimary: contact.isPrimary,
      canReceiveReports: contact.canReceiveReports,
    })),
  }));
}

async function loadSelectedGuardianRows(db: Db, schoolId: string, guardianContactIds: string[]): Promise<StudentRow[]> {
  if (guardianContactIds.length === 0) return [];
  const rows = await db.guardianContact.findMany({
    where: { schoolId, id: { in: guardianContactIds } },
    include: {
      student: {
        include: {
          guardianContacts: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] },
          enrollments: {
            where: { schoolId, isActive: true, status: "ACTIVE" },
            include: { class: true, stream: true },
            orderBy: [{ createdAt: "desc" }],
            take: 1,
          },
        },
      },
    },
  });
  return rows.map((contact) => ({
    studentId: contact.student.id,
    studentName: studentName(contact.student),
    admissionNumber: contact.student.admissionNumber,
    isActive: contact.student.isActive,
    className: contact.student.enrollments[0]?.class?.name ?? null,
    streamName: contact.student.enrollments[0]?.stream?.name ?? null,
    guardianContacts: [{
      id: contact.id,
      guardianName: contact.guardianName,
      relationship: contact.relationship,
      phone: contact.phone,
      email: contact.email,
      preferredContactMethod: contact.preferredContactMethod,
      isPrimary: contact.isPrimary,
      canReceiveReports: contact.canReceiveReports,
    }],
  }));
}

async function loadStaffRows(db: Db, schoolId: string, staffUserIds?: string[]): Promise<StaffRow[]> {
  const rows = await db.user.findMany({
    where: {
      schoolId,
      isActive: true,
      role: { in: [...STAFF_ROLES] as any },
      ...(staffUserIds?.length ? { id: { in: staffUserIds } } : {}),
    },
    orderBy: { name: "asc" },
  });
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
  }));
}

async function collectRows(db: Db, ctx: CommunicationContext, definition: AudienceDefinition) {
  const normalized = normalizeAudienceDefinition(definition);
  const audienceType = normalized.audienceType ?? "ALL_PARENTS_GUARDIANS";
  const channel = normalized.channel ?? "WHATSAPP";
  const school = await loadSchool(db, ctx.schoolId);

  let studentRows: StudentRow[] = [];
  let staffRows: StaffRow[] = [];
  if (audienceType === "STAFF_TEACHERS") {
    staffRows = await loadStaffRows(db, ctx.schoolId, normalized.staffUserIds);
  } else if (audienceType === "CUSTOM_SELECTED_CONTACTS") {
    studentRows = await loadSelectedGuardianRows(db, ctx.schoolId, normalized.guardianContactIds ?? []);
    staffRows = normalized.staffUserIds?.length ? await loadStaffRows(db, ctx.schoolId, normalized.staffUserIds) : [];
  } else if (audienceType === "PARENTS_WITH_UNPAID_BALANCES") {
    studentRows = await loadFeeHoldRows(db, ctx.schoolId);
  } else if (audienceType === "PARENTS_OF_ABSENT_STUDENTS") {
    studentRows = await loadAbsentRows(db, ctx.schoolId, school.timezone);
  } else {
    studentRows = await loadStudentRowsByAudience(db, ctx.schoolId, normalized, audienceType);
  }

  const guardianIds = studentRows.flatMap((row) => row.guardianContacts.map((contact) => contact.id));
  const consentRows = guardianIds.length
    ? await db.communicationConsent.findMany({
        where: { schoolId: ctx.schoolId, guardianId: { in: guardianIds }, channel },
        select: { guardianId: true, status: true },
      })
    : [];
  const consentMap = new Map(consentRows.map((row) => [row.guardianId, row.status]));

  const rows: AudienceRecipientPreview[] = [];
  for (const student of studentRows) {
    for (const contact of student.guardianContacts) {
      const role = normalizeContactRole(contact.relationship);
      if (normalized.contactRoles?.length && (!role || !normalized.contactRoles.includes(role))) {
        continue;
      }

      const candidate = buildGuardianCandidate(student, contact, channel);
      const consentStatus = consentMap.get(contact.id);
      const evaluated = evaluateCandidate(candidate, {
        channel,
        studentInactive: !normalized.includeInactive && !student.isActive,
        contactAllowed: contact.canReceiveReports && consentStatus !== "OPTED_OUT",
      });
      const finalCandidate = consentStatus === "OPTED_OUT"
        ? markExcluded(evaluated, "OPTED_OUT", "Contact opted out of this communication channel.")
        : evaluated;
      rows.push(finalCandidate);
    }
  }

  for (const staff of staffRows) {
    const candidate = buildStaffCandidate(staff, channel);
    const evaluated = evaluateCandidate(candidate, {
      channel,
      studentInactive: false,
      contactAllowed: true,
    });
    rows.push(
      channel === "EMAIL" && !evaluated.channelAvailability.email
        ? markExcluded(evaluated, "MISSING_EMAIL", "Staff contact is missing a valid email address.")
        : evaluated,
    );
  }

  const rawContactsCount = rows.length;
  const matchedStudentsCount = new Set(studentRows.map((row) => row.studentId)).size;
  const finalRows: AudienceRecipientPreview[] = [];
  const seen = new Set<string>();
  let duplicateContactsRemovedCount = 0;
  for (const row of rows) {
    if (row.eligibilityStatus !== "ELIGIBLE" || normalized.mode === "PER_STUDENT") {
      finalRows.push(row);
      continue;
    }
    if (seen.has(row.dedupeKey)) {
      duplicateContactsRemovedCount += 1;
      finalRows.push(markExcluded(row, "DUPLICATE_CONTACT", "Duplicate contact removed across sibling records."));
      continue;
    }
    seen.add(row.dedupeKey);
    finalRows.push(row);
  }

  const eligibleRecipientsCount = finalRows.filter((row) => row.eligibilityStatus === "ELIGIBLE").length;
  const missingContactsCount = finalRows.filter((row) => row.eligibilityStatus === "MISSING_PHONE" || row.eligibilityStatus === "MISSING_EMAIL" || row.eligibilityStatus === "NO_CONTACT").length;
  const optedOutRecipientsCount = finalRows.filter((row) => row.eligibilityStatus === "OPTED_OUT").length;
  const bouncedRecipientsCount = finalRows.filter((row) => row.eligibilityStatus === "BOUNCED").length;
  const invalidRecipientsCount = finalRows.filter((row) => row.eligibilityStatus === "INVALID_PHONE" || row.eligibilityStatus === "INVALID_EMAIL").length;

  return {
    audienceType,
    channel,
    matchedStudentsCount,
    rawContactsCount,
    eligibleRecipientsCount,
    missingContactsCount,
    duplicateContactsRemovedCount,
    excludedRecipientsCount: finalRows.length - eligibleRecipientsCount,
    optedOutRecipientsCount,
    bouncedRecipientsCount,
    invalidRecipientsCount,
    rows: finalRows,
  } satisfies Collection;
}

export async function collectCommunicationAudienceRows(db: Db, ctx: CommunicationContext, definition: AudienceDefinition) {
  return collectRows(db, ctx, definition);
}

export async function resolveCommunicationAudience(db: Db, ctx: CommunicationContext, definition: AudienceDefinition): Promise<AudienceResolution> {
  const collection = await collectRows(db, ctx, definition);
  const pageSize = Math.min(100, Math.max(1, Number(definition.pageSize ?? DEFAULT_PAGE_SIZE)));
  const page = Math.max(1, Number(definition.page ?? 1));
  const filteredRows = searchRows(collection.rows, definition.search);
  const paged = pageRows(filteredRows, page, pageSize);
  const summary: AudienceResolutionSummary = {
    audienceType: collection.audienceType,
    matchedStudentsCount: collection.matchedStudentsCount,
    rawContactsCount: collection.rawContactsCount,
    eligibleRecipientsCount: collection.eligibleRecipientsCount,
    missingContactsCount: collection.missingContactsCount,
    duplicateContactsRemovedCount: collection.duplicateContactsRemovedCount,
    excludedRecipientsCount: collection.excludedRecipientsCount,
    optedOutRecipientsCount: collection.optedOutRecipientsCount,
    bouncedRecipientsCount: collection.bouncedRecipientsCount,
    invalidRecipientsCount: collection.invalidRecipientsCount,
    channel: collection.channel,
    page: paged.page,
    pageSize,
    totalPages: paged.totalPages,
    totalRecipients: filteredRows.length,
  };
  return { ...summary, recipients: paged.recipients };
}
