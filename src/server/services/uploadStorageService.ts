import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import sharp from "sharp";

const ALLOWED_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);
const LOCAL_UPLOAD_ROOT = path.join(process.cwd(), "public", "uploads");

export type StoredUpload = {
  publicUrl: string;
  relativePath: string;
  absolutePath: string;
  mimeType: string;
  sizeBytes: number;
};

function getUploadBaseUrl(): string | null {
  const configured = process.env.UPLOAD_STORAGE_PUBLIC_BASE_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  return null;
}

function getUploadRoot(): string {
  const configuredDir = process.env.UPLOAD_STORAGE_DIR?.trim();
  const configuredBaseUrl = process.env.UPLOAD_STORAGE_PUBLIC_BASE_URL?.trim();
  if (process.env.NODE_ENV === "production" && !configuredDir && !configuredBaseUrl) {
    throw Object.assign(new Error("Upload storage is not configured for production. Set UPLOAD_STORAGE_DIR or UPLOAD_STORAGE_PUBLIC_BASE_URL."), { status: 503 });
  }
  return configuredDir || LOCAL_UPLOAD_ROOT;
}

function buildPublicUrl(relativePath: string): string {
  const baseUrl = getUploadBaseUrl();
  if (baseUrl) {
    return new URL(relativePath.replace(/^\//, ""), `${baseUrl}/`).toString();
  }
  return relativePath;
}

function validateOriginalFileName(originalName: string): string {
  const trimmed = originalName.trim();
  if (!trimmed) throw Object.assign(new Error("File name is required."), { status: 400 });
  if (trimmed !== path.basename(trimmed)) {
    throw Object.assign(new Error("Unsafe file name rejected."), { status: 400 });
  }
  if (!/^[A-Za-z0-9._ -]+$/.test(trimmed)) {
    throw Object.assign(new Error("Unsafe file name rejected."), { status: 400 });
  }
  return trimmed;
}

export async function saveImageUpload(input: {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
  relativeDirParts: string[];
  prefix?: string;
}): Promise<StoredUpload> {
  const mimeType = input.mimeType.toLowerCase().trim();
  if (!ALLOWED_IMAGE_MIME_TYPES.has(mimeType)) {
    throw Object.assign(new Error("Unsupported image type. Use JPG, JPEG, PNG, or WEBP."), { status: 400 });
  }

  validateOriginalFileName(input.originalName);

  const root = getUploadRoot();
  if (!root) {
    throw Object.assign(new Error("Upload storage is not configured. Set UPLOAD_STORAGE_DIR or UPLOAD_STORAGE_PUBLIC_BASE_URL."), { status: 503 });
  }

  const relativeDir = path.posix.join("uploads", ...input.relativeDirParts.map((part) => part.trim()).filter(Boolean));
  const fileName = `${input.prefix ?? "photo"}-${Date.now()}-${randomUUID()}.webp`;
  const relativePath = path.posix.join("/", relativeDir, fileName);
  const absolutePath = path.join(root, ...input.relativeDirParts, fileName);

  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  const processed = await sharp(input.buffer)
    .rotate()
    .webp({ quality: 88 })
    .toBuffer();
  await fs.writeFile(absolutePath, processed);

  return {
    publicUrl: buildPublicUrl(relativePath),
    relativePath,
    absolutePath,
    mimeType: "image/webp",
    sizeBytes: processed.length,
  };
}

export async function saveStudentImageUpload(input: {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
  schoolCode: string;
  studentId: string;
  prefix?: string;
}): Promise<StoredUpload> {
  return saveImageUpload({
    buffer: input.buffer,
    originalName: input.originalName,
    mimeType: input.mimeType,
    relativeDirParts: ["students", input.schoolCode, input.studentId],
    prefix: input.prefix,
  });
}

export async function saveSchoolAssetUpload(input: {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
  schoolCode: string;
  assetType: "logo" | "stamp" | "signature";
}): Promise<StoredUpload> {
  return saveImageUpload({
    buffer: input.buffer,
    originalName: input.originalName,
    mimeType: input.mimeType,
    relativeDirParts: ["schools", input.schoolCode, input.assetType],
    prefix: input.assetType,
  });
}

export async function deleteStoredUpload(publicUrl: string | null | undefined): Promise<void> {
  if (!publicUrl) return;
  const normalized = publicUrl.trim();
  if (!normalized) return;
  const root = getUploadRoot();
  if (!root) return;

  let pathname = normalized;
  if (/^https?:\/\//i.test(normalized)) {
    try {
      pathname = new URL(normalized).pathname;
    } catch {
      return;
    }
  }
  if (!pathname.startsWith("/uploads/")) return;
  const absolutePath = path.join(root, pathname.replace(/^\/uploads\//, "uploads/"));
  await fs.rm(absolutePath, { force: true });
}
