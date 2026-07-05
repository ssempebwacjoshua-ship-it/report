import type { Response } from "express";

type UploadLike = Pick<Express.Multer.File, "buffer" | "originalname" | "mimetype" | "size">;

export type UploadValidationError = Error & {
  status: number;
  code: string;
  expose: true;
};

export function createUploadValidationError(code: string, message: string, status = 400): UploadValidationError {
  return Object.assign(new Error(message), {
    status,
    code,
    expose: true as const,
  });
}

export function isUploadValidationError(error: unknown): error is UploadValidationError {
  return Boolean(
    error &&
    typeof error === "object" &&
    typeof (error as { status?: unknown }).status === "number" &&
    typeof (error as { code?: unknown }).code === "string" &&
    (error as { expose?: unknown }).expose === true,
  );
}

export function toUploadValidationResponse(error: unknown) {
  if (!isUploadValidationError(error)) return null;
  return {
    status: error.status,
    body: {
      error: true as const,
      code: error.code,
      message: error.message,
      details: [] as string[],
    },
  };
}

export function ensureNonEmptyUpload(file: UploadLike | undefined, subject: string) {
  if (!file || file.size === 0 || file.buffer.length === 0) {
    throw createUploadValidationError("EMPTY_UPLOAD", `${subject} is empty. Upload a non-empty file.`);
  }
}

function fileExtension(file: UploadLike) {
  const parts = file.originalname.split(".");
  return (parts.length > 1 ? parts.pop() : "")?.trim().toLowerCase() ?? "";
}

function bufferLooksLikeZip(buffer: Buffer) {
  return buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b;
}

function bufferLooksLikePdf(buffer: Buffer) {
  return buffer.length >= 4 && buffer.subarray(0, 4).toString("ascii") === "%PDF";
}

export function validateStudentImportUpload(file: UploadLike | undefined) {
  ensureNonEmptyUpload(file, "The student import file");
  const ext = fileExtension(file!);
  const mime = file!.mimetype.toLowerCase().trim();

  const csvMimeTypes = new Set(["text/csv", "application/csv", "text/plain", "application/vnd.ms-excel"]);
  const xlsxMimeTypes = new Set([
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/octet-stream",
  ]);

  if (ext === "csv" || csvMimeTypes.has(mime)) {
    return { kind: "csv" as const };
  }

  if (ext === "xlsx" || xlsxMimeTypes.has(mime)) {
    if (!bufferLooksLikeZip(file!.buffer)) {
      throw createUploadValidationError("INVALID_FILE_TYPE", "The upload does not look like a valid XLSX file. Please upload a real .xlsx file.");
    }
    return { kind: "xlsx" as const };
  }

  throw createUploadValidationError("INVALID_FILE_TYPE", "Unsupported file type. Upload a CSV or XLSX file.");
}

export function validateScanUpload(file: UploadLike | undefined) {
  ensureNonEmptyUpload(file, "The scan file");
  const ext = fileExtension(file!);
  const mime = file!.mimetype.toLowerCase().trim();
  const allowedImageExts = new Set(["png", "jpg", "jpeg", "webp"]);
  const allowedImageMimes = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp"]);

  if (ext === "pdf" || mime === "application/pdf") {
    if (!bufferLooksLikePdf(file!.buffer)) {
      throw createUploadValidationError("INVALID_FILE_TYPE", "The upload does not look like a valid PDF file. Please upload a real PDF.");
    }
    return { kind: "pdf" as const };
  }

  if (allowedImageExts.has(ext) || allowedImageMimes.has(mime)) {
    return { kind: "image" as const };
  }

  throw createUploadValidationError("INVALID_FILE_TYPE", "Unsupported file type. Upload a PNG, JPG, JPEG, WEBP, or PDF scan.");
}

export function sendUploadValidationError(res: Response, error: unknown): boolean {
  const response = toUploadValidationResponse(error);
  if (!response) return false;
  res.status(response.status).json(response.body);
  return true;
}
