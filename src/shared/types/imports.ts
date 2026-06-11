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
  | "MISSING"
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
  extractedMark?: string;
  suggestedMark: string;
  confidence: number;
  remarks: string;
  writtenMarkRaw?: string;
  splitMarkRaw?: string;
  splitDigitRaw?: string[];
  writtenCropDataUrl?: string;
  splitCropDataUrl?: string;
  splitDigitCropDataUrls?: string[];
  remarksCropDataUrl?: string;
  tableCropDataUrl?: string;
  debugRawOcr?: {
    written?: string;
    split?: string;
    splitZones?: string[];
  };
  debugCropImages?: {
    written?: string;
    split?: string;
    splitZones?: string[];
  };
  statusReason?: string;
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

export type ScanRowsValidationResponse = {
  status: "DRY_RUN";
  totalRows: number;
  validRows: number;
  missingRows: number;
  reviewRows: number;
  invalidRows: number;
  rows: ScanImportRow[];
};

// ── Context detection for scanned marksheet upload ────────────────────────────

/** How the context was obtained. Ordered from most to least authoritative. */
export type ContextSource =
  | "BATCH_LOOKUP"   // exact match from a previously committed import batch
  | "ID_PARSED"      // marksheet ID decoded against current school data
  | "HEADER_OCR"     // OCR found the ID string in the scanned header image
  | "MANUAL"         // operator typed the context manually
  | "NOT_EXTRACTED"; // could not determine context

export type DetectedContext = {
  marksheetId: string;
  className: string;
  streamName: string;
  subjectName: string;
  termName: string;
  examType: string;
  academicYear: string;
  overallConfidence: number; // 0–1
  source: ContextSource;
  partial: boolean;          // true when one or more fields could not be resolved
  message: string;
};

export type DetectContextResponse = {
  detected: DetectedContext | null;
  detectionStatus: "DETECTED" | "PARTIAL" | "NOT_FOUND" | "ERROR";
  message: string;
};
