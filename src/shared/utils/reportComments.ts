import { REPORT_CONTENT_LIMITS } from "./reportContentLimits";

export const COMMENT_LIMITS = {
  classTeacherComment: REPORT_CONTENT_LIMITS.classTeacherComment,
  headTeacherComment: REPORT_CONTENT_LIMITS.headTeacherComment,
  conductNote: REPORT_CONTENT_LIMITS.conductNote,
  classTeacherName: REPORT_CONTENT_LIMITS.classTeacherName,
  headTeacherName: REPORT_CONTENT_LIMITS.headTeacherName,
} as const;

export type ReportComments = {
  classTeacherComment: string;
  headTeacherComment: string;
  conductNote: string;
  classTeacherName: string;
  headTeacherName: string;
  issueDate: string;
};

export const EMPTY_REPORT_COMMENTS: ReportComments = {
  classTeacherComment: "",
  headTeacherComment: "",
  conductNote: "",
  classTeacherName: "",
  headTeacherName: "",
  issueDate: "",
};
