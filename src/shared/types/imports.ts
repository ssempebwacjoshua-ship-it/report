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
