import type { PrismaClient } from "@prisma/client";
import type { ReportFilters } from "../../shared/types/reports";
import type { ContactReadiness } from "../../shared/types/students";
import type { EngineInput } from "../services/reportEngine";

function getContactReadiness(contacts: Array<{ canReceiveReports: boolean; phone: string | null; email: string | null }>): ContactReadiness {
  const recipients = contacts.filter((contact) => contact.canReceiveReports);
  if (recipients.length === 0) return "NO_RECIPIENT";
  return recipients.some((contact) => !contact.phone || !contact.email) ? "MISSING_PHONE_EMAIL" : "READY";
}

function getContactSummary(contacts: Array<{ guardianName: string; relationship: string; canReceiveReports: boolean; phone: string | null; email: string | null; isPrimary: boolean }>): string {
  const primary = contacts.find((contact) => contact.isPrimary) ?? contacts[0];
  if (!primary) return "No guardian contacts";
  const channel = primary.phone ? primary.phone : primary.email ? primary.email : "missing phone/email";
  return `${primary.guardianName} (${primary.relationship}) - ${channel}`;
}

export async function loadReportEngineInput(prisma: PrismaClient, filters: ReportFilters): Promise<EngineInput> {
  const school = await prisma.school.findUnique({
    where: { code: filters.schoolCode },
    include: {
      academicYears: {
        where: filters.academicYearId ? { id: filters.academicYearId } : { isActive: true },
        include: { terms: { where: filters.termId ? { id: filters.termId } : { isActive: true } } },
      },
      subjects: { where: { isActive: true }, orderBy: { sortOrder: "asc" } },
    },
  });

  const academicYear = school?.academicYears[0] ?? null;
  const term = academicYear?.terms[0] ?? null;
  const classRecord = filters.classId ? await prisma.schoolClass.findUnique({ where: { id: filters.classId } }) : null;

  if (!school || !academicYear || !term || !classRecord) {
    return {
      filters,
      academicYearName: academicYear?.name ?? "",
      termName: term?.name ?? "",
      hasActiveTerm: Boolean(term),
      students: [],
      subjects: school?.subjects.map((subject) => ({ id: subject.id, name: subject.name, sortOrder: subject.sortOrder })) ?? [],
      marks: [],
    };
  }

  const enrollments = await prisma.classEnrollment.findMany({
    where: {
      academicYearId: academicYear.id,
      termId: term.id,
      classId: filters.classId,
      streamId: filters.streamId || undefined,
      isActive: true,
      status: "ACTIVE",
      student: { isActive: true },
    },
    include: { student: { include: { guardianContacts: true } }, class: true, stream: true },
    orderBy: [{ student: { admissionNumber: "asc" } }],
  });

  const studentIds = enrollments.map((enrollment) => enrollment.studentId);
  const marks = await prisma.subjectMark.findMany({
    where: {
      schoolId: school.id,
      academicYearId: academicYear.id,
      termId: term.id,
      classId: filters.classId,
      streamId: filters.streamId || undefined,
      studentId: { in: studentIds },
      status: "FINALIZED",
      assessmentType: filters.assessmentType === "TERM_SUMMARY" ? undefined : filters.assessmentType,
    },
  });

  return {
    filters: { ...filters, academicYearId: academicYear.id, termId: term.id },
    academicYearName: academicYear.name,
    termName: term.name,
    hasActiveTerm: true,
    students: enrollments.map((enrollment) => ({
      id: enrollment.student.id,
      admissionNumber: enrollment.student.admissionNumber,
      firstName: enrollment.student.firstName,
      lastName: enrollment.student.lastName,
      className: enrollment.class.name,
      streamName: enrollment.stream.name,
      contactReadiness: getContactReadiness(enrollment.student.guardianContacts),
      contactSummary: getContactSummary(enrollment.student.guardianContacts),
    })),
    subjects: school.subjects.map((subject) => ({ id: subject.id, name: subject.name, sortOrder: subject.sortOrder })),
    marks: marks.map((mark) => ({
      studentId: mark.studentId,
      subjectId: mark.subjectId,
      assessmentType: mark.assessmentType,
      marks: Number(mark.marks),
      comments: mark.comments,
    })),
  };
}
