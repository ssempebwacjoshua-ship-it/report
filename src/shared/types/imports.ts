export type RawMarkImportRow = {
  admissionNumber: string;
  studentName: string;
  class: string;
  stream: string;
  subject: string;
  term: string;
  examType: string;
  marks: string;
  comments?: string;
};

export type ValidatedMarkImportRow = {
  rowNumber: number;
  raw: RawMarkImportRow;
  isValid: boolean;
  errors: string[];
};

export type ImportPreview = {
  status: "DRY_RUN" | "COMMITTED" | "FAILED";
  totalRows: number;
  validRows: number;
  invalidRows: number;
  rows: ValidatedMarkImportRow[];
  batchId?: string;
};

// ── Scan / handwritten marksheet import ──────────────────────────────────────

export type ScanRowStatus =
  | "PARSED"
  | "NEEDS_REVIEW"
  | "VALID"
  | "INVALID"
  | "COMMITTED"
  | "RETURNED"
  | "FINALIZED";

export type ScanImportRow = {
  rowNumber: number;
  admissionNumber: string;
  studentName: string;
  writtenMark: string;
  splitMark: string;
  suggestedMark: string;
  confidence: number;
  remarks: string;
  status: ScanRowStatus;
  validationErrors: string[];
  operatorCorrection: string;
};

export type ScanMarksheetContext = {
  marksheetId: string;
  className: string;
  streamName: string;
  subjectName: string;
  termName: string;
  examType: string;
  academicYear: string;
};

export type ScanParseStatus =
  | "UPLOADED"
  | "EXTRACTION_NOT_CONFIGURED"
  | "PARSING"
  | "PARSED"
  | "FAILED";

export type ScanImportBatch = {
  id: string;
  fileName: string;
  fileType: string;
  parseStatus: ScanParseStatus;
  message: string;
  context: ScanMarksheetContext | null;
  rows: ScanImportRow[];
  createdAt: string;
};

export type ScanUploadPayload = {
  schoolCode: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  context: ScanMarksheetContext;
};

export type ScanUploadResponse = {
  batchId: string;
  parseStatus: ScanParseStatus;
  message: string;
  rows: ScanImportRow[];
};
