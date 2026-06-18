export type MarksheetStudent = {
  id: string;
  admissionNumber: string;
  firstName: string;
  lastName: string;
};

export type MarksheetStudentsResponse = {
  students: MarksheetStudent[];
};

export type MarksheetBatchContext = {
  className: string;
  streamName: string;
  subjectName: string;
  termName: string;
  examType: string;
  operatorName: string;
  studentsCount: number;
  marksEntered: number;
};

export type MarksheetBatch = {
  id: string;
  source: string;
  summary: string | null;
  createdAt: string;
  marksCount: number;
  approvalStatus: "PENDING_REVIEW" | "APPROVED" | "RETURNED";
  hmNote: string | null;
  parsedContext: MarksheetBatchContext | null;
};

export type MarksheetBatchesResponse = {
  batches: MarksheetBatch[];
};

