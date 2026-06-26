import type { StudentReportCard, SubjectReportRow } from "../types/reports";
import type { SchoolProfileSettings } from "../types/settings";

const ELLIPSIS = "...";

export const REPORT_CONTENT_LIMITS = {
  classTeacherComment: 240,
  headTeacherComment: 240,
  conductNote: 140,
  classTeacherName: 80,
  headTeacherName: 80,
  subjectRemark: 120,
  schoolName: 80,
  schoolContactLine: 120,
  reportFooterText: 140,
} as const;

function collapseReportWhitespace(value: string, preserveLineBreaks: boolean): string {
  const normalized = value.replace(/\r\n?/g, "\n");
  const collapsedLines = normalized
    .split("\n")
    .map((line) => line.replace(/[^\S\n]+/g, " ").trim())
    .filter((line, index, lines) => line !== "" || (index > 0 && index < lines.length - 1));

  if (!preserveLineBreaks) {
    return collapsedLines.join(" ").replace(/\s{2,}/g, " ").trim();
  }

  return collapsedLines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function constrainReportText(
  value: string | null | undefined,
  limit: number,
  options: { preserveLineBreaks?: boolean } = {},
): string {
  if (typeof value !== "string") return "";
  const normalized = collapseReportWhitespace(value, Boolean(options.preserveLineBreaks));
  if (normalized.length <= limit) return normalized;
  const sliceLength = Math.max(0, limit - ELLIPSIS.length);
  return `${normalized.slice(0, sliceLength).trimEnd()}${ELLIPSIS}`;
}

export type ReportCommentsInput = {
  classTeacherComment?: string | null;
  headTeacherComment?: string | null;
  conductNote?: string | null;
  classTeacherName?: string | null;
  headTeacherName?: string | null;
  issueDate?: string | null;
};

export function sanitizeReportComments<T extends ReportCommentsInput>(comments: T): T {
  return {
    ...comments,
    classTeacherComment: constrainReportText(comments.classTeacherComment, REPORT_CONTENT_LIMITS.classTeacherComment, { preserveLineBreaks: true }),
    headTeacherComment: constrainReportText(comments.headTeacherComment, REPORT_CONTENT_LIMITS.headTeacherComment, { preserveLineBreaks: true }),
    conductNote: constrainReportText(comments.conductNote, REPORT_CONTENT_LIMITS.conductNote, { preserveLineBreaks: true }),
    classTeacherName: constrainReportText(comments.classTeacherName, REPORT_CONTENT_LIMITS.classTeacherName),
    headTeacherName: constrainReportText(comments.headTeacherName, REPORT_CONTENT_LIMITS.headTeacherName),
    issueDate: typeof comments.issueDate === "string" ? comments.issueDate.trim() : "",
  };
}

export function sanitizeSubjectReportRow(row: SubjectReportRow): SubjectReportRow {
  return {
    ...row,
    comments: constrainReportText(row.comments, REPORT_CONTENT_LIMITS.subjectRemark, { preserveLineBreaks: true }),
  };
}

export function sanitizeReportCardForRender(card: StudentReportCard): StudentReportCard {
  return {
    ...card,
    studentName: constrainReportText(card.studentName, 80),
    className: constrainReportText(card.className, 60),
    streamName: constrainReportText(card.streamName, 24),
    comments: constrainReportText(card.comments, REPORT_CONTENT_LIMITS.classTeacherComment, { preserveLineBreaks: true }),
    subjects: card.subjects.map(sanitizeSubjectReportRow),
    progressionText: constrainReportText(card.progressionText, REPORT_CONTENT_LIMITS.conductNote, { preserveLineBreaks: true }) || null,
  };
}

export function sanitizeSchoolSettingsForReport(school: SchoolProfileSettings): SchoolProfileSettings {
  const contactLine = [school.address, school.phone, school.email]
    .filter((part) => typeof part === "string" && part.trim().length > 0)
    .join(" | ");

  return {
    ...school,
    schoolName: constrainReportText(school.schoolName, REPORT_CONTENT_LIMITS.schoolName),
    address: constrainReportText(contactLine, REPORT_CONTENT_LIMITS.schoolContactLine),
    phone: "",
    email: "",
    reportFooterText: constrainReportText(school.reportFooterText, REPORT_CONTENT_LIMITS.reportFooterText, { preserveLineBreaks: true }),
    headTeacherName: constrainReportText(school.headTeacherName, REPORT_CONTENT_LIMITS.headTeacherName),
  };
}
