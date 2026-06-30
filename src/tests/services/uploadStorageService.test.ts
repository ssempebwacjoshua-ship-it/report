import { afterEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const ENV_KEYS = [
  "NODE_ENV",
  "UPLOAD_STORAGE_PROVIDER",
  "UPLOAD_STORAGE_DIR",
  "UPLOAD_STORAGE_PUBLIC_BASE_URL",
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
  "CLOUDINARY_URL",
] as const;

const originalEnv = new Map<string, string | undefined>();
for (const key of ENV_KEYS) originalEnv.set(key, process.env[key]);

function resetUploadEnv() {
  for (const key of ENV_KEYS) {
    const value = originalEnv.get(key);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

describe("uploadStorageService", () => {
  afterEach(() => {
    resetUploadEnv();
    vi.restoreAllMocks();
  });

  it("uses Cloudinary by default when Cloudinary env vars are present", async () => {
    delete process.env.UPLOAD_STORAGE_PROVIDER;
    process.env.CLOUDINARY_CLOUD_NAME = "demo";
    process.env.CLOUDINARY_API_KEY = "api-key";
    process.env.CLOUDINARY_API_SECRET = "api-secret";

    const { getUploadStorageDiagnostics } = await import("../../server/services/uploadStorageService");

    expect(getUploadStorageDiagnostics()).toMatchObject({
      provider: "cloudinary",
      hasCloudinaryCloudName: true,
      hasCloudinaryApiKey: true,
      hasCloudinaryApiSecret: true,
    });
  }, 15000);

  it("returns a clear passport photo 503 when production local storage is not configured", async () => {
    process.env.NODE_ENV = "production";
    process.env.UPLOAD_STORAGE_PROVIDER = "local";
    delete process.env.UPLOAD_STORAGE_DIR;
    delete process.env.UPLOAD_STORAGE_PUBLIC_BASE_URL;
    delete process.env.CLOUDINARY_CLOUD_NAME;
    delete process.env.CLOUDINARY_API_KEY;
    delete process.env.CLOUDINARY_API_SECRET;
    delete process.env.CLOUDINARY_URL;

    const { saveStudentImageUpload } = await import("../../server/services/uploadStorageService");

    await expect(saveStudentImageUpload({
      buffer: Buffer.from("photo-bytes"),
      originalName: "passport.jpg",
      mimeType: "image/jpeg",
      schoolCode: "SCU-PREVIEW",
      studentId: "student-1",
      prefix: "passport",
    })).rejects.toMatchObject({
      status: 503,
      message: "Passport photo storage is not configured. Set Cloudinary env vars.",
    });
  });

  it("returns 400 for an invalid image buffer instead of leaking a sharp 500", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "passport-upload-"));
    process.env.NODE_ENV = "production";
    process.env.UPLOAD_STORAGE_PROVIDER = "local";
    process.env.UPLOAD_STORAGE_DIR = tempDir;
    delete process.env.UPLOAD_STORAGE_PUBLIC_BASE_URL;

    const { saveStudentImageUpload } = await import("../../server/services/uploadStorageService");

    await expect(saveStudentImageUpload({
      buffer: Buffer.from("not-a-real-image"),
      originalName: "passport.jpg",
      mimeType: "image/jpeg",
      schoolCode: "SCU-PREVIEW",
      studentId: "student-1",
      prefix: "passport",
    })).rejects.toMatchObject({
      status: 400,
      message: "Invalid image file. Please upload JPG, PNG, or WebP.",
    });

    await fs.rm(tempDir, { recursive: true, force: true });
  });
});
