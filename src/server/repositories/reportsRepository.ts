import type { PrismaClient } from "@prisma/client";
import type { ReportFilters } from "../../shared/types/reports";
import type { ContactReadiness } from "../../shared/types/students";
import type { EngineInput } from "../services/reportEngine";
import { getSettingsSections } from "./settingsRepository";

function getContactReadiness(contacts: Array<{ canReceiveReports: boolean; phone: string | null; email: string | null }>): ContactReadiness {
  const recipients = contacts.filter((contact) => contact.canReceiveReports);
  if (recipients.length === 0) return "NO_RECIPIENT";
  return recipients.some((contact) => !contact.phone || !contact.email) ? "MISSING_PHONE_EMAIL" : "READY";
}

function getContactSummary(
  contacts: Array<{ guardianName: string; relationship: string; canReceiveReports: boolean; phone: string | null; email: string | null; isPrimary: boolean }>,
): string {
  const primary = contacts.find((contact) => contact.isPrimary) ?? contacts[0];
  if (!primary) return "No guardian contacts";
  const channel = primary.phone ? primary.phone : primary.email ? primary.email : "missing phone/email";
  return `${primary.guardianName} (${primary.relationship}) - ${channel}`;
}

function emptyInput(
  filters: ReportFilters,
  settings: Awaited<ReturnType<typeof getSettingsSections>>,
  options: { academicYearName?: string; termName?: string; hasActiveTerm?: boolean; subjects?: Array<{ id: string; name: string; sortOrder: number }>; emptyReasonOverride?: string | null },
): EngineInput {
  return {
    filters,
    academicYearName: options.academicYearName ?? "",
    termName: options.termName ?? "",
    hasActiveTerm: options.hasActiveTerm ?? false,
    students: [],
    subjects: options.subjects ?? [],
    marks: [],
    promotionsByStudentId: {},
    settings: {
      school: settings.school,
      reports: settings.reports,
      personalization: settings.reportPersonalization,
      grading: settings.grading,
    },
    emptyReasonOverride: options.emptyReasonOverride ?? null,
  };
}

export async function loadReportEngineInput(prisma: PrismaClient, filters: ReportFilters): Promise<EngineInput> {
  const settings = await getSettingsSections(prisma, filters.schoolCode);
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

  if (!school) {
    return emptyInput(filters, settings, {
      emptyReasonOverride: "School context could not be resolved for report generation.",
      subjects: [],
    });
  }

  const activeSubjects = school.subjects.map((subject) => ({ id: subject.id, name: subject.name, sortOrder: subject.sortOrder }));
  const academicYear = school.academicYears[0] ?? null;
  if (!academicYear) {
    return emptyInput(filters, settings, {
      academicYearName: "",
      termName: "",
      hasActiveTerm: false,
      subjects: activeSubjects,
      emptyReasonOverride: "No active academic year is configured for this school.",
    });
  }

  const term = academicYear.terms[0] ?? null;
  if (!term) {
    return emptyInput(filters, settings, {
      academicYearName: academicYear.name,
      termName: "",
      hasActiveTerm: false,
      subjects: activeSubjects,
      emptyReasonOverride: "No active term is configured for the selected academic year.",
    });
  }

  const classRecord = filters.classId
    ? await prisma.schoolClass.findFirst({ where: { id: filters.classId, schoolId: school.id } })
    : null;

  if (!classRecord) {
    return emptyInput(filters, settings, {
      academicYearName: academicYear.name,
      termName: term.name,
      hasActiveTerm: true,
      subjects: activeSubjects,
      emptyReasonOverride: "Selected class was not found for this school.",
    });
  }

  let streamReason: string | null = null;
  if (filters.streamId) {
    const stream = await prisma.stream.findFirst({
      where: { id: filters.streamId, classId: classRecord.id, schoolId: school.id },
      select: { id: true },
    });
    if (!stream) {
      streamReason = "Selected stream does not belong to the selected class for this school.";
    }
  }

  if (streamReason) {
    return emptyInput(filters, settings, {
      academicYearName: academicYear.name,
      termName: term.name,
      hasActiveTerm: true,
      subjects: activeSubjects,
      emptyReasonOverride: streamReason,
    });
  }

  const enrollments = await prisma.classEnrollment.findMany({
    where: {
      schoolId: school.id,
      academicYearId: academicYear.id,
      termId: term.id,
      classId: filters.classId,
      streamId: filters.streamId || undefined,
      studentId: filters.studentId || undefined,
      isActive: true,
      status: "ACTIVE",
      student: { isActive: true },
    },
    include: { student: { include: { guardianContacts: true } }, class: true, stream: true },
    orderBy: [{ student: { admissionNumber: "asc" } }],
  });

  const studentIds = enrollments.map((enrollment) => enrollment.studentId);
  const noStudentReason = filters.studentId
    ? "Selected student is not enrolled in the requested school/class/stream for the active term."
    : null;

  const rawPromotionActions = studentIds.length > 0
    ? await prisma.promotionAction.findMany({
      where: {
        schoolId: school.id,
        studentId: { in: studentIds },
        status: "APPLIED",
        batch: { academicYearId: academicYear.id, termId: term.id, status: "APPLIED" },
      },
      select: { studentId: true, decision: true, fromClassName: true, toClassName: true },
      orderBy: { createdAt: "desc" },
    })
    : [];

  const promotionsByStudentId: Record<string, string> = {};
  for (const action of rawPromotionActions) {
    if (!promotionsByStudentId[action.studentId]) {
      if (action.decision === "PROMOTE") {
        promotionsByStudentId[action.studentId] = `Promoted to ${action.toClassName ?? "next class"}`;
      } else if (action.decision === "REPEAT") {
        promotionsByStudentId[action.studentId] = `To repeat ${action.fromClassName}`;
      } else {
        promotionsByStudentId[action.studentId] = "Completed / Graduated";
      }
    }
  }

  const marks = studentIds.length > 0
    ? await prisma.subjectMark.findMany({
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
    })
    : [];

  return {
    filters: { ...filters, academicYearId: academicYear.id, termId: term.id },
    academicYearName: academicYear.name,
    termName: term.name,
    hasActiveTerm: true,
    promotionsByStudentId,
    students: enrollments.map((enrollment) => ({
      id: enrollment.student.id,
      admissionNumber: enrollment.student.admissionNumber,
      firstName: enrollment.student.firstName,
      lastName: enrollment.student.lastName,
      passportPhotoUrl: enrollment.student.passportPhotoUrl,
      className: enrollment.class.name,
      streamName: enrollment.stream.name,
      contactReadiness: getContactReadiness(enrollment.student.guardianContacts),
      contactSummary: getContactSummary(enrollment.student.guardianContacts),
    })),
    subjects: activeSubjects,
    marks: marks.map((mark) => ({
      studentId: mark.studentId,
      subjectId: mark.subjectId,
      assessmentType: mark.assessmentType,
      marks: Number(mark.marks),
      comments: mark.comments,
    })),
    settings: {
      school: settings.school,
      reports: settings.reports,
      personalization: settings.reportPersonalization,
      grading: settings.grading,
    },
    emptyReasonOverride: studentIds.length === 0 ? noStudentReason : null,
  };
}
