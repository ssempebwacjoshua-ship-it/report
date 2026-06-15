import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { prisma } from "../db/prisma";
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

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

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
  return value === "school-provided" || value === "system-generated" || value === "mixed/adaptive"
    ? value
    : "mixed/adaptive";
}

export function studentsRoutes() {
  const router = Router();

  router.get("/internal/students", async (req, res, next) => {
    try {
      const query = z.object({ classId: z.string().optional(), streamId: z.string().optional(), search: z.string().optional(), isActive: z.string().optional() }).parse(req.query);
      const rows = await listEnrolledStudents(prisma, req.school!.code, query);
      res.json({ students: rows });
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/students", async (req, res, next) => {
    try {
      const query = z.object({
        classId: z.string().optional(),
        streamId: z.string().optional(),
        search: z.string().optional(),
        isActive: z.string().optional(),
      }).parse(req.query);
      const students = await listEnrolledStudents(prisma, req.school!.code, query);
      res.json({ students });
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/students", async (req, res, next) => {
    try {
      const schoolCode = req.school!.code;
      const input = studentCreateSchema.parse(req.body);
      const admissionNumber = input.admissionNumber?.trim() || await generateAdmissionNumber(prisma, schoolCode, input.fullName, input.classId);
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
      const schoolCode = req.school!.code;
      const input = studentCreateSchema.partial().parse(req.body);
      const current = await getEnrolledStudent(prisma, schoolCode, req.params.id);
      if (!current) {
        res.status(404).json({ error: "Student not found." });
        return;
      }
      const name = splitName(input.fullName ?? current.studentName);
      const school = req.school!;
      await prisma.student.update({
        where: { id: current.id },
        data: {
          admissionNumber: input.admissionNumber?.trim() || current.admissionNumber,
          firstName: name.firstName,
          lastName: name.lastName,
          isActive: input.isActive ?? current.isActive,
        },
      });
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

  router.get("/api/students/import/template.csv", async (_req, res) => {
    res.type("text/csv").send("admissionNumber,fullName,gender,class,stream,guardianName,guardianPhone,guardianEmail,status\n,,,Senior 1,A,,,,,ACTIVE\n");
  });

  router.get("/api/students/import/template", async (_req, res) => {
    res.type("text/csv").send("admissionNumber,fullName,gender,class,stream,guardianName,guardianPhone,guardianEmail,status\n");
  });

  router.get("/api/students/import/template.xlsx", async (_req, res) => {
    const xlsx = await import("xlsx");
    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.aoa_to_sheet([["admissionNumber", "fullName", "gender", "class", "stream", "guardianName", "guardianPhone", "guardianEmail", "status"]]);
    xlsx.utils.book_append_sheet(wb, ws, "Students");
    const buffer = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.send(buffer);
  });

  router.post("/api/students/import/preview", upload.single("file"), async (req, res, next) => {
    try {
      const schoolCode = req.school!.code;
      const mode = admissionModeFromQuery(req.body.mode);
      const file = req.file;
      if (!file) {
        res.status(400).json({ error: "Upload a CSV or XLSX file." });
        return;
      }
      const rows = file.originalname.toLowerCase().endsWith(".xlsx") ? parseStudentsXlsx(file.buffer) : parseStudentsCsv(file.buffer.toString("utf8"));
      res.json(await previewStudentImport(prisma, schoolCode, rows, mode === "create-and-update existing" ? "CREATE_AND_UPDATE_EXISTING" : "CREATE_ONLY"));
    } catch (error) {
      next(error);
    }
  });

  router.post("/internal/students/import-jobs/upload", upload.single("file"), async (req, res, next) => {
    try {
      const schoolCode = req.school!.code;
      const mode = admissionModeFromQuery(req.body.mode);
      const file = req.file;
      if (!file) {
        res.status(400).json({ error: "Upload a CSV or XLSX file." });
        return;
      }
      const rows = file.originalname.toLowerCase().endsWith(".xlsx") ? parseStudentsXlsx(file.buffer) : parseStudentsCsv(file.buffer.toString("utf8"));
      res.status(202).json(await createStudentImportJob(prisma, schoolCode, rows, mode === "create-and-update existing" ? "CREATE_AND_UPDATE_EXISTING" : "CREATE_ONLY"));
    } catch (error) {
      next(error);
    }
  });

  router.get("/internal/students/import-jobs/:jobId", async (req, res, next) => {
    try {
      const job = await getStudentImportJob(prisma, req.school!.code, req.params.jobId);
      if (!job) {
        res.status(404).json({ error: "Import job not found." });
        return;
      }
      res.json(job);
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/students/import/commit", upload.single("file"), async (req, res, next) => {
    try {
      const schoolCode = req.school!.code;
      const mode = admissionModeFromQuery(req.body.mode);
      const file = req.file;
      if (!file) {
        res.status(400).json({ error: "Upload a CSV or XLSX file." });
        return;
      }
      const rows = file.originalname.toLowerCase().endsWith(".xlsx") ? parseStudentsXlsx(file.buffer) : parseStudentsCsv(file.buffer.toString("utf8"));
      if (rows.length > 500) {
        res.status(202).json(await createStudentImportJob(prisma, schoolCode, rows, mode === "create-and-update existing" ? "CREATE_AND_UPDATE_EXISTING" : "CREATE_ONLY"));
        return;
      }
      res.json(await commitStudentImport(prisma, schoolCode, rows, mode === "create-and-update existing" ? "CREATE_AND_UPDATE_EXISTING" : "CREATE_ONLY"));
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/students/import/history", async (req, res, next) => {
    try {
      const school = req.school!;
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
      const school = req.school!;
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

  router.get("/internal/students/contact-summary", async (req, res, next) => {
    try {
      res.json(await getContactSummary(prisma, req.school!.code));
    } catch (error) {
      next(error);
    }
  });

  router.get("/internal/students/:id", async (req, res, next) => {
    try {
      const student = await getEnrolledStudent(prisma, req.school!.code, req.params.id);
      if (!student) {
        res.status(404).json({ error: "No actively enrolled student was found." });
        return;
      }
      res.json(student);
    } catch (error) {
      next(error);
    }
  });

  router.post("/internal/students/:id/contacts", async (req, res, next) => { try { const contact = await upsertGuardianContact(prisma, req.school!.code, req.params.id, req.body); res.status(201).json(contact); } catch (error) { next(error); } });
  router.patch("/internal/students/:id/contacts/:contactId", async (req, res, next) => { try { const contact = await upsertGuardianContact(prisma, req.school!.code, req.params.id, req.body, req.params.contactId); res.json(contact); } catch (error) { next(error); } });
  router.delete("/internal/students/:id/contacts/:contactId", async (req, res, next) => { try { await deleteGuardianContact(prisma, req.school!.code, req.params.id, req.params.contactId); res.status(204).end(); } catch (error) { next(error); } });

  return router;
}
