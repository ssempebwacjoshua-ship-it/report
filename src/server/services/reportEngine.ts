import type { AssessmentFilter, ReportFilters, ReportsResponse, StudentReportCard } from "../../shared/types/reports";
import type { GradingScaleSettings, ReportPersonalizationSettings, ReportSettings, SchoolProfileSettings } from "../../shared/types/settings";
import { defaultSettingsSections } from "../../shared/types/settings";
import type { ContactReadiness } from "../../shared/types/students";
import { REPORT_CONTENT_LIMITS, constrainReportText } from "../../shared/utils/reportContentLimits";
import { gradeForAverage, roundMark } from "./gradeService";
import { rankByScore } from "./rankingService";
import { emptyReasonForReadiness } from "./readinessService";

export type EngineStudent = {
  id: string;
  admissionNumber: string;
  firstName: string;
  lastName: string;
  passportPhotoUrl?: string | null;
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
  promotionsByStudentId?: Record<string, string>;
  settings?: {
    school: SchoolProfileSettings;
    reports: ReportSettings;
    personalization: ReportPersonalizationSettings;
    grading: GradingScaleSettings;
  };
  emptyReasonOverride?: string | null;
};

function requiredTypes(assessmentType: AssessmentFilter): Array<"BOT" | "MOT" | "EOT"> {
  return assessmentType === "TERM_SUMMARY" ? ["BOT", "MOT", "EOT"] : [assessmentType];
}

function averageForMarks(values: Array<number | null>): number | null {
  const present = values.filter((value): value is number => value != null);
  if (present.length === 0) return null;
  return roundMark(present.reduce((sum, value) => sum + value, 0) / present.length);
}

function gradingFromPersonalization(
  personalization: ReportPersonalizationSettings | undefined,
  fallback: GradingScaleSettings,
): GradingScaleSettings {
  if (!personalization || personalization.gradingScheme.length === 0) return fallback;
  return {
    grades: personalization.gradingScheme
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((band) => ({
        label: band.grade,
        minScore: band.minScore,
        maxScore: band.maxScore,
        descriptor: band.remark || band.name,
      })),
  };
}

export function buildReports(input: EngineInput): ReportsResponse {
  const required = requiredTypes(input.filters.assessmentType);
  const settings = input.settings ?? {
    school: defaultSettingsSections.school,
    reports: defaultSettingsSections.reports,
    personalization: defaultSettingsSections.reportPersonalization,
    grading: defaultSettingsSections.grading,
  };
  const grading = gradingFromPersonalization(settings.personalization, settings.grading);

  if (!input.hasActiveTerm) {
    return {
      filters: input.filters,
      readiness: "NO_ACTIVE_TERM",
      emptyReason: input.emptyReasonOverride ?? emptyReasonForReadiness("NO_ACTIVE_TERM"),
      cards: [],
      settings: {
        school: settings.school,
        reports: settings.reports,
        personalization: settings.personalization ?? defaultSettingsSections.reportPersonalization,
        grading,
      },
    };
  }
  if (input.subjects.length === 0) {
    return {
      filters: input.filters,
      readiness: "NO_SUBJECTS",
      emptyReason: input.emptyReasonOverride ?? emptyReasonForReadiness("NO_SUBJECTS"),
      cards: [],
      settings: {
        school: settings.school,
        reports: settings.reports,
        personalization: settings.personalization ?? defaultSettingsSections.reportPersonalization,
        grading,
      },
    };
  }
  if (input.students.length === 0) {
    return {
      filters: input.filters,
      readiness: "NO_STUDENTS",
      emptyReason: input.emptyReasonOverride ?? emptyReasonForReadiness("NO_STUDENTS"),
      cards: [],
      settings: {
        school: settings.school,
        reports: settings.reports,
        personalization: settings.personalization ?? defaultSettingsSections.reportPersonalization,
        grading,
      },
    };
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

  const sortedSubjects = [...input.subjects].sort((a, b) => a.sortOrder - b.sortOrder);
  const cardsWithoutPosition: StudentReportCard[] = input.students.map((student) => {
    const subjects = sortedSubjects.map((subject) => {
      const markSet = marksByStudentSubject.get(`${student.id}:${subject.id}`) ?? [];
      const botMarks = markSet.find((mark) => mark.assessmentType === "BOT")?.marks ?? null;
      const motMarks = markSet.find((mark) => mark.assessmentType === "MOT")?.marks ?? null;
      const eotMarks = markSet.find((mark) => mark.assessmentType === "EOT")?.marks ?? null;
      const markForType = (type: "BOT" | "MOT" | "EOT") => (
        type === "BOT" ? botMarks : type === "MOT" ? motMarks : eotMarks
      );
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
        grade: gradeForAverage(average, grading),
        subjectPosition: subjectPositions.get(subject.id)?.get(student.id) ?? null,
        missingMarks,
        comments: constrainReportText(
          markSet.map((mark) => mark.comments).filter(Boolean).join(" "),
          REPORT_CONTENT_LIMITS.subjectRemark,
          { preserveLineBreaks: true },
        ),
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
      passportPhotoUrl: student.passportPhotoUrl ?? null,
      className: student.className,
      streamName: student.streamName,
      academicYear: input.academicYearName,
      term: input.termName,
      marksFound,
      totalSubjects: input.subjects.length,
      average,
      grade: gradeForAverage(average, grading),
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
    overallPosition: settings.reports.showOverallPosition || settings.personalization.layout.showPosition
      ? (overallPositions.get(card.studentId) ?? null)
      : null,
  }));
  const filteredCards = input.filters.search
    ? cards.filter((card) => `${card.studentName} ${card.admissionNumber}`.toLowerCase().includes(input.filters.search!.toLowerCase()))
    : cards;

  const hasAnyMarks = cards.some((card) => card.marksFound > 0);
  const readiness = !hasAnyMarks ? "NO_FINALIZED_MARKS" : cards.some((card) => card.readiness === "MISSING_MARKS") ? "MISSING_MARKS" : "READY";

  return {
    filters: input.filters,
    readiness,
    emptyReason: filteredCards.length === 0 ? (input.emptyReasonOverride ?? "Filters returned no report data.") : emptyReasonForReadiness(readiness),
    cards: filteredCards,
    settings: {
      school: settings.school,
      reports: settings.reports,
      personalization: settings.personalization ?? defaultSettingsSections.reportPersonalization,
      grading,
    },
  };
}
