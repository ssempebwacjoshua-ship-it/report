import type { AssessmentFilter, ReportFilters, ReportsResponse, StudentReportCard } from "../../shared/types/reports";
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
};

export type EngineSubject = {
  id: string;
  name: string;
  sortOrder: number;
};

export type EngineMark = {
  studentId: string;
  subjectId: string;
  assessmentType: "BOT" | "EOT";
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
};

function requiredTypes(assessmentType: AssessmentFilter): Array<"BOT" | "EOT"> {
  return assessmentType === "ALL" ? ["BOT", "EOT"] : [assessmentType];
}

function averageForMarks(values: Array<number | null>): number | null {
  const present = values.filter((value): value is number => value != null);
  if (present.length === 0) return null;
  return roundMark(present.reduce((sum, value) => sum + value, 0) / present.length);
}

export function buildReports(input: EngineInput): ReportsResponse {
  const required = requiredTypes(input.filters.assessmentType);

  if (!input.hasActiveTerm) {
    return { filters: input.filters, readiness: "NO_ACTIVE_TERM", emptyReason: emptyReasonForReadiness("NO_ACTIVE_TERM"), cards: [] };
  }
  if (input.subjects.length === 0) {
    return { filters: input.filters, readiness: "NO_SUBJECTS", emptyReason: emptyReasonForReadiness("NO_SUBJECTS"), cards: [] };
  }
  if (input.students.length === 0) {
    return { filters: input.filters, readiness: "NO_STUDENTS", emptyReason: emptyReasonForReadiness("NO_STUDENTS"), cards: [] };
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
        const eotMarks = markSet.find((mark) => mark.assessmentType === "EOT")?.marks ?? null;
        const marksForFilter = required.map((type) => (type === "BOT" ? botMarks : eotMarks));
        const missingMarks = required.filter((type) => (type === "BOT" ? botMarks : eotMarks) == null);
        const average = averageForMarks(marksForFilter);
        const total = marksForFilter.some((value) => value != null)
          ? roundMark(marksForFilter.reduce((sum, value) => sum + (value ?? 0), 0))
          : null;

        return {
          subjectId: subject.id,
          subjectName: subject.name,
          botMarks,
          eotMarks,
          total,
          average,
          grade: gradeForAverage(average),
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
      const eot = required.includes("EOT") && subject.eotMarks != null ? 1 : 0;
      return sum + bot + eot;
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
      grade: gradeForAverage(average),
      overallPosition: null,
      readiness: missingMarks.length ? "MISSING_MARKS" : "READY",
      missingMarks,
      comments: "",
      subjects,
    };
  });

  const overallPositions = rankByScore(cardsWithoutPosition.map((card) => ({ id: card.studentId, score: card.average })));
  const cards = cardsWithoutPosition.map((card) => ({ ...card, overallPosition: overallPositions.get(card.studentId) ?? null }));
  const filteredCards = input.filters.search
    ? cards.filter((card) => `${card.studentName} ${card.admissionNumber}`.toLowerCase().includes(input.filters.search!.toLowerCase()))
    : cards;

  const hasAnyMarks = cards.some((card) => card.marksFound > 0);
  const readiness = !hasAnyMarks ? "NO_FINALIZED_MARKS" : cards.some((card) => card.readiness === "MISSING_MARKS") ? "MISSING_MARKS" : "READY";

  return {
    filters: input.filters,
    readiness,
    emptyReason: filteredCards.length === 0 ? "Filters returned no report data." : emptyReasonForReadiness(readiness),
    cards: filteredCards,
  };
}
