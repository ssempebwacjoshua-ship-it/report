export type DocCleanerFileType = "PNG" | "JPG" | "JPEG" | "WEBP" | "PDF";

export const DOC_CLEANER_FILE_TYPES = new Set<string>(["PNG", "JPG", "JPEG", "WEBP", "PDF"]);

export type DocumentType = "table" | "list" | "free-text";

export type DocumentRow = {
  cells: string[];
  confidence: number;
};

export type UncertainCell = {
  rowIndex: number;
  columnIndex: number;
  reason: string;
};

export type ExtractedDocument = {
  documentType: DocumentType;
  title: string;
  schoolName: string;
  academicYear: string;
  term: string;
  columns: string[];
  rows: DocumentRow[];
  uncertainCells: UncertainCell[];
};

export type DocumentUploadResponse = {
  draftId: string;
  document: ExtractedDocument;
  imagePreviewUrl: string;
};

export type DocumentPdfRequest = {
  document: ExtractedDocument;
  primaryColor?: string;
};

export type DocCleanerErrorCode =
  | "MISSING_FILE"
  | "UNSUPPORTED_FILE_TYPE"
  | "FILE_TOO_LARGE"
  | "EXTRACTION_FAILED"
  | "INVALID_DOCUMENT"
  | "PDF_GENERATION_FAILED";
