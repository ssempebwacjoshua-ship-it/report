import type { GuardianContactInput } from "../../shared/types/students";
import type { PrismaClient } from "@prisma/client";
import type { ContactReadiness, StudentListItem } from "../../shared/types/students";
import type { StudentCreateInput } from "../../shared/types/students";

export async function countActiveStudentsForClass(prisma: PrismaClient, classId: string, termId: string): Promise<number> {
  return prisma.classEnrollment.count({ where: { classId, termId, isActive: true, status: "ACTIVE", student: { isActive: true } } });
}

function getContactReadiness(contacts: Array<{ canReceiveReports: boolean; phone: string | null; email: string | null }>): ContactReadiness {
  const recipients = contacts.filter((contact) => contact.canReceiveReports);
  if (recipients.length === 0) return "NO_RECIPIENT";
  return recipients.some((contact) => !contact.phone || !contact.email) ? "MISSING_PHONE_EMAIL" : "READY";
}

function formatContactSummary(contacts: Array<{ guardianName: string; relationship: string; phone: string | null; email: string | null; isPrimary: boolean }>): string {
  const primary = contacts.find((contact) => contact.isPrimary) ?? contacts[0];
  if (!primary) return "No guardian contacts";
  const channel = primary.phone ? primary.phone : primary.email ? primary.email : "missing phone/email";
  return `${primary.guardianName} (${primary.relationship}) - ${channel}`;
}

function toStudentListItem(enrollment: Awaited<ReturnType<typeof loadStudentEnrollmentRows>>[number]): StudentListItem {
  const contacts = enrollment.student.guardianContacts;
  // Cast relations to nullable: Prisma types assume FK integrity, but live DBs can
  // have orphaned references (deleted class/stream records, data migrations, etc.)
  const classRecord = enrollment.class as (typeof enrollment.class) | null;
  const streamRecord = enrollment.stream as (typeof enrollment.stream) | null;

  return {
    id: enrollment.student.id,
    admissionNumber: enrollment.student.admissionNumber,
    studentName: `${enrollment.student.firstName} ${enrollment.student.lastName}`,
    isActive: enrollment.student.isActive,
    enrollmentStatus: enrollment.status,
    className: classRecord?.name ?? "Unknown class",
    classId: enrollment.classId,
    streamName: streamRecord?.name ?? "Unknown stream",
    streamId: enrollment.streamId,
    academicYearId: enrollment.academicYearId,
    termId: enrollment.termId,
    contactReadiness: getContactReadiness(contacts),
    contactSummary: formatContactSummary(contacts),
    guardianContacts: contacts.map((contact) => ({
      id: contact.id,
      guardianName: contact.guardianName,
      relationship: contact.relationship,
      phone: contact.phone,
      email: contact.email,
      preferredContactMethod: contact.preferredContactMethod,
      isPrimary: contact.isPrimary,
      canReceiveReports: contact.canReceiveReports,
      notes: contact.notes,
    })),
  };
}

async function loadStudentEnrollmentRows(
  prisma: PrismaClient,
  schoolCode: string,
  filters?: { classId?: string; streamId?: string; search?: string; studentId?: string; isActive?: string },
) {
  const school = await prisma.school.findUnique({
    where: { code: schoolCode },
    include: {
      academicYears: { where: { isActive: true }, include: { terms: { where: { isActive: true } } } },
    },
  });
  const academicYear = school?.academicYears[0];
  const term = academicYear?.terms[0];
  if (!school || !academicYear || !term) return [];

  const search = filters?.search?.trim();
  return prisma.classEnrollment.findMany({
    where: {
      schoolId: school.id,
      academicYearId: academicYear.id,
      termId: term.id,
      classId: filters?.classId || undefined,
      streamId: filters?.streamId || undefined,
      studentId: filters?.studentId || undefined,
      ...(filters?.isActive ? { student: { isActive: filters.isActive === "true" } } : { isActive: true, status: "ACTIVE" }),
      ...(search
        ? {
            student: {
              OR: [
                { firstName: { contains: search, mode: "insensitive" } },
                { lastName: { contains: search, mode: "insensitive" } },
                { admissionNumber: { contains: search, mode: "insensitive" } },
                { guardianContacts: { some: { phone: { contains: search, mode: "insensitive" } } } },
              ],
            },
          }
        : {}),
    },
    include: {
      class: true,
      stream: true,
      student: { include: { guardianContacts: { orderBy: [{ isPrimary: "desc" }, { guardianName: "asc" }] } } },
    },
    orderBy: [{ class: { name: "asc" } }, { stream: { code: "asc" } }, { student: { admissionNumber: "asc" } }],
  });
}

export async function listEnrolledStudents(
  prisma: PrismaClient,
  schoolCode: string,
  filters?: { classId?: string; streamId?: string; search?: string },
): Promise<StudentListItem[]> {
  const rows = await loadStudentEnrollmentRows(prisma, schoolCode, filters);

  for (const row of rows) {
    const classRecord = row.class as (typeof row.class) | null;
    const streamRecord = row.stream as (typeof row.stream) | null;
    if (!classRecord || !streamRecord) {
      console.warn("[studentRepository] enrollment has missing relation", {
        enrollmentId: row.id,
        studentId: row.studentId,
        classId: row.classId,
        streamId: row.streamId,
        missingClass: !classRecord,
        missingStream: !streamRecord,
        schoolCode,
      });
    }
  }

  return rows.map(toStudentListItem);
}

export async function getEnrolledStudent(prisma: PrismaClient, schoolCode: string, studentId: string): Promise<StudentListItem | null> {
  const rows = await loadStudentEnrollmentRows(prisma, schoolCode, { studentId });
  return rows[0] ? toStudentListItem(rows[0]) : null;
}

export async function getStudentByAdmissionNumber(prisma: PrismaClient, schoolCode: string, admissionNumber: string) {
  const school = await prisma.school.findUnique({ where: { code: schoolCode } });
  if (!school) return null;
  return prisma.student.findFirst({
    where: { schoolId: school.id, admissionNumber: { equals: admissionNumber, mode: "insensitive" } },
    include: {
      guardianContacts: true,
      enrollments: {
        include: { class: true, stream: true, academicYear: true, term: true },
        orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
      },
    },
  });
}

export async function listStudentsForSchool(prisma: PrismaClient, schoolCode: string, filters?: { classId?: string; streamId?: string; search?: string; isActive?: string }) {
  return loadStudentEnrollmentRows(prisma, schoolCode, filters);
}

export async function createStudentRecord(
  prisma: PrismaClient,
  schoolCode: string,
  input: StudentCreateInput & { admissionNumber: string },
  createdBy?: string | null,
) {
  const school = await prisma.school.findUniqueOrThrow({ where: { code: schoolCode } });
  const activeYear = await prisma.academicYear.findFirst({ where: { schoolId: school.id, isActive: true }, include: { terms: { where: { isActive: true } } } });
  const activeTerm = activeYear?.terms[0];
  if (!activeYear || !activeTerm) throw new Error("An active academic year and term are required before adding students.");

  const student = await prisma.$transaction(async (tx) => {
    const created = await tx.student.create({
      data: {
        schoolId: school.id,
        admissionNumber: input.admissionNumber,
        firstName: input.fullName.trim(),
        lastName: "",
        isActive: input.isActive,
      },
    });
    await tx.classEnrollment.create({
      data: {
        schoolId: school.id,
        studentId: created.id,
        academicYearId: activeYear.id,
        termId: activeTerm.id,
        classId: input.classId,
        streamId: input.streamId,
        isActive: input.isActive,
        status: input.isActive ? "ACTIVE" : "INACTIVE",
      },
    });
    if (input.guardianName || input.guardianPhone || input.guardianEmail || input.notes) {
      await tx.guardianContact.create({
        data: {
          schoolId: school.id,
          studentId: created.id,
          guardianName: input.guardianName || "Parent/Guardian",
          relationship: "Parent",
          phone: input.guardianPhone || null,
          email: input.guardianEmail || null,
          notes: input.notes || null,
          preferredContactMethod: input.guardianPhone ? "PHONE" : "EMAIL",
          isPrimary: true,
          canReceiveReports: true,
        },
      });
    }
    if (createdBy) {
      await tx.auditLog.create({ data: { schoolId: school.id, action: "student.manual_create", details: { studentId: created.id, createdBy } } });
    }
    return created;
  });
  return student;
}

export async function getContactSummary(prisma: PrismaClient, schoolCode: string) {
  const school = await prisma.school.findUnique({ where: { code: schoolCode } });
  if (!school) return { guardians: 0, emailContacts: 0, phoneContacts: 0, reportRecipients: 0 };
  const contacts = await prisma.guardianContact.findMany({
    where: {
      schoolId: school.id,
      student: { isActive: true, enrollments: { some: { isActive: true, status: "ACTIVE" } } },
    },
  });
  return {
    guardians: contacts.length,
    emailContacts: contacts.filter((contact) => contact.email).length,
    phoneContacts: contacts.filter((contact) => contact.phone).length,
    reportRecipients: contacts.filter((contact) => contact.canReceiveReports && (contact.phone || contact.email)).length,
  };
}

export async function upsertGuardianContact(
  prisma: PrismaClient,
  schoolCode: string,
  studentId: string,
  input: GuardianContactInput,
  contactId?: string,
) {
  const school = await prisma.school.findUniqueOrThrow({ where: { code: schoolCode } });
  const student = await getEnrolledStudent(prisma, schoolCode, studentId);
  if (!student) throw new Error("Reports can only be issued for enrolled students.");

  return prisma.$transaction(async (tx) => {
    if (input.isPrimary) {
      await tx.guardianContact.updateMany({ where: { studentId }, data: { isPrimary: false } });
    }
    if (contactId) {
      return tx.guardianContact.update({
        where: { id: contactId },
        data: { ...input, phone: input.phone || null, email: input.email || null, notes: input.notes || null },
      });
    }
    return tx.guardianContact.create({
      data: {
        schoolId: school.id,
        studentId,
        ...input,
        phone: input.phone || null,
        email: input.email || null,
        notes: input.notes || null,
      },
    });
  });
}

export async function deleteGuardianContact(prisma: PrismaClient, schoolCode: string, studentId: string, contactId: string) {
  const student = await getEnrolledStudent(prisma, schoolCode, studentId);
  if (!student) throw new Error("Reports can only be issued for enrolled students.");
  await prisma.guardianContact.delete({ where: { id: contactId, studentId } });
}
