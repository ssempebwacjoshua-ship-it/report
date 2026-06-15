import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma";
import { listEnrolledStudents } from "../repositories/studentRepository";
import { commitMarksImport, dryRunMarksImport } from "../services/marksImportService";

const contextSchema = z.object({
  className: z.string(),
  streamName: z.string(),
  subjectName: z.string(),
  termName: z.string(),
  examType: z.string(),
  operatorName: z.string().default("Operator"),
  studentsCount: z.number().int().nonnegative(),
  marksEntered: z.number().int().nonnegative(),
});

export function marksheetsRoutes() {
  const router = Router();

  // Enrolled students for a marksheet context
  router.get("/api/marksheets/students", async (req, res, next) => {
    try {
      const query = z
        .object({ classId: z.string().min(1), streamId: z.string().optional() })
        .parse(req.query);

      const students = await listEnrolledStudents(prisma, req.school!.code, {
        classId: query.classId,
        streamId: query.streamId,
      });

      res.json({
        students: students.map((s) => ({
          id: s.id,
          admissionNumber: s.admissionNumber,
          firstName: s.studentName.split(" ")[0] ?? s.studentName,
          lastName: s.studentName.split(" ").slice(1).join(" "),
        })),
      });
    } catch (error) {
      next(error);
    }
  });

  // Dry run marks from marksheet form (reuses same service)
  router.post("/api/marksheets/dry-run", async (req, res, next) => {
    try {
      const body = z.object({ csvText: z.string().min(1) }).parse(req.body);
      const result = await dryRunMarksImport(prisma, req.school!.code, body.csvText);
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  // Commit marks with marksheet context stored in batch summary
  router.post("/api/marksheets/commit", async (req, res, next) => {
    try {
      const body = z
        .object({
          csvText: z.string().min(1),
          context: contextSchema,
        })
        .parse(req.body);

      const schoolCode = req.school!.code;
      const result = await commitMarksImport(prisma, schoolCode, body.csvText);

      if (result.status === "COMMITTED" && result.batchId) {
        await prisma.markImportBatch.update({
          where: { id: result.batchId },
          data: {
            source: "marksheet",
            summary: JSON.stringify(body.context),
          },
        });
      }

      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  // List committed batches for HM review
  router.get("/api/marksheets/batches", async (req, res, next) => {
    try {
      const school = req.school!;

      const batches = await prisma.markImportBatch.findMany({
        where: { schoolId: school.id, status: "COMMITTED" },
        include: { _count: { select: { marks: true } } },
        orderBy: { createdAt: "desc" },
      });

      const batchIds = batches.map((b) => b.id);
      const approvalLogs = await prisma.auditLog.findMany({
        where: {
          schoolId: school.id,
          action: { in: ["hm.approve", "hm.return"] },
          correlationId: { in: batchIds },
        },
        orderBy: { createdAt: "desc" },
      });

      const latestLog = new Map<string, (typeof approvalLogs)[0]>();
      for (const log of approvalLogs) {
        if (log.correlationId && !latestLog.has(log.correlationId)) {
          latestLog.set(log.correlationId, log);
        }
      }

      const result = batches.map((b) => {
        const log = latestLog.get(b.id);
        const approvalStatus = log ? (log.action === "hm.approve" ? "APPROVED" : "RETURNED") : "PENDING_REVIEW";

        let parsedContext: object | null = null;
        if (b.source === "marksheet" && b.summary) {
          try {
            parsedContext = JSON.parse(b.summary);
          } catch {
            parsedContext = null;
          }
        }

        return {
          id: b.id,
          source: b.source,
          summary: b.summary,
          createdAt: b.createdAt,
          marksCount: b._count.marks,
          approvalStatus,
          hmNote: log ? ((log.details as Record<string, unknown>)?.note ?? null) : null,
          parsedContext,
        };
      });

      res.json({ batches: result });
    } catch (error) {
      next(error);
    }
  });

  // HM approve
  router.post("/api/marksheets/batches/:batchId/approve", async (req, res, next) => {
    try {
      const body = z.object({ note: z.string().optional() }).parse(req.body);
      const school = req.school!;

      const batch = await prisma.markImportBatch.findFirst({
        where: { id: req.params.batchId, schoolId: school.id },
      });
      if (!batch) {
        res.status(404).json({ error: "Batch not found" });
        return;
      }

      await prisma.auditLog.create({
        data: {
          schoolId: school.id,
          action: "hm.approve",
          correlationId: batch.id,
          details: { note: body.note ?? "", batchId: batch.id },
        },
      });

      res.json({ ok: true, approvalStatus: "APPROVED" });
    } catch (error) {
      next(error);
    }
  });

  // HM return for correction
  router.post("/api/marksheets/batches/:batchId/return", async (req, res, next) => {
    try {
      const body = z.object({ note: z.string().min(1, "A reason is required when returning marks.") }).parse(req.body);
      const school = req.school!;

      const batch = await prisma.markImportBatch.findFirst({
        where: { id: req.params.batchId, schoolId: school.id },
      });
      if (!batch) {
        res.status(404).json({ error: "Batch not found" });
        return;
      }

      await prisma.auditLog.create({
        data: {
          schoolId: school.id,
          action: "hm.return",
          correlationId: batch.id,
          details: { note: body.note, batchId: batch.id },
        },
      });

      res.json({ ok: true, approvalStatus: "RETURNED" });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
