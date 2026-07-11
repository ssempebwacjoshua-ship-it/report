import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { v2 as cloudinary } from "cloudinary";
import sharp from "sharp";

const ALLOWED_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);
const LOCAL_UPLOAD_ROOT = path.join(process.cwd(), "public", "uploads");
const LOCAL_PRIVATE_UPLOAD_ROOT = path.join(process.cwd(), "private-uploads");
const CLOUDINARY_PROVIDER = "cloudinary";
let cloudinaryConfigured = false;
let configuredCloudinaryKey: string | null = null;

export type StoredUpload = {
  publicUrl: string;
  relativePath: string;
  absolutePath: string;
  mimeType: string;
  sizeBytes: number;
};

function uploadError(message: string, status: number, details?: unknown) {
  return Object.assign(new Error(message), { status, expose: true, details });
}

function hasCloudinaryCredentials(): boolean {
  const cloudinaryUrl = getCloudinaryUrlEnv();
  return Boolean(
    cloudinaryUrl ||
      (getCloudinaryCloudNameEnv() &&
        process.env.CLOUDINARY_API_KEY?.trim() &&
        process.env.CLOUDINARY_API_SECRET?.trim()),
  );
}

function getUploadProvider(): string {
  const configured = process.env.UPLOAD_STORAGE_PROVIDER?.trim().toLowerCase();
  if (configured) return configured;
  return hasCloudinaryCredentials() ? CLOUDINARY_PROVIDER : "local";
}

export function getUploadStorageDiagnostics() {
  const cloudName = getCloudinaryCloudNameEnv();
  return {
    provider: getUploadProvider(),
    hasCloudinaryCloudName: Boolean(cloudName),
    hasCloudinaryApiKey: Boolean(process.env.CLOUDINARY_API_KEY?.trim()),
    hasCloudinaryApiSecret: Boolean(process.env.CLOUDINARY_API_SECRET?.trim()),
    hasCloudinaryUrl: Boolean(getCloudinaryUrlEnv()),
    uploadFolder: getCloudinaryUploadFolder(),
    cloudName: cloudName ?? null,
  };
}

function getCloudinaryCloudNameEnv(): string | null {
  return process.env.CLOUDINARY_CLOUD_NAME?.trim() || process.env.CLOUDINARY_NAME?.trim() || null;
}

function getCloudinaryUrlEnv(): string | null {
  return process.env.CLOUDINARY_URL?.trim() || process.env.CLOUDINARY_URI?.trim() || null;
}

function getCloudinaryUploadFolder(): string {
  return process.env.CLOUDINARY_UPLOAD_FOLDER?.trim() || "school-connect";
}

function getUploadBaseUrl(): string | null {
  const configured = process.env.UPLOAD_STORAGE_PUBLIC_BASE_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  return null;
}

function getLocalUploadRoot(strict: boolean): string | null {
  const configuredDir = process.env.UPLOAD_STORAGE_DIR?.trim();
  const configuredBaseUrl = process.env.UPLOAD_STORAGE_PUBLIC_BASE_URL?.trim();
  if (strict && process.env.NODE_ENV === "production" && !configuredDir && !configuredBaseUrl) {
    throw Object.assign(
      new Error("Upload storage is not configured for production. Set Cloudinary env vars or configure local upload storage."),
      { status: 503, expose: true },
    );
  }
  return configuredDir || LOCAL_UPLOAD_ROOT;
}

function getPrivateUploadRoot(strict: boolean): string {
  const configuredDir = process.env.PRIVATE_UPLOAD_STORAGE_DIR?.trim() || process.env.UPLOAD_STORAGE_DIR?.trim();
  if (strict && process.env.NODE_ENV === "production" && !configuredDir) {
    throw Object.assign(
      new Error("Passport photo storage is not configured. Set Cloudinary env vars."),
      { status: 503, expose: true },
    );
  }
  return configuredDir || LOCAL_PRIVATE_UPLOAD_ROOT;
}

function parseCloudinaryUrl(value: string): { cloudName: string; apiKey: string; apiSecret: string } | null {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "cloudinary:") return null;
    const apiKey = decodeURIComponent(parsed.username || "").trim();
    const apiSecret = decodeURIComponent(parsed.password || "").trim();
    const cloudName = decodeURIComponent(parsed.hostname || "").trim();
    if (!apiKey || !apiSecret || !cloudName) return null;
    return { cloudName, apiKey, apiSecret };
  } catch {
    return null;
  }
}

function ensureCloudinaryConfigured(): { uploadFolder: string } {
  const explicitCloudName = getCloudinaryCloudNameEnv();
  const explicitApiKey = process.env.CLOUDINARY_API_KEY?.trim();
  const explicitApiSecret = process.env.CLOUDINARY_API_SECRET?.trim();
  const cloudinaryUrl = getCloudinaryUrlEnv();
  const uploadFolder = getCloudinaryUploadFolder();

  const parsedUrl = cloudinaryUrl ? parseCloudinaryUrl(cloudinaryUrl) : null;
  const cloudName = explicitCloudName || parsedUrl?.cloudName;
  const apiKey = explicitApiKey || parsedUrl?.apiKey;
  const apiSecret = explicitApiSecret || parsedUrl?.apiSecret;

  if (!cloudName) {
    throw uploadError("Cloudinary cloud name is missing. Set CLOUDINARY_CLOUD_NAME.", 503);
  }
  if (!apiKey) {
    throw uploadError("Cloudinary API key is missing. Set CLOUDINARY_API_KEY.", 503);
  }
  if (!apiSecret) {
    throw uploadError("Cloudinary API secret is missing. Set CLOUDINARY_API_SECRET.", 503);
  }

  const configKey = `${cloudName}:${apiKey}`;
  if (!cloudinaryConfigured || configuredCloudinaryKey !== configKey) {
    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      secure: true,
    });
    cloudinaryConfigured = true;
    configuredCloudinaryKey = configKey;
  }

  return { uploadFolder };
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

function sanitizeUploadPathSegment(segment: string): string {
  return segment.trim().replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "upload";
}

function buildLocalUploadPaths(
  relativeDirParts: string[],
  fileName: string,
  privateAccess = false,
): { relativePath: string; absolutePath: string } {
  const safeParts = relativeDirParts.map((part) => sanitizeUploadPathSegment(part)).filter(Boolean);
  if (privateAccess) {
    return {
      relativePath: path.posix.join("/api/private-uploads", ...safeParts, fileName),
      absolutePath: path.join(getPrivateUploadRoot(true), ...safeParts, fileName),
    };
  }
  const relativeDir = path.posix.join("uploads", ...safeParts);
  return {
    relativePath: path.posix.join("/", relativeDir, fileName),
    absolutePath: path.join(getLocalUploadRoot(true) ?? LOCAL_UPLOAD_ROOT, ...safeParts, fileName),
  };
}

function buildCloudinaryPublicId(relativeDirParts: string[], fileName: string): string {
  const { uploadFolder } = ensureCloudinaryConfigured();
  const publicIdParts = [uploadFolder, ...relativeDirParts, fileName.replace(/\.webp$/i, "")]
    .map(sanitizeUploadPathSegment)
    .filter(Boolean);
  return publicIdParts.join("/");
}

async function uploadToCloudinary(buffer: Buffer, publicId: string): Promise<StoredUpload> {
  const processed = await processPassportImage(buffer);
  console.info("[passport-upload-storage]", {
    event: "cloudinary.upload.config",
    ...getUploadStorageDiagnostics(),
    publicId,
  });

  const uploaded = await new Promise<{
    secure_url?: string;
    public_id?: string;
    bytes?: number;
  }>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        public_id: publicId,
        resource_type: "image",
        format: "webp",
        overwrite: true,
        invalidate: true,
      },
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(result ?? {});
      },
    );
    stream.end(processed);
  }).catch((error) => {
    const details = getCloudinaryErrorDetails(error);
    console.error("[passport-upload-storage]", {
      event: "cloudinary.upload.error",
      publicId,
      ...details,
    });
    throw uploadError(`Cloudinary passport photo upload failed: ${details.message}`, 502, details);
  });

  if (!uploaded.secure_url) {
    throw Object.assign(new Error("Cloudinary upload did not return a secure URL."), { status: 502, expose: true });
  }

  return {
    publicUrl: uploaded.secure_url,
    relativePath: uploaded.public_id ?? publicId,
    absolutePath: uploaded.secure_url,
    mimeType: "image/webp",
    sizeBytes: uploaded.bytes ?? processed.length,
  };
}

function getCloudinaryErrorDetails(error: unknown): {
  message: string;
  http_code: unknown;
  name: unknown;
  code: unknown;
  nestedMessage: unknown;
  serialized: string | null;
} {
  const record = typeof error === "object" && error !== null ? error as Record<string, unknown> : null;
  const nested = record && typeof record.error === "object" && record.error !== null ? record.error as Record<string, unknown> : null;
  const message = firstNonEmptyString([
    error instanceof Error ? error.message : null,
    record?.message,
    nested?.message,
    typeof error === "string" ? error : null,
    safeStringify(error),
  ]) ?? "Unknown Cloudinary upload error";

  return {
    message,
    http_code: record?.http_code ?? null,
    name: error instanceof Error ? error.name : record?.name ?? null,
    code: record?.code ?? null,
    nestedMessage: nested?.message ?? null,
    serialized: safeStringify(error),
  };
}

function firstNonEmptyString(values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function safeStringify(value: unknown): string | null {
  if (value === undefined) return null;
  if (typeof value === "string") return value;
  try {
    const seen = new WeakSet<object>();
    return JSON.stringify(value, (_key, nested) => {
      if (typeof nested === "object" && nested !== null) {
        if (seen.has(nested)) return "[Circular]";
        seen.add(nested);
      }
      return nested;
    });
  } catch {
    try {
      return String(value);
    } catch {
      return null;
    }
  }
}

async function processPassportImage(buffer: Buffer): Promise<Buffer> {
  try {
    return await sharp(buffer)
      .rotate()
      .webp({ quality: 88 })
      .toBuffer();
  } catch {
    throw uploadError("Invalid image file. Please upload JPG, PNG, or WebP.", 400);
  }
}

export async function saveImageUpload(input: {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
  relativeDirParts: string[];
  prefix?: string;
  privateAccess?: boolean;
}): Promise<StoredUpload> {
  const mimeType = input.mimeType.toLowerCase().trim();
  if (!ALLOWED_IMAGE_MIME_TYPES.has(mimeType)) {
    throw uploadError("Unsupported image type. Use JPG, JPEG, PNG, or WEBP.", 400);
  }

  validateOriginalFileName(input.originalName);

  const fileName = `${input.prefix ?? "photo"}-${Date.now()}-${randomUUID()}.webp`;
  const provider = getUploadProvider();

  if (provider === CLOUDINARY_PROVIDER) {
    return uploadToCloudinary(input.buffer, buildCloudinaryPublicId(input.relativeDirParts, fileName));
  }

  const { relativePath, absolutePath } = buildLocalUploadPaths(input.relativeDirParts, fileName, input.privateAccess === true);
  const root = input.privateAccess === true
    ? getPrivateUploadRoot(true)
    : getLocalUploadRoot(true);
  if (!root) {
    throw Object.assign(new Error("Upload storage is not configured. Set UPLOAD_STORAGE_DIR or UPLOAD_STORAGE_PUBLIC_BASE_URL."), { status: 503, expose: true });
  }

  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  const processed = await processPassportImage(input.buffer);
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
  try {
    return await saveImageUpload({
      buffer: input.buffer,
      originalName: input.originalName,
      mimeType: input.mimeType,
      relativeDirParts: ["students", input.schoolCode, input.studentId],
      prefix: input.prefix,
      privateAccess: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (
      typeof (error as { status?: unknown })?.status === "number" &&
      (error as { status: number }).status === 503 &&
      (message.includes("local upload storage") || message.includes("UPLOAD_STORAGE_DIR"))
    ) {
      throw Object.assign(
        new Error("Passport photo storage is not configured. Set Cloudinary env vars."),
        { status: 503, expose: true },
      );
    }
    throw error;
  }
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

  if (/^https?:\/\//i.test(normalized)) {
    try {
      const parsed = new URL(normalized);
      if (parsed.hostname.includes("cloudinary.com")) {
        const match = parsed.pathname.match(/\/upload\/(?:v\d+\/)?(.+)$/);
        if (!match?.[1]) return;
        const publicId = match[1].replace(/\.[^.\/]+$/, "");
        await cloudinary.uploader.destroy(publicId, { resource_type: "image", invalidate: true });
        return;
      }
    } catch {
      return;
    }
  }

  const root = getLocalUploadRoot(false);
  if (!root) return;

  let pathname = normalized;
  if (/^https?:\/\//i.test(normalized)) {
    try {
      pathname = new URL(normalized).pathname;
    } catch {
      return;
    }
  }
  if (pathname.startsWith("/api/private-uploads/")) {
    const privateRoot = process.env.PRIVATE_UPLOAD_STORAGE_DIR?.trim() || LOCAL_PRIVATE_UPLOAD_ROOT;
    const absolutePath = path.join(privateRoot, pathname.replace(/^\/api\/private-uploads\//, ""));
    if (!absolutePath.startsWith(privateRoot)) return;
    await fs.rm(absolutePath, { force: true });
    return;
  }
  if (!pathname.startsWith("/uploads/")) return;
  const absolutePath = path.join(root, pathname.replace(/^\/uploads\//, "uploads/"));
  await fs.rm(absolutePath, { force: true });
}

export function resolvePrivateStudentUploadPath(input: {
  schoolCode: string;
  studentId: string;
  fileName: string;
}): string | null {
  const privateRoot = process.env.PRIVATE_UPLOAD_STORAGE_DIR?.trim() || LOCAL_PRIVATE_UPLOAD_ROOT;
  const fileName = path.basename(input.fileName);
  if (fileName !== input.fileName || !/^[A-Za-z0-9._-]+$/.test(fileName)) return null;
  const absolutePath = path.join(
    privateRoot,
    "students",
    sanitizeUploadPathSegment(input.schoolCode),
    sanitizeUploadPathSegment(input.studentId),
    fileName,
  );
  return absolutePath.startsWith(privateRoot) ? absolutePath : null;
}
