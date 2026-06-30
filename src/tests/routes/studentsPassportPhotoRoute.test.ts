import express from "express";
import multer from "multer";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  prisma: {
    student: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
  saveStudentImageUpload: vi.fn(),
  deleteStoredUpload: vi.fn(),
}));

async function mountApp(options: { authenticated?: boolean; studentFound?: boolean; schoolCode?: string } = {}) {
  vi.doMock("../../server/db/prisma", () => ({ prisma: mocks.prisma }));
  vi.doMock("../../server/services/uploadStorageService", () => ({
    saveStudentImageUpload: mocks.saveStudentImageUpload,
    deleteStoredUpload: mocks.deleteStoredUpload,
    getUploadStorageDiagnostics: () => ({
      provider: "local",
      hasCloudinaryCloudName: false,
      hasCloudinaryApiKey: false,
      hasCloudinaryApiSecret: false,
      hasCloudinaryUrl: false,
    }),
  }));

  const { studentsRoutes } = await import("../../server/routes/studentsRoutes");
  const app = express();
  app.use(express.json());

  if (options.authenticated) {
    app.use((req: any, _res, next) => {
      req.user = {
        userId: "user-1",
        schoolId: "school-1",
        name: "Test Admin",
        email: "admin@schoolconnect.test",
        role: "ADMIN_OPERATOR",
        tokenVersion: 1,
      };
      req.school = { id: "school-1", code: options.schoolCode ?? "SCU-PREVIEW", name: "Preview School" };
      next();
    });
  }

  app.use(studentsRoutes());
  app.use((error: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (error instanceof multer.MulterError) {
      const message = error.code === "LIMIT_FILE_SIZE" && req.url.includes("/passport-photo")
        ? "File is too large. Please upload a smaller image (max 2 MB)."
        : `Upload failed: ${error.message}`;
      res.status(400).json({ error: message, message });
      return;
    }
    const status = typeof (error as { status?: unknown })?.status === "number" ? (error as { status: number }).status : 500;
    res.status(status).json({ error: error instanceof Error ? error.message : "Unexpected error" });
  });
  return app;
}

describe("students passport photo route auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prisma.student.findFirst.mockResolvedValue({
      id: "student-1",
      passportPhotoUrl: null,
      schoolId: "school-1",
    });
    mocks.prisma.student.update.mockResolvedValue({ id: "student-1" });
    mocks.saveStudentImageUpload.mockResolvedValue({
      publicUrl: "https://res.cloudinary.com/demo/image/upload/v1/school-connect/students/school-1/student-1/passport.webp",
      relativePath: "school-connect/students/school-1/student-1/passport",
      absolutePath: "https://res.cloudinary.com/demo/image/upload/v1/school-connect/students/school-1/student-1/passport.webp",
      mimeType: "image/webp",
      sizeBytes: 1234,
    });
    mocks.deleteStoredUpload.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.resetModules();
    vi.doUnmock("../../server/db/prisma");
    vi.doUnmock("../../server/services/uploadStorageService");
  });

  it("returns 200 for an authenticated upload and logs the request context", async () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const app = await mountApp({ authenticated: true });

    const res = await request(app)
      .post("/api/students/student-1/passport-photo")
      .set("Authorization", "Bearer fake-token")
      .attach("file", Buffer.from("photo-bytes"), { filename: "passport.jpg", contentType: "image/jpeg" });

    expect(res.status).toBe(200);
    expect(res.body.studentId).toBe("student-1");
    expect(res.body.passportPhotoUrl).toContain("cloudinary.com");
    expect(res.body.updatedAt).toEqual(expect.any(String));
    expect(mocks.saveStudentImageUpload).toHaveBeenCalledTimes(1);
    expect(mocks.deleteStoredUpload).toHaveBeenCalledWith(null);
    expect(infoSpy).toHaveBeenCalledWith(
      "[student-passport-photo]",
      expect.objectContaining({
        event: "upload.start",
        hasUser: true,
        hasSchool: true,
        route: "/api/students/student-1/passport-photo",
      }),
    );
    infoSpy.mockRestore();
  });

  it("returns 401 when the request is unauthenticated", async () => {
    const app = await mountApp({ authenticated: false });

    const res = await request(app)
      .post("/api/students/student-1/passport-photo")
      .attach("file", Buffer.from("photo-bytes"), { filename: "passport.jpg", contentType: "image/jpeg" });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("School context required.");
    expect(mocks.saveStudentImageUpload).not.toHaveBeenCalled();
  });

  it("returns 404 for a student outside the current school", async () => {
    mocks.prisma.student.findFirst.mockResolvedValueOnce(null);
    const app = await mountApp({ authenticated: true, schoolCode: "SCU-OTHER" });

    const res = await request(app)
      .post("/api/students/student-1/passport-photo")
      .set("Authorization", "Bearer fake-token")
      .attach("file", Buffer.from("photo-bytes"), { filename: "passport.jpg", contentType: "image/jpeg" });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Student not found.");
  });

  it("returns 400 for unsupported image types", async () => {
    mocks.saveStudentImageUpload.mockRejectedValueOnce(Object.assign(new Error("Unsupported image type. Use JPG, JPEG, PNG, or WEBP."), { status: 400 }));
    const app = await mountApp({ authenticated: true });

    const res = await request(app)
      .post("/api/students/student-1/passport-photo")
      .set("Authorization", "Bearer fake-token")
      .attach("file", Buffer.from("not-an-image"), { filename: "passport.gif", contentType: "image/gif" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/unsupported image type/i);
  });

  it("returns 400 for files bigger than 2 MB", async () => {
    const app = await mountApp({ authenticated: true });

    const res = await request(app)
      .post("/api/students/student-1/passport-photo")
      .set("Authorization", "Bearer fake-token")
      .attach("file", Buffer.alloc(2 * 1024 * 1024 + 1), { filename: "passport.jpg", contentType: "image/jpeg" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/max 2 mb/i);
    expect(mocks.saveStudentImageUpload).not.toHaveBeenCalled();
  });

  it("returns clear 503 and logs diagnostics when storage is not configured", async () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    mocks.saveStudentImageUpload.mockRejectedValueOnce(Object.assign(new Error("Passport photo storage is not configured. Set Cloudinary env vars."), { status: 503 }));
    const app = await mountApp({ authenticated: true });

    const res = await request(app)
      .post("/api/students/student-1/passport-photo")
      .set("Authorization", "Bearer fake-token")
      .attach("file", Buffer.from("photo-bytes"), { filename: "passport.jpg", contentType: "image/jpeg" });

    expect(res.status).toBe(503);
    expect(res.body.error).toBe("Passport photo storage is not configured. Set Cloudinary env vars.");
    expect(infoSpy).toHaveBeenCalledWith(
      "[student-passport-photo]",
      expect.objectContaining({
        event: "upload.error",
        provider: "local",
        hasCloudinaryCloudName: false,
        hasCloudinaryApiKey: false,
        hasCloudinaryApiSecret: false,
        fileMimeType: "image/jpeg",
        fileSize: expect.any(Number),
      }),
    );
    infoSpy.mockRestore();
  });
});
