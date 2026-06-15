import type { PrismaClient } from "@prisma/client";
import { getSettingsSections } from "../repositories/settingsRepository";

export type AssistantContextQuery = {
  schoolCode: string;
  classId: string;
  streamId?: string;
  assessmentType: "BOT" | "MOT" | "EOT" | "TERM_SUMMARY";
  academicYearId?: string;
  termId?: string;
};

export type StudentReadinessSummary = {
  studentId: string;
  admissionNumber: string;
  name: string;
  hasAnyMark: boolean;
  hasAllFinalized: boolean;
  missingSubjectNames: string[];
  draftSubjectNames: string[];
  contactReady: boolean;
};

export type ReportAssistantContext = {
  // context validity
  schoolFound: boolean;
  classFound: boolean;
  streamFound: boolean;
  hasActiveTerm: boolean;
  hasSubjects: boolean;
  hasStudents: boolean;
  gradingConfigured: boolean;

  // display names
  className: string;
  streamName: string;
  academicYear: string;
  term: string;
  assessmentType: string;

  // mark counts
  totalStudents: number;
  totalSubjects: number;
  finalizedMarkCount: number;
  draftMarkCount: number;
  studentsReadyToIssue: number;
  studentsWithNoMarks: number;
  studentsWithMissingMarks: number;

  // readiness
  isReadyToIssue: boolean;
  readinessCode: "READY" | "NO_ACTIVE_TERM" | "NO_STUDENTS" | "NO_SUBJECTS" | "NO_FINALIZED_MARKS" | "MISSING_MARKS" | "SCHOOL_NOT_FOUND" | "CLASS_NOT_FOUND";

  // human-readable issue list
  issues: string[];
  warnings: string[];

  // per-student detail (no DB calls inside this — assembled from Maps)
  students: StudentReadinessSummary[];
};

function requiredTypes(assessmentType: string): Array<"BOT" | "MOT" | "EOT"> {
  return assessmentType === "TERM_SUMMARY" ? ["BOT", "MOT", "EOT"] : [assessmentType as "BOT" | "MOT" | "EOT"];
}

export async function buildReportAssistantContext(
  prisma: PrismaClient,
  query: AssistantContextQuery,
): Promise<ReportAssistantContext> {
  const settings = await getSettingsSections(prisma, query.schoolCode);

  // ── Batch query 1: school with subjects and active academic year/term ────────
  const school = await prisma.school.findUnique({
    where: { code: query.schoolCode },
    include: {
      subjects: { where: { isActive: true }, orderBy: { sortOrder: "asc" } },
      academicYears: {
        where: query.academicYearId ? { id: query.academicYearId } : { isActive: true },
        include: { terms: { where: query.termId ? { id: query.termId } : { isActive: true } } },
      },
    },
  });

  if (!school) {
    return emptyContext({ readinessCode: "SCHOOL_NOT_FOUND", issues: ["School not found."] });
  }

  const academicYear = school.academicYears[0] ?? null;
  const term = academicYear?.terms[0] ?? null;

  if (!term) {
    return emptyContext({ readinessCode: "NO_ACTIVE_TERM", issues: ["No active term is configured."] });
  }

  // ── Batch query 2: class and stream records ──────────────────────────────────
  const [classRecord, streamRecord] = await Promise.all([
    prisma.schoolClass.findFirst({ where: { id: query.classId, schoolId: school.id } }),
    query.streamId ? prisma.stream.findFirst({ where: { id: query.streamId, schoolId: school.id } }) : Promise.resolve(null),
  ]);

  if (!classRecord) {
    return emptyContext({ readinessCode: "CLASS_NOT_FOUND", issues: [`Class not found.`] });
  }

  const subjects = school.subjects;
  const gradingConfigured = settings.grading.grades.length > 0;
  const required = requiredTypes(query.assessmentType);

  if (subjects.length === 0) {
    return {
      ...emptyContext({ readinessCode: "NO_SUBJECTS", issues: ["No subjects are configured for this school."] }),
      schoolFound: true,
      classFound: true,
      streamFound: !query.streamId || Boolean(streamRecord),
      hasActiveTerm: true,
      gradingConfigured,
      className: classRecord.name,
      streamName: streamRecord?.name ?? "",
      academicYear: academicYear.name,
      term: term.name,
      assessmentType: query.assessmentType,
    };
  }

  // ── Batch query 3: all active enrollments for this class/stream ──────────────
  const enrollments = await prisma.classEnrollment.findMany({
    where: {
      schoolId: school.id,
      classId: query.classId,
      streamId: query.streamId || undefined,
      academicYearId: academicYear.id,
      termId: term.id,
      isActive: true,
      status: "ACTIVE",
      student: { isActive: true },
    },
    include: {
      student: {
        include: {
          guardianContacts: { select: { canReceiveReports: true, phone: true, email: true } },
        },
      },
    },
    orderBy: { student: { admissionNumber: "asc" } },
  });

  if (enrollments.length === 0) {
    return {
      ...emptyContext({ readinessCode: "NO_STUDENTS", issues: ["No active students enrolled in this class."] }),
      schoolFound: true,
      classFound: true,
      streamFound: !query.streamId || Boolean(streamRecord),
      hasActiveTerm: true,
      hasSubjects: true,
      gradingConfigured,
      className: classRecord.name,
      streamName: streamRecord?.name ?? "",
      academicYear: academicYear.name,
      term: term.name,
      assessmentType: query.assessmentType,
      totalSubjects: subjects.length,
    };
  }

  const studentIds = enrollments.map((e) => e.studentId);

  // ── Batch query 4: ALL marks for enrolled students (FINALIZED + DRAFT) ───────
  const allMarks = await prisma.subjectMark.findMany({
    where: {
      schoolId: school.id,
      academicYearId: academicYear.id,
      termId: term.id,
      classId: query.classId,
      streamId: query.streamId || undefined,
      studentId: { in: studentIds },
      assessmentType: query.assessmentType === "TERM_SUMMARY" ? undefined : query.assessmentType,
    },
    select: { studentId: true, subjectId: true, assessmentType: true, status: true, marks: true },
  });

  // ── Assemble with Maps (zero DB calls below this line) ───────────────────────

  // Map: studentId + subjectId + assessmentType → mark status
  type MarkKey = string;
  const markMap = new Map<MarkKey, "FINALIZED" | "DRAFT">();
  let finalizedMarkCount = 0;
  let draftMarkCount = 0;

  for (const mark of allMarks) {
    const key = `${mark.studentId}:${mark.subjectId}:${mark.assessmentType}`;
    // FINALIZED wins over DRAFT if a duplicate somehow exists
    if (!markMap.has(key) || mark.status === "FINALIZED") {
      markMap.set(key, mark.status as "FINALIZED" | "DRAFT");
    }
  }
  for (const status of markMap.values()) {
    if (status === "FINALIZED") finalizedMarkCount++;
    else draftMarkCount++;
  }

  // Map: subjectId → subjectName
  const subjectNameMap = new Map(subjects.map((s) => [s.id, s.name]));

  // Per-student readiness assembly
  const studentSummaries: StudentReadinessSummary[] = [];
  let studentsReadyToIssue = 0;
  let studentsWithNoMarks = 0;
  let studentsWithMissingMarks = 0;

  for (const enrollment of enrollments) {
    const student = enrollment.student;
    const missingSubjectNames: string[] = [];
    const draftSubjectNames: string[] = [];

    for (const subject of subjects) {
      // A subject is complete only when ALL required assessment types are finalized
      const hasFinalized = required.every(
        (type) => markMap.get(`${student.id}:${subject.id}:${type}`) === "FINALIZED",
      );
      const hasSomeDraft = required.some(
        (type) => markMap.get(`${student.id}:${subject.id}:${type}`) === "DRAFT",
      );
      if (!hasFinalized) {
        missingSubjectNames.push(subjectNameMap.get(subject.id) ?? subject.id);
      }
      if (!hasFinalized && hasSomeDraft) {
        draftSubjectNames.push(subjectNameMap.get(subject.id) ?? subject.id);
      }
    }

    const hasAnyMark = subjects.some((s) =>
      required.some((type) => markMap.has(`${student.id}:${s.id}:${type}`)),
    );
    const hasAllFinalized = missingSubjectNames.length === 0;

    const contactReady = student.guardianContacts.some(
      (c) => c.canReceiveReports && (c.phone || c.email),
    );

    studentSummaries.push({
      studentId: student.id,
      admissionNumber: student.admissionNumber,
      name: `${student.firstName} ${student.lastName}`,
      hasAnyMark,
      hasAllFinalized,
      missingSubjectNames,
      draftSubjectNames,
      contactReady,
    });

    if (!hasAnyMark) studentsWithNoMarks++;
    else if (!hasAllFinalized) studentsWithMissingMarks++;
    if (hasAllFinalized) studentsReadyToIssue++;
  }

  // ── Build issue / warning lists ───────────────────────────────────────────────
  const issues: string[] = [];
  const warnings: string[] = [];

  if (finalizedMarkCount === 0) issues.push("No finalized marks exist for this class.");
  if (studentsWithNoMarks > 0)
    issues.push(`${studentsWithNoMarks} student(s) have no marks at all.`);
  if (studentsWithMissingMarks > 0)
    issues.push(`${studentsWithMissingMarks} student(s) have marks for some but not all subjects.`);
  if (draftMarkCount > 0)
    warnings.push(`${draftMarkCount} mark entry(s) are still in DRAFT status and will not appear in reports.`);
  if (!gradingConfigured)
    warnings.push("No grading scale is configured — grades will not appear on reports.");
  if (studentSummaries.some((s) => !s.contactReady))
    warnings.push(`${studentSummaries.filter((s) => !s.contactReady).length} student(s) have no valid parent contact for report delivery.`);

  // ── Determine overall readiness ────────────────────────────────────────────────
  let readinessCode: ReportAssistantContext["readinessCode"];
  if (finalizedMarkCount === 0) readinessCode = "NO_FINALIZED_MARKS";
  else if (studentsWithMissingMarks > 0 || studentsWithNoMarks > 0) readinessCode = "MISSING_MARKS";
  else readinessCode = "READY";

  const isReadyToIssue = readinessCode === "READY";

  return {
    schoolFound: true,
    classFound: true,
    streamFound: !query.streamId || Boolean(streamRecord),
    hasActiveTerm: true,
    hasSubjects: true,
    hasStudents: true,
    gradingConfigured,
    className: classRecord.name,
    streamName: streamRecord?.name ?? "",
    academicYear: academicYear.name,
    term: term.name,
    assessmentType: query.assessmentType,
    totalStudents: enrollments.length,
    totalSubjects: subjects.length,
    finalizedMarkCount,
    draftMarkCount,
    studentsReadyToIssue,
    studentsWithNoMarks,
    studentsWithMissingMarks,
    isReadyToIssue,
    readinessCode,
    issues,
    warnings,
    students: studentSummaries,
  };
}

function emptyContext(
  overrides: Partial<ReportAssistantContext> & { readinessCode: ReportAssistantContext["readinessCode"]; issues: string[] },
): ReportAssistantContext {
  return {
    schoolFound: false,
    classFound: false,
    streamFound: false,
    hasActiveTerm: false,
    hasSubjects: false,
    hasStudents: false,
    gradingConfigured: false,
    className: "",
    streamName: "",
    academicYear: "",
    term: "",
    assessmentType: "",
    totalStudents: 0,
    totalSubjects: 0,
    finalizedMarkCount: 0,
    draftMarkCount: 0,
    studentsReadyToIssue: 0,
    studentsWithNoMarks: 0,
    studentsWithMissingMarks: 0,
    isReadyToIssue: false,
    issues: [],
    warnings: [],
    students: [],
    ...overrides,
  };
}
