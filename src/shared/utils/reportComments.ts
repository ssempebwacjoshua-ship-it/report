export const COMMENT_LIMITS = {
  classTeacherComment: 500,
  headTeacherComment: 500,
  conductNote: 300,
  classTeacherName: 100,
  headTeacherName: 100,
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

