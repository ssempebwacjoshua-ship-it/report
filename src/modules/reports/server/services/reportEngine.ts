import type { AssessmentFilter, ReportFilters, ReportsResponse, StudentReportCard } from "../../../../shared/types/reports";
import type { GradingScaleSettings, ReportPersonalizationSettings, ReportSettings, SchoolProfileSettings } from "../../../../shared/types/settings";
import { defaultSettingsSections } from "../../../../shared/types/settings";
import type { ContactReadiness } from "../../../../shared/types/students";
import { REPORT_CONTENT_LIMITS, constrainReportText } from "../../../../shared/utils/reportContentLimits";
import { gradeForAverage, roundMark } from "../../../../server/services/gradeService";
import { rankByScore } from "../../../../server/services/rankingService";
import { emptyReasonForReadiness } from "../../../../server/services/readinessService";

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
  componentFinalMode?: "AVERAGE" | "WEIGHTED" | "MANUAL";
  components?: EngineSubjectComponent[];
};

export type EngineSubjectComponent = {
  id: string;
  name: string;
  code?: string | null;
  sortOrder: number;
  weight?: number | null;
};

export type EngineMark = {
  studentId: string;
  subjectId: string;
  componentId?: string | null;
  componentKey?: string | null;
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

function markForType(markSet: EngineMark[], type: "BOT" | "MOT" | "EOT"): number | null {
  return markSet.find((mark) => mark.assessmentType === type)?.marks ?? null;
}

function isSimpleMark(mark: EngineMark): boolean {
  return !mark.componentId && !mark.componentKey;
}

function weightedAverage(values: Array<{ value: number | null; weight: number | null | undefined }>): number | null {
  const present = values.filter((item): item is { value: number; weight: number } => item.value != null && item.weight != null && item.weight > 0);
  if (present.length === 0) return null;
  const totalWeight = present.reduce((sum, item) => sum + item.weight, 0);
  if (totalWeight <= 0) return null;
  return roundMark(present.reduce((sum, item) => sum + item.value * item.weight, 0) / totalWeight);
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

  const buildSubjectRow = (studentId: string, subject: EngineSubject) => {
    const markSet = marksByStudentSubject.get(`${studentId}:${subject.id}`) ?? [];
    const simpleMarks = markSet.filter(isSimpleMark);
    const botMarks = markForType(simpleMarks, "BOT");
    const motMarks = markForType(simpleMarks, "MOT");
    const eotMarks = markForType(simpleMarks, "EOT");
    const simpleMarkForType = (type: "BOT" | "MOT" | "EOT") => (
      type === "BOT" ? botMarks : type === "MOT" ? motMarks : eotMarks
    );
    const simpleMarksForFilter = required.map(simpleMarkForType);
    const simpleAverage = averageForMarks(simpleMarksForFilter);

    const components = (subject.components ?? [])
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((component) => {
        const componentMarks = markSet.filter((mark) => mark.componentId === component.id || mark.componentKey === component.id);
        const componentBot = markForType(componentMarks, "BOT");
        const componentMot = markForType(componentMarks, "MOT");
        const componentEot = markForType(componentMarks, "EOT");
        const componentMarkForType = (type: "BOT" | "MOT" | "EOT") => (
          type === "BOT" ? componentBot : type === "MOT" ? componentMot : componentEot
        );
        return {
          componentId: component.id,
          componentName: component.name,
          componentCode: component.code ?? null,
          sortOrder: component.sortOrder,
          weight: component.weight ?? null,
          botMarks: componentBot,
          motMarks: componentMot,
          eotMarks: componentEot,
          finalMark: averageForMarks(required.map(componentMarkForType)),
        };
      });

    const hasComponentMarks = components.some((component) => component.finalMark != null);
    const componentAverage = averageForMarks(components.map((component) => component.finalMark));
    const weightedComponentAverage = weightedAverage(components.map((component) => ({
      value: component.finalMark,
      weight: component.weight,
    })));
    const mode = subject.componentFinalMode ?? "AVERAGE";
    const componentFinal = mode === "MANUAL" && simpleAverage != null
      ? simpleAverage
      : mode === "WEIGHTED" && weightedComponentAverage != null
        ? weightedComponentAverage
        : componentAverage;

    const average = hasComponentMarks ? componentFinal : simpleAverage;
    const total = hasComponentMarks
      ? null
      : simpleMarksForFilter.some((value) => value != null)
        ? roundMark(simpleMarksForFilter.reduce((sum, value) => sum + (value ?? 0), 0))
        : null;
    const missingMarks = hasComponentMarks
      ? components.flatMap((component) => {
          const missing = required.filter((type) => {
            const value = type === "BOT" ? component.botMarks : type === "MOT" ? component.motMarks : component.eotMarks;
            return value == null;
          });
          return missing.map((type) => `${component.componentName} ${type}`);
        })
      : required.filter((type) => simpleMarkForType(type) == null);

    return {
      subjectId: subject.id,
      subjectName: subject.name,
      componentFinalMode: mode,
      botMarks,
      motMarks,
      eotMarks,
      total,
      average,
      grade: gradeForAverage(average, grading),
      subjectPosition: null,
      missingMarks,
      comments: constrainReportText(
        markSet.map((mark) => mark.comments).filter(Boolean).join(" "),
        REPORT_CONTENT_LIMITS.subjectRemark,
        { preserveLineBreaks: true },
      ),
      components,
    };
  };

  const subjectPositions = new Map<string, Map<string, number | null>>();
  for (const subject of input.subjects) {
    const subjectScores = input.students.map((student) => {
      return { id: student.id, score: buildSubjectRow(student.id, subject).average };
    });
    subjectPositions.set(subject.id, rankByScore(subjectScores));
  }

  const sortedSubjects = [...input.subjects].sort((a, b) => a.sortOrder - b.sortOrder);
  const cardsWithoutPosition: StudentReportCard[] = input.students.map((student) => {
    const subjects = sortedSubjects.map((subject) => ({
      ...buildSubjectRow(student.id, subject),
      subjectPosition: subjectPositions.get(subject.id)?.get(student.id) ?? null,
    }));

    const countedSubjectAverages = subjects.map((subject) => subject.average).filter((value): value is number => value != null);
    const average = countedSubjectAverages.length
      ? roundMark(countedSubjectAverages.reduce((sum, value) => sum + value, 0) / countedSubjectAverages.length)
      : null;
    const missingMarks = subjects.flatMap((subject) => subject.missingMarks.map((type) => `${subject.subjectName} ${type}`));
    const marksFound = subjects.reduce((sum, subject) => {
      if (subject.components?.some((component) => component.finalMark != null)) {
        return sum + subject.components.reduce((componentSum, component) => {
          const bot = required.includes("BOT") && component.botMarks != null ? 1 : 0;
          const mot = required.includes("MOT") && component.motMarks != null ? 1 : 0;
          const eot = required.includes("EOT") && component.eotMarks != null ? 1 : 0;
          return componentSum + bot + mot + eot;
        }, 0);
      }
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
