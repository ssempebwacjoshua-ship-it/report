import { afterEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";

const cloudinaryMocks = vi.hoisted(() => ({
  config: vi.fn(),
  uploadStream: vi.fn(),
  destroy: vi.fn(),
}));

vi.mock("cloudinary", () => ({
  v2: {
    config: cloudinaryMocks.config,
    uploader: {
      upload_stream: cloudinaryMocks.uploadStream,
      destroy: cloudinaryMocks.destroy,
    },
  },
}));

const ENV_KEYS = [
  "NODE_ENV",
  "UPLOAD_STORAGE_PROVIDER",
  "UPLOAD_STORAGE_DIR",
  "UPLOAD_STORAGE_PUBLIC_BASE_URL",
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
  "CLOUDINARY_URL",
  "CLOUDINARY_URI",
  "CLOUDINARY_UPLOAD_FOLDER",
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
    cloudinaryMocks.config.mockReset();
    cloudinaryMocks.uploadStream.mockReset();
    cloudinaryMocks.destroy.mockReset();
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
      cloudName: "demo",
    });
  }, 15000);

  it("recognizes Cloudinary fallback env names", async () => {
    delete process.env.UPLOAD_STORAGE_PROVIDER;
    delete process.env.CLOUDINARY_CLOUD_NAME;
    delete process.env.CLOUDINARY_URL;
    process.env.CLOUDINARY_NAME = "fallback-demo";
    process.env.CLOUDINARY_API_KEY = "api-key";
    process.env.CLOUDINARY_API_SECRET = "api-secret";
    process.env.CLOUDINARY_URI = "cloudinary://uri-key:uri-secret@uri-demo";

    const { getUploadStorageDiagnostics } = await import("../../server/services/uploadStorageService");

    expect(getUploadStorageDiagnostics()).toMatchObject({
      provider: "cloudinary",
      hasCloudinaryCloudName: true,
      hasCloudinaryUrl: true,
      cloudName: "fallback-demo",
    });
  });

  it("returns a clear Cloudinary cloud-name error before upload", async () => {
    process.env.UPLOAD_STORAGE_PROVIDER = "cloudinary";
    delete process.env.CLOUDINARY_CLOUD_NAME;
    delete process.env.CLOUDINARY_NAME;
    delete process.env.CLOUDINARY_URL;
    delete process.env.CLOUDINARY_URI;
    process.env.CLOUDINARY_API_KEY = "api-key";
    process.env.CLOUDINARY_API_SECRET = "api-secret";

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
      message: "Cloudinary cloud name is missing. Set CLOUDINARY_CLOUD_NAME.",
    });
    expect(cloudinaryMocks.uploadStream).not.toHaveBeenCalled();
  });

  it("surfaces structured Cloudinary upload errors instead of object placeholders", async () => {
    const consoleInfo = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    process.env.UPLOAD_STORAGE_PROVIDER = "cloudinary";
    process.env.CLOUDINARY_CLOUD_NAME = "demo";
    process.env.CLOUDINARY_API_KEY = "api-key";
    process.env.CLOUDINARY_API_SECRET = "api-secret";
    process.env.CLOUDINARY_UPLOAD_FOLDER = "school-connect";
    cloudinaryMocks.uploadStream.mockImplementation((_options: unknown, callback: (error: unknown, result?: unknown) => void) => ({
      end: () => callback({
        message: "Invalid Signature abc123",
        http_code: 401,
        name: "Error",
        code: "InvalidSignature",
        error: { message: "Signature mismatch" },
      }),
    }));

    const { saveStudentImageUpload } = await import("../../server/services/uploadStorageService");
    const png = await sharp({
      create: {
        width: 1,
        height: 1,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      },
    }).png().toBuffer();

    await expect(saveStudentImageUpload({
      buffer: png,
      originalName: "passport.png",
      mimeType: "image/png",
      schoolCode: "SCU-PREVIEW",
      studentId: "student-1",
      prefix: "passport",
    })).rejects.toMatchObject({
      status: 502,
      message: "Cloudinary passport photo upload failed: Invalid Signature abc123",
    });

    expect(consoleInfo).toHaveBeenCalledWith("[passport-upload-storage]", expect.objectContaining({
      event: "cloudinary.upload.config",
      hasCloudinaryCloudName: true,
      hasCloudinaryApiKey: true,
      hasCloudinaryApiSecret: true,
      uploadFolder: "school-connect",
      cloudName: "demo",
    }));
    expect(consoleError).toHaveBeenCalledWith("[passport-upload-storage]", expect.objectContaining({
      event: "cloudinary.upload.error",
      message: "Invalid Signature abc123",
      http_code: 401,
      name: "Error",
      code: "InvalidSignature",
      nestedMessage: "Signature mismatch",
      serialized: expect.stringContaining("InvalidSignature"),
    }));
  });

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
