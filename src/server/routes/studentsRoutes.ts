import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { prisma } from "../db/prisma";
import { requireSubscriptionEntitlement } from "../services/subscriptionEntitlementService";
import {
  createStudentRecord,
  deleteGuardianContact,
  getContactSummary,
  getEnrolledStudent,
  getStudentByAdmissionNumber,
  listEnrolledStudents,
  upsertGuardianContact,
} from "../repositories/studentRepository";
import { getReportContext } from "../repositories/schoolRepository";
import { commitStudentImport, createStudentImportJob, getStudentImportJob, parseStudentsCsv, parseStudentsXlsx, previewStudentImport } from "../services/studentImportService";
import { generateAdmissionNumber } from "../services/studentAdmissionNumberService";
import { deleteStoredUpload, getUploadStorageDiagnostics, resolvePrivateStudentUploadPath, saveStudentImageUpload } from "../services/uploadStorageService";
import { ensureNonEmptyUpload, isUploadValidationError, sendUploadValidationError, validateStudentImportUpload } from "../utils/uploadSafety";
import { escapeSpreadsheetRow, sanitizeSpreadsheetDisplayValue } from "../utils/spreadsheetSafety";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1 } });
const studentPhotoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
});

const studentCreateSchema = z.object({
  fullName: z.string().trim().min(1, "Full name is required."),
  admissionNumber: z.string().trim().optional().or(z.literal("")),
  gender: z.string().trim().optional().or(z.literal("")),
  classId: z.string().min(1),
  streamId: z.string().min(1),
  isActive: z.boolean().default(true),
  guardianName: z.string().trim().optional().or(z.literal("")),
  guardianPhone: z.string().trim().optional().or(z.literal("")),
  guardianEmail: z.string().trim().email("Enter a valid email address.").optional().or(z.literal("")),
  notes: z.string().trim().optional().or(z.literal("")),
});

function updatedByFromRequest(req: { header: (name: string) => string | undefined; user?: { name?: string; email?: string } }) {
  return req.user?.name ?? req.user?.email ?? req.header("x-user-name") ?? req.header("x-user-email") ?? null;
}

function splitName(fullName: string) {
  const parts = fullName.trim().split(/\s+/);
  return { firstName: parts[0] ?? "", lastName: parts.slice(1).join(" ") };
}

function admissionModeFromQuery(value: unknown) {
  const normalized = String(value ?? "").trim().toLowerCase().replace(/[_\s]+/g, "-");
  return normalized === "create-and-update-existing" || normalized === "update" || normalized === "create-and-update"
    ? "CREATE_AND_UPDATE_EXISTING"
    : "CREATE_ONLY";
}

function parseUploadedStudentRows(file: Express.Multer.File) {
  try {
    const uploadType = validateStudentImportUpload(file);
    return uploadType.kind === "xlsx"
      ? parseStudentsXlsx(file.buffer)
      : parseStudentsCsv(file.buffer.toString("utf8"));
  } catch (error) {
    if (isUploadValidationError(error)) {
      throw error;
    }
    const message = error instanceof Error ? error.message : "Could not parse import file.";
    throw Object.assign(new Error(`Could not parse import file. Check the headers and CSV/XLSX formatting. ${message}`), { status: 400 });
  }
}

function logStudentImport(req: { method: string; url: string; school?: { id: string; code: string } | null; headers: Record<string, unknown> }, event: string, details: Record<string, unknown> = {}) {
  const requestId = typeof req.headers["x-request-id"] === "string" ? req.headers["x-request-id"] : undefined;
  console.info("[student-import]", {
    event,
    requestId,
    route: `${req.method} ${req.url}`,
    schoolId: req.school?.id,
    schoolCode: req.school?.code,
    ...details,
  });
}

function logStudentPassportPhoto(req: { method: string; originalUrl?: string; path?: string; headers: Record<string, unknown>; user?: { userId?: string; role?: string } | null; school?: { id: string; code: string } | null }, event: string, details: Record<string, unknown> = {}) {
  const requestId = typeof req.headers["x-request-id"] === "string" ? req.headers["x-request-id"] : undefined;
  console.info("[student-passport-photo]", {
    event,
    requestId,
    route: req.originalUrl ?? req.path ?? `${req.method} /api/students/:id/passport-photo`,
    hasUser: Boolean(req.user),
    hasSchool: Boolean(req.school),
    schoolId: req.school?.id ?? null,
    schoolCode: req.school?.code ?? null,
    ...details,
  });
}

export function studentsRoutes() {
  const router = Router();

  router.get("/api/private-uploads/students/:schoolCode/:studentId/:fileName", async (req, res, next) => {
    try {
      const { schoolCode, studentId, fileName } = req.params;
      if (schoolCode !== req.school!.code) {
        res.status(403).json({ error: "You do not have access to this file." });
        return;
      }
      const student = await prisma.student.findFirst({
        where: { id: studentId, schoolId: req.school!.id },
        select: { id: true },
      });
      if (!student) {
        res.status(404).json({ error: "File not found." });
        return;
      }
      const absolutePath = resolvePrivateStudentUploadPath({ schoolCode, studentId, fileName });
      if (!absolutePath) {
        res.status(400).json({ error: "Invalid file path." });
        return;
      }
      res.sendFile(absolutePath, (error) => {
        if (error && !res.headersSent) {
          res.status(404).json({ error: "File not found." });
        }
      });
    } catch (error) {
      next(error);
    }
  });

  // ── Student list ──────────────────────────────────────────────────────────────

  router.get("/api/students", async (req, res, next) => {
    try {
      if (!req.school) {
        res.status(401).json({ error: "School context required." });
        return;
      }
      const query = z.object({
        classId: z.string().optional(),
        streamId: z.string().optional(),
        search: z.string().optional(),
        isActive: z.string().optional(),
      }).parse(req.query);
      const students = await listEnrolledStudents(prisma, req.school.code, query);
      res.json({ students });
    } catch (error) {
      next(error);
    }
  });

  // Legacy list route kept for any server-to-server callers
  router.get("/internal/students", async (req, res, next) => {
    try {
      if (!req.school) {
        res.status(401).json({ error: "School context required." });
        return;
      }
      const query = z.object({ classId: z.string().optional(), streamId: z.string().optional(), search: z.string().optional(), isActive: z.string().optional() }).parse(req.query);
      const rows = await listEnrolledStudents(prisma, req.school.code, query);
      res.json({ students: rows });
    } catch (error) {
      next(error);
    }
  });

  // ── Student create / update ───────────────────────────────────────────────────

  router.post("/api/students", async (req, res, next) => {
    try {
      if (!req.school) {
        res.status(401).json({ error: "School context required." });
        return;
      }
      const schoolCode = req.school.code;
      const input = studentCreateSchema.parse(req.body);
      const [klass, stream] = await Promise.all([
        prisma.schoolClass.findFirst({
          where: { id: input.classId, schoolId: req.school.id },
          select: { name: true, code: true },
        }),
        prisma.stream.findFirst({
          where: { id: input.streamId, schoolId: req.school.id, classId: input.classId },
          select: { name: true, code: true },
        }),
      ]);
      if (!klass || !stream) {
        res.status(400).json({ error: "Selected class or stream was not found." });
        return;
      }
      const admissionNumber = input.admissionNumber?.trim() || await generateAdmissionNumber(prisma, schoolCode, klass.name, stream.name);
      const student = await createStudentRecord(prisma, schoolCode, {
        ...input,
        admissionNumber,
        schoolCode,
        guardianName: input.guardianName || "",
        guardianPhone: input.guardianPhone || "",
        guardianEmail: input.guardianEmail || "",
        notes: input.notes || "",
      }, updatedByFromRequest(req));
      res.status(201).json({ student, admissionNumber });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/api/students/:id", async (req, res, next) => {
    try {
      if (!req.school) {
        res.status(401).json({ error: "School context required." });
        return;
      }
      const schoolCode = req.school.code;
      const school = req.school;
      const input = studentCreateSchema.partial().parse(req.body);
      const current = await getEnrolledStudent(prisma, schoolCode, req.params.id);
      if (!current) {
        res.status(404).json({ error: "Student not found." });
        return;
      }
      const name = splitName(input.fullName ?? current.studentName);
      const updatedStudent = await prisma.student.updateMany({
        where: { id: current.id, schoolId: school.id },
        data: {
          admissionNumber: input.admissionNumber?.trim() || current.admissionNumber,
          firstName: name.firstName,
          lastName: name.lastName,
          isActive: input.isActive ?? current.isActive,
        },
      });
      if (!updatedStudent.count) {
        res.status(404).json({ error: "Student not found." });
        return;
      }
      if (input.classId || input.streamId) {
        await prisma.classEnrollment.updateMany({
          where: { studentId: current.id, academicYear: { schoolId: school.id }, term: { isActive: true }, isActive: true, status: "ACTIVE" },
          data: { classId: input.classId ?? undefined, streamId: input.streamId ?? undefined, isActive: input.isActive ?? current.isActive, status: (input.isActive ?? current.isActive) ? "ACTIVE" : "INACTIVE" },
        });
      }
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/students/:id/passport-photo", studentPhotoUpload.single("file"), async (req, res, next) => {
    try {
      logStudentPassportPhoto(req, "upload.start", {
        studentId: req.params.id,
        contentType: req.headers["content-type"] ?? null,
      });
      if (!req.school) {
        logStudentPassportPhoto(req, "upload.unauthenticated", { studentId: req.params.id });
        res.status(401).json({ error: "School context required." });
        return;
      }
      const student = await prisma.student.findFirst({
        where: { id: req.params.id, schoolId: req.school.id },
        select: { id: true, passportPhotoUrl: true, schoolId: true },
      });
      if (!student) {
        logStudentPassportPhoto(req, "upload.student-not-found", { studentId: req.params.id });
        res.status(404).json({ error: "Student not found." });
        return;
      }
      const file = req.file;
      if (!file) {
        logStudentPassportPhoto(req, "upload.missing-file", { studentId: req.params.id });
        res.status(400).json({ error: "Upload an image file." });
        return;
      }
      ensureNonEmptyUpload(file, "The passport photo file");
      const uploaded = await saveStudentImageUpload({
        buffer: file.buffer,
        originalName: file.originalname,
        mimeType: file.mimetype,
        schoolCode: req.school.code,
        studentId: student.id,
        prefix: "passport",
      });

      await prisma.student.update({
        where: { id: student.id },
        data: {
          passportPhotoUrl: uploaded.publicUrl,
          passportPhotoUpdatedAt: new Date(),
        },
      });
      await deleteStoredUpload(student.passportPhotoUrl);
      logStudentPassportPhoto(req, "upload.success", {
        studentId: req.params.id,
        uploadedUrl: uploaded.publicUrl,
      });
      const updatedAt = new Date().toISOString();
      res.status(200).json({
        studentId: student.id,
        passportPhotoUrl: uploaded.publicUrl,
        passportPhotoUpdatedAt: updatedAt,
        updatedAt,
      });
    } catch (error) {
      if (sendUploadValidationError(res, error)) {
        return;
      }
      logStudentPassportPhoto(req, "upload.error", {
        studentId: req.params.id,
        error: error instanceof Error ? error.message : String(error),
        ...getUploadStorageDiagnostics(),
        fileMimeType: req.file?.mimetype ?? null,
        fileSize: req.file?.size ?? null,
      });
      next(error);
    }
  });

  router.delete("/api/students/:id/passport-photo", async (req, res, next) => {
    try {
      if (!req.school) {
        res.status(401).json({ error: "School context required." });
        return;
      }
      const student = await prisma.student.findFirst({
        where: { id: req.params.id, schoolId: req.school.id },
        select: { id: true, passportPhotoUrl: true },
      });
      if (!student) {
        res.status(404).json({ error: "Student not found." });
        return;
      }
      await prisma.student.update({
        where: { id: student.id },
        data: { passportPhotoUrl: null, passportPhotoUpdatedAt: null },
      });
      await deleteStoredUpload(student.passportPhotoUrl);
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  // Import templates are public ? see studentsPublicRoutes() below

  // ── Import preview/commit ─────────────────────────────────────────────────────

  router.post("/api/students/import/preview", upload.single("file"), async (req, res, next) => {
    try {
      if (!req.school) {
        res.status(401).json({ error: "School context required." });
        return;
      }
      const schoolCode = req.school.code;
      const mode = admissionModeFromQuery(req.body.mode);
      const file = req.file;
      if (!file) {
        res.status(400).json({ error: "Upload a CSV or XLSX file." });
        return;
      }
      logStudentImport(req, "preview.hit", { fileName: file.originalname, mimeType: file.mimetype });
      const rows = parseUploadedStudentRows(file);
      const result = await previewStudentImport(prisma, schoolCode, rows, mode);
      logStudentImport(req, "preview.done", { parsedRows: rows.length, validRows: result.validRows, errorCount: result.invalidRows });
      res.json(sanitizeSpreadsheetDisplayValue(result));
    } catch (error) {
      if (sendUploadValidationError(res, error)) {
        return;
      }
      logStudentImport(req, "preview.error", { error: error instanceof Error ? error.message : String(error) });
      next(error);
    }
  });

  router.post("/api/students/import/commit", requireSubscriptionEntitlement("student.import.commit"), upload.single("file"), async (req, res, next) => {
    try {
      if (!req.school) {
        res.status(401).json({ error: "School context required." });
        return;
      }
      const schoolCode = req.school.code;
      const mode = admissionModeFromQuery(req.body.mode);
      const file = req.file;
      if (!file) {
        res.status(400).json({ error: "Upload a CSV or XLSX file." });
        return;
      }
      logStudentImport(req, "commit.hit", { fileName: file.originalname, mimeType: file.mimetype });
      const rows = parseUploadedStudentRows(file);
      if (rows.length > 500) {
        const job = await createStudentImportJob(prisma, schoolCode, rows, mode);
        logStudentImport(req, "commit.queued", { parsedRows: rows.length, jobId: job.jobId, validRows: job.validRows, errorCount: job.invalidRows });
        res.status(202).json(job);
        return;
      }
      const result = await commitStudentImport(prisma, schoolCode, rows, mode);
      logStudentImport(req, "commit.done", { parsedRows: rows.length, status: result.status, jobId: "jobId" in result ? result.jobId : undefined, validRows: result.validRows, errorCount: result.invalidRows });
      res.json(result);
    } catch (error) {
      if (sendUploadValidationError(res, error)) {
        return;
      }
      logStudentImport(req, "commit.error", { error: error instanceof Error ? error.message : String(error) });
      next(error);
    }
  });

  // ── Import jobs (browser-facing) ──────────────────────────────────────────────

  router.post("/api/students/import-jobs/upload", requireSubscriptionEntitlement("student.import.commit"), upload.single("file"), async (req, res, next) => {
    try {
      if (!req.school) {
        res.status(401).json({ error: "School context required." });
        return;
      }
      const schoolCode = req.school.code;
      const mode = admissionModeFromQuery(req.body.mode);
      const file = req.file;
      if (!file) {
        res.status(400).json({ error: "Upload a CSV or XLSX file." });
        return;
      }
      logStudentImport(req, "job-upload.hit", { fileName: file.originalname, mimeType: file.mimetype });
      const rows = parseUploadedStudentRows(file);
      const job = await createStudentImportJob(prisma, schoolCode, rows, mode);
      logStudentImport(req, "job-upload.queued", { parsedRows: rows.length, jobId: job.jobId, validRows: job.validRows, errorCount: job.invalidRows });
      res.status(202).json(job);
    } catch (error) {
      if (sendUploadValidationError(res, error)) {
        return;
      }
      logStudentImport(req, "job-upload.error", { error: error instanceof Error ? error.message : String(error) });
      next(error);
    }
  });

  router.get("/api/students/import-jobs/:jobId", async (req, res, next) => {
    try {
      if (!req.school) {
        res.status(401).json({ error: "School context required." });
        return;
      }
      const job = await getStudentImportJob(prisma, req.school.code, req.params.jobId);
      if (!job) {
        res.status(404).json({ error: "Import job not found." });
        return;
      }
      res.json(job);
    } catch (error) {
      next(error);
    }
  });

  // Legacy internal import-job routes (not called from browser)
  router.post("/internal/students/import-jobs/upload", requireSubscriptionEntitlement("student.import.commit"), upload.single("file"), async (req, res, next) => {
    try {
      if (!req.school) {
        res.status(401).json({ error: "School context required." });
        return;
      }
      const schoolCode = req.school.code;
      const mode = admissionModeFromQuery(req.body.mode);
      const file = req.file;
      if (!file) {
        res.status(400).json({ error: "Upload a CSV or XLSX file." });
        return;
      }
      logStudentImport(req, "internal-job-upload.hit", { fileName: file.originalname, mimeType: file.mimetype });
      const rows = parseUploadedStudentRows(file);
      const job = await createStudentImportJob(prisma, schoolCode, rows, mode);
      logStudentImport(req, "internal-job-upload.queued", { parsedRows: rows.length, jobId: job.jobId, validRows: job.validRows, errorCount: job.invalidRows });
      res.status(202).json(job);
    } catch (error) {
      if (sendUploadValidationError(res, error)) {
        return;
      }
      logStudentImport(req, "internal-job-upload.error", { error: error instanceof Error ? error.message : String(error) });
      next(error);
    }
  });

  router.get("/internal/students/import-jobs/:jobId", async (req, res, next) => {
    try {
      if (!req.school) {
        res.status(401).json({ error: "School context required." });
        return;
      }
      const job = await getStudentImportJob(prisma, req.school.code, req.params.jobId);
      if (!job) {
        res.status(404).json({ error: "Import job not found." });
        return;
      }
      res.json(job);
    } catch (error) {
      next(error);
    }
  });

  // ── Import history ────────────────────────────────────────────────────────────

  router.get("/api/students/import/history", async (req, res, next) => {
    try {
      if (!req.school) {
        res.status(401).json({ error: "School context required." });
        return;
      }
      const school = req.school;
      const batches = await prisma.markImportBatch.findMany({
        where: { schoolId: school.id, source: "student" },
        orderBy: { createdAt: "desc" },
        take: 50,
      });
      res.json({
        batches: batches.map((batch) => ({
          id: batch.id,
          status: batch.status,
          summary: batch.summary,
          createdAt: batch.createdAt.toISOString(),
          updatedAt: batch.updatedAt.toISOString(),
        })),
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/students/import/:id", async (req, res, next) => {
    try {
      if (!req.school) {
        res.status(401).json({ error: "School context required." });
        return;
      }
      const school = req.school;
      const batch = await prisma.markImportBatch.findFirst({
        where: { id: req.params.id, schoolId: school.id, source: "student" },
      });
      if (!batch) {
        res.status(404).json({ error: "Import batch not found." });
        return;
      }
      res.json({
        id: batch.id,
        status: batch.status,
        summary: batch.summary,
        createdAt: batch.createdAt.toISOString(),
        updatedAt: batch.updatedAt.toISOString(),
      });
    } catch (error) {
      next(error);
    }
  });

  // ── Contact summary (browser-facing) ─────────────────────────────────────────

  router.get("/api/students/contact-summary", async (req, res, next) => {
    try {
      if (!req.school) {
        res.status(401).json({ error: "School context required." });
        return;
      }
      res.json(await getContactSummary(prisma, req.school.code));
    } catch (error) {
      next(error);
    }
  });

  // Legacy internal contact-summary route
  router.get("/internal/students/contact-summary", async (req, res, next) => {
    try {
      if (!req.school) {
        res.status(401).json({ error: "School context required." });
        return;
      }
      res.json(await getContactSummary(prisma, req.school.code));
    } catch (error) {
      next(error);
    }
  });

  // ── Single student (internal use) ─────────────────────────────────────────────

  router.get("/internal/students/:id", async (req, res, next) => {
    try {
      if (!req.school) {
        res.status(401).json({ error: "School context required." });
        return;
      }
      const student = await getEnrolledStudent(prisma, req.school.code, req.params.id);
      if (!student) {
        res.status(404).json({ error: "No actively enrolled student was found." });
        return;
      }
      res.json(student);
    } catch (error) {
      next(error);
    }
  });

  // ── Guardian contacts (browser-facing) ───────────────────────────────────────

  router.post("/api/students/:id/contacts", async (req, res, next) => {
    try {
      if (!req.school) {
        res.status(401).json({ error: "School context required." });
        return;
      }
      const contact = await upsertGuardianContact(prisma, req.school.code, req.params.id, req.body);
      res.status(201).json(contact);
    } catch (error) {
      next(error);
    }
  });

  router.patch("/api/students/:id/contacts/:contactId", async (req, res, next) => {
    try {
      if (!req.school) {
        res.status(401).json({ error: "School context required." });
        return;
      }
      const contact = await upsertGuardianContact(prisma, req.school.code, req.params.id, req.body, req.params.contactId);
      res.json(contact);
    } catch (error) {
      next(error);
    }
  });

  router.delete("/api/students/:id/contacts/:contactId", async (req, res, next) => {
    try {
      if (!req.school) {
        res.status(401).json({ error: "School context required." });
        return;
      }
      await deleteGuardianContact(prisma, req.school.code, req.params.id, req.params.contactId);
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  // Legacy internal contact routes (not called from browser)
  router.post("/internal/students/:id/contacts", async (req, res, next) => {
    try {
      if (!req.school) {
        res.status(401).json({ error: "School context required." });
        return;
      }
      const contact = await upsertGuardianContact(prisma, req.school.code, req.params.id, req.body);
      res.status(201).json(contact);
    } catch (error) {
      next(error);
    }
  });

  router.patch("/internal/students/:id/contacts/:contactId", async (req, res, next) => {
    try {
      if (!req.school) {
        res.status(401).json({ error: "School context required." });
        return;
      }
      const contact = await upsertGuardianContact(prisma, req.school.code, req.params.id, req.body, req.params.contactId);
      res.json(contact);
    } catch (error) {
      next(error);
    }
  });

  router.delete("/internal/students/:id/contacts/:contactId", async (req, res, next) => {
    try {
      if (!req.school) {
        res.status(401).json({ error: "School context required." });
        return;
      }
      await deleteGuardianContact(prisma, req.school.code, req.params.id, req.params.contactId);
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  return router;
}

// Public ? no school context or auth required
export function studentsPublicRoutes() {
  const r = Router();

  r.get("/api/students/import/template.csv", (_req, res) => {
    res.type("text/csv").send("admissionNumber,fullName,gender,class,stream,guardianName,guardianPhone,guardianEmail,status\nSCU-001,Ada Lovelace,Female,Senior 1,A,Grace Hopper,+256 700 000000,grace@example.test,ACTIVE\n");
  });

  r.get("/api/students/import/template", (_req, res) => {
    res.type("text/csv").send("admissionNumber,fullName,gender,class,stream,guardianName,guardianPhone,guardianEmail,status\n");
  });

  r.get("/api/students/import/template.xlsx", async (_req, res) => {
    const xlsx = await import("xlsx");
    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.aoa_to_sheet([
      escapeSpreadsheetRow(["admissionNumber", "fullName", "gender", "class", "stream", "guardianName", "guardianPhone", "guardianEmail", "status"]),
    ]);
    xlsx.utils.book_append_sheet(wb, ws, "Students");
    const buf = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.send(buf);
  });

  return r;
}

