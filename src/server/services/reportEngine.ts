import type { AssessmentFilter, ReadinessCounts, ReadinessFilter, ReportFilters, ReportsResponse, StudentReportCard } from "../../shared/types/reports";
import type { GradingScaleSettings, ReportSettings, SchoolProfileSettings } from "../../shared/types/settings";
import { defaultSettingsSections } from "../../shared/types/settings";
import type { ContactReadiness } from "../../shared/types/students";
import { gradeForAverage, roundMark } from "./gradeService";
import { rankByScore } from "./rankingService";
import { emptyReasonForReadiness } from "./readinessService";

export type EngineStudent = {
  id: string;
  admissionNumber: string;
  firstName: string;
  lastName: string;
  className: string;
  streamName: string;
  contactReadiness: ContactReadiness;
  contactSummary: string;
};

export type EngineSubject = {
  id: string;
  name: string;
  sortOrder: number;
};

export type EngineMark = {
  studentId: string;
  subjectId: string;
  assessmentType: "BOT" | "MOT" | "EOT";
  marks: number;
  comments?: string | null;
};

export type EngineInput = {
  filters: ReportFilters;
  academicYearName: string;
  termName: string;
  hasActiveTerm: boolean;
  students: EngineStudent[];
  subjects: EngineSubject[];
  marks: EngineMark[];
  /** studentId → human-readable progression text from PromotionAction */
  promotionsByStudentId?: Record<string, string>;
  /** IDs of students who already have an active issued report for this year/term/type */
  issuedStudentIds?: string[];
  settings?: {
    school: SchoolProfileSettings;
    reports: ReportSettings;
    grading: GradingScaleSettings;
  };
};

const EMPTY_COUNTS: ReadinessCounts = {
  total: 0,
  withReports: 0,
  noReports: 0,
  readyToIssue: 0,
  blockedContact: 0,
  issued: 0,
  notIssued: 0,
};

function requiredTypes(assessmentType: AssessmentFilter): Array<"BOT" | "MOT" | "EOT"> {
  return assessmentType === "TERM_SUMMARY" ? ["BOT", "MOT", "EOT"] : [assessmentType];
}

function averageForMarks(values: Array<number | null>): number | null {
  const present = values.filter((value): value is number => value != null);
  if (present.length === 0) return null;
  return roundMark(present.reduce((sum, value) => sum + value, 0) / present.length);
}

function applyReadinessFilter(cards: StudentReportCard[], filter: ReadinessFilter | undefined, issuedSet: Set<string>): StudentReportCard[] {
  if (!filter || filter === "ALL") return cards;
  return cards.filter((card) => {
    switch (filter) {
      case "WITH_REPORTS":    return card.marksFound > 0;
      case "NO_REPORTS":     return card.marksFound === 0;
      case "READY_TO_ISSUE": return card.marksFound > 0 && card.contactReadiness === "READY";
      case "BLOCKED_CONTACT":return card.marksFound > 0 && card.contactReadiness !== "READY";
      case "ISSUED":         return issuedSet.has(card.studentId);
      case "NOT_ISSUED":     return card.marksFound > 0 && !issuedSet.has(card.studentId);
    }
  });
}

export function computeReadinessCounts(cards: StudentReportCard[], issuedSet: Set<string>): ReadinessCounts {
  const withReports = cards.filter((c) => c.marksFound > 0).length;
  const noReports = cards.filter((c) => c.marksFound === 0).length;
  const issued = cards.filter((c) => issuedSet.has(c.studentId)).length;
  return {
    total: cards.length,
    withReports,
    noReports,
    readyToIssue: cards.filter((c) => c.marksFound > 0 && c.contactReadiness === "READY").length,
    blockedContact: cards.filter((c) => c.marksFound > 0 && c.contactReadiness !== "READY").length,
    issued,
    notIssued: withReports - issued,
  };
}

export function buildReports(input: EngineInput): ReportsResponse {
  const required = requiredTypes(input.filters.assessmentType);
  const settings = input.settings ?? {
    school: defaultSettingsSections.school,
    reports: defaultSettingsSections.reports,
    grading: defaultSettingsSections.grading,
  };
  const issuedSet = new Set(input.issuedStudentIds ?? []);

  if (!input.hasActiveTerm) {
    return { filters: input.filters, readiness: "NO_ACTIVE_TERM", emptyReason: emptyReasonForReadiness("NO_ACTIVE_TERM"), cards: [], readinessCounts: EMPTY_COUNTS, issuedStudentIds: [], settings };
  }
  if (input.subjects.length === 0) {
    return { filters: input.filters, readiness: "NO_SUBJECTS", emptyReason: emptyReasonForReadiness("NO_SUBJECTS"), cards: [], readinessCounts: EMPTY_COUNTS, issuedStudentIds: [], settings };
  }
  if (input.students.length === 0) {
    return { filters: input.filters, readiness: "NO_STUDENTS", emptyReason: emptyReasonForReadiness("NO_STUDENTS"), cards: [], readinessCounts: EMPTY_COUNTS, issuedStudentIds: [], settings };
  }

  const marksByStudentSubject = new Map<string, EngineMark[]>();
  for (const mark of input.marks) {
    const key = `${mark.studentId}:${mark.subjectId}`;
    marksByStudentSubject.set(key, [...(marksByStudentSubject.get(key) ?? []), mark]);
  }

  const subjectPositions = new Map<string, Map<string, number | null>>();
  for (const subject of input.subjects) {
    const subjectScores = input.students.map((student) => {
      const markSet = marksByStudentSubject.get(`${student.id}:${subject.id}`) ?? [];
      const scores = required.map((type) => markSet.find((mark) => mark.assessmentType === type)?.marks ?? null);
      return { id: student.id, score: averageForMarks(scores) };
    });
    subjectPositions.set(subject.id, rankByScore(subjectScores));
  }

  const cardsWithoutPosition: StudentReportCard[] = input.students.map((student) => {
    const subjects = input.subjects
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((subject) => {
        const markSet = marksByStudentSubject.get(`${student.id}:${subject.id}`) ?? [];
        const botMarks = markSet.find((mark) => mark.assessmentType === "BOT")?.marks ?? null;
        const motMarks = markSet.find((mark) => mark.assessmentType === "MOT")?.marks ?? null;
        const eotMarks = markSet.find((mark) => mark.assessmentType === "EOT")?.marks ?? null;
        const markForType = (type: "BOT" | "MOT" | "EOT") =>
          type === "BOT" ? botMarks : type === "MOT" ? motMarks : eotMarks;
        const marksForFilter = required.map(markForType);
        const missingMarks = required.filter((type) => markForType(type) == null);
        const average = averageForMarks(marksForFilter);
        const total = marksForFilter.some((value) => value != null)
          ? roundMark(marksForFilter.reduce((sum, value) => sum + (value ?? 0), 0))
          : null;

        return {
          subjectId: subject.id,
          subjectName: subject.name,
          botMarks,
          motMarks,
          eotMarks,
          total,
          average,
          grade: gradeForAverage(average, settings.grading),
          subjectPosition: subjectPositions.get(subject.id)?.get(student.id) ?? null,
          missingMarks,
          comments: markSet.map((mark) => mark.comments).filter(Boolean).join(" "),
        };
      });

    const countedSubjectAverages = subjects.map((subject) => subject.average).filter((value): value is number => value != null);
    const average = countedSubjectAverages.length
      ? roundMark(countedSubjectAverages.reduce((sum, value) => sum + value, 0) / countedSubjectAverages.length)
      : null;
    const missingMarks = subjects.flatMap((subject) => subject.missingMarks.map((type) => `${subject.subjectName} ${type}`));
    const marksFound = subjects.reduce((sum, subject) => {
      const bot = required.includes("BOT") && subject.botMarks != null ? 1 : 0;
      const mot = required.includes("MOT") && subject.motMarks != null ? 1 : 0;
      const eot = required.includes("EOT") && subject.eotMarks != null ? 1 : 0;
      return sum + bot + mot + eot;
    }, 0);

    return {
      studentId: student.id,
      admissionNumber: student.admissionNumber,
      studentName: `${student.firstName} ${student.lastName}`,
      className: student.className,
      streamName: student.streamName,
      academicYear: input.academicYearName,
      term: input.termName,
      marksFound,
      totalSubjects: input.subjects.length,
      average,
      grade: gradeForAverage(average, settings.grading),
      overallPosition: null,
      readiness: missingMarks.length ? "MISSING_MARKS" : "READY",
      missingMarks,
      comments: "",
      contactReadiness: student.contactReadiness,
      contactSummary: student.contactSummary,
      subjects,
      progressionText: input.promotionsByStudentId?.[student.id] ?? null,
    };
  });

  const overallPositions = rankByScore(cardsWithoutPosition.map((card) => ({ id: card.studentId, score: card.average })));
  const cards = cardsWithoutPosition.map((card) => ({
    ...card,
    overallPosition: settings.reports.showOverallPosition ? (overallPositions.get(card.studentId) ?? null) : null,
  }));

  const readinessCounts = computeReadinessCounts(cards, issuedSet);

  // Apply text search then readiness filter
  const afterSearch = input.filters.search
    ? cards.filter((card) => `${card.studentName} ${card.admissionNumber}`.toLowerCase().includes(input.filters.search!.toLowerCase()))
    : cards;
  const filteredCards = applyReadinessFilter(afterSearch, input.filters.readinessFilter, issuedSet);

  const hasAnyMarks = cards.some((card) => card.marksFound > 0);
  const readiness = !hasAnyMarks ? "NO_FINALIZED_MARKS" : cards.some((card) => card.readiness === "MISSING_MARKS") ? "MISSING_MARKS" : "READY";

  return {
    filters: input.filters,
    readiness,
    emptyReason: filteredCards.length === 0 ? "Filters returned no report data." : emptyReasonForReadiness(readiness),
    cards: filteredCards,
    readinessCounts,
    issuedStudentIds: [...issuedSet],
    settings,
  };
}
