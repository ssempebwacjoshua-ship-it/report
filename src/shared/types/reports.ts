import type { REPORT_ASSESSMENT_FILTERS } from "../constants/assessmentTypes";
import type { GradingScaleSettings, ReportSettings, SchoolProfileSettings } from "./settings";
import type { ContactReadiness } from "./students";

export type AssessmentFilter = (typeof REPORT_ASSESSMENT_FILTERS)[number];
export type ReportReadiness =
  | "READY"
  | "MISSING_MARKS"
  | "NO_FINALIZED_MARKS"
  | "NO_STUDENTS"
  | "NO_SUBJECTS"
  | "NO_ACTIVE_TERM";

export type ReportFilters = {
  schoolCode: string;
  academicYearId?: string;
  termId?: string;
  classId: string;
  streamId?: string;
  assessmentType: AssessmentFilter;
  studentId?: string;
  search?: string;
};

export type SubjectReportRow = {
  subjectId: string;
  subjectName: string;
  botMarks: number | null;
  motMarks: number | null;
  eotMarks: number | null;
  total: number | null;
  average: number | null;
  grade: string | null;
  subjectPosition: number | null;
  missingMarks: string[];
  comments: string;
};

export type StudentReportCard = {
  studentId: string;
  admissionNumber: string;
  studentName: string;
  className: string;
  streamName: string;
  academicYear: string;
  term: string;
  marksFound: number;
  totalSubjects: number;
  average: number | null;
  grade: string | null;
  overallPosition: number | null;
  readiness: ReportReadiness;
  missingMarks: string[];
  comments: string;
  contactReadiness: ContactReadiness;
  contactSummary: string;
  subjects: SubjectReportRow[];
  /** Populated from PromotionAction when the student's promotion is on record for this term. */
  progressionText: string | null;
};

export type ReportContextOption = {
  id: string;
  name: string;
  code?: string;
  classId?: string;
  isActive?: boolean;
};

export type ReportContext = {
  school: { id: string; code: string; name: string } | null;
  academicYears: ReportContextOption[];
  terms: ReportContextOption[];
  classes: ReportContextOption[];
  streams: ReportContextOption[];
  subjects: ReportContextOption[];
};

export type ReportsResponse = {
  filters: ReportFilters;
  readiness: ReportReadiness;
  emptyReason: string | null;
  cards: StudentReportCard[];
  settings: {
    school: SchoolProfileSettings;
    reports: ReportSettings;
    grading: GradingScaleSettings;
  };
};

