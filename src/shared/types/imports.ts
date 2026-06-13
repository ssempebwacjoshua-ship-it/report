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

export type GeometryDebugInfo = {
  imageWidth: number;
  imageHeight: number;
  detectionMethod: "detected" | "fallback";
  geometryConfidence: number;
  tableRect: { left: number; right: number; top: number; bottom: number };
  writtenMarkCol: { x: number; w: number };
  splitMarkCol: { x: number; w: number };
  dataRowCount: number;
  writtenCropRect: { x: number; y: number; w: number; h: number };
  cropRejectionReason?: string;
  warnings: string[];
};

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
  ocrProvider?: string;
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
  geometryDebug?: GeometryDebugInfo;
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
  recognizedMarksheetId?: string;
  normalizedMarksheetId?: string;
  rawRecognizedId?: string | null;
  normalizedRecognizedId?: string;
  matchedMarksheetId?: string;
  matchConfidence?: number;
  matchSource?: MarksheetIdMatchSource;
  marksheetIdDebug?: MarksheetIdDebug;
  selectedMarksheetId?: string;
  resolvedContext?: ScanMarksheetContext | null;
  contextSource?: ScanContextSource;
  contextWarning?: string;
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
  scanBatchId?: string;
  parseStatus: ScanParseStatus;
  message: string;
  rows: ScanImportRow[];
  recognizedMarksheetId?: string;
  normalizedMarksheetId?: string;
  rawRecognizedId?: string | null;
  normalizedRecognizedId?: string;
  matchedMarksheetId?: string;
  matchConfidence?: number;
  matchSource?: MarksheetIdMatchSource;
  marksheetIdDebug?: MarksheetIdDebug;
  selectedMarksheetId?: string;
  resolvedContext?: ScanMarksheetContext | null;
  contextSource?: ScanContextSource;
  contextWarning?: string;
  configuredProvider?: string;
  activeProvider?: string;
  providerReachable?: boolean;
  fallbackReason?: string;
};

export type ScanBatchReloadResponse = {
  batchId: string;
  scanBatchId?: string;
  parseStatus: ScanParseStatus;
  message: string;
  rows: ScanImportRow[];
  context: ScanMarksheetContext | null;
  recognizedMarksheetId?: string;
  normalizedMarksheetId?: string;
  rawRecognizedId?: string | null;
  normalizedRecognizedId?: string;
  matchedMarksheetId?: string;
  matchConfidence?: number;
  matchSource?: MarksheetIdMatchSource;
  marksheetIdDebug?: MarksheetIdDebug;
  selectedMarksheetId?: string;
  resolvedContext?: ScanMarksheetContext | null;
  contextSource?: ScanContextSource;
  contextWarning?: string;
  fileName: string;
  configuredProvider?: string;
  activeProvider?: string;
  providerReachable?: boolean;
  fallbackReason?: string;
  createdAt: string;
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

export type ScanContextSource =
  | "recognized-id"
  | "selected-context"
  | "manual-required";

export type MarksheetIdMatchSource =
  | "header"
  | "footer"
  | "selected-fallback"
  | "manual-required";

export type MarksheetIdCandidate = {
  source: "header" | "footer";
  rawRecognizedId: string;
  normalizedRecognizedId: string;
  confidence: number;
  method?: "qr" | "ocr";
};

export type MarksheetIdDebug = {
  headerCropPath?: string;
  footerCropPath?: string;
  debugJsonPath?: string;
  rawHeaderText?: string;
  rawFooterText?: string;
  normalizedCandidates?: string[];
  selectedCandidate?: MarksheetIdCandidate | null;
  failureReason?: string;
};

export type ScanRowsCommitResponse = Omit<ScanRowsValidationResponse, "status"> & {
  status: "COMMITTED" | "FAILED";
  committedRows: number;
  skippedRows: number;
  message: string;
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
  recognizedMarksheetId?: string | null;
  normalizedMarksheetId?: string;
  rawRecognizedId?: string | null;
  normalizedRecognizedId?: string;
  matchedMarksheetId?: string;
  matchConfidence?: number;
  matchSource?: MarksheetIdMatchSource;
  marksheetIdDebug?: MarksheetIdDebug;
  selectedMarksheetId?: string;
  resolvedContext?: ScanMarksheetContext | null;
  contextSource?: ScanContextSource;
  contextWarning?: string;
};

// ── Structured import error shape ─────────────────────────────────────────────

export type ImportErrorCode =
  | "MISSING_FILE"
  | "UNSUPPORTED_FILE_TYPE"
  | "SCHOOL_NOT_FOUND"
  | "CONTEXT_REQUIRED"
  | "DRY_RUN_REQUIRED"
  | "NO_VALID_ROWS"
  | "MISSING_MARKSHEET_ID"
  | "SCAN_SETUP_REQUIRED"
  | "TEMPLATE_ERROR"
  | "IMPORT_VALIDATION_FAILED"
  | "SERVER_ERROR";

export type ImportErrorResponse = {
  error: true;
  code: ImportErrorCode;
  message: string;
  details: string[];
};
