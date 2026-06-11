import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma";
import {
  deleteGuardianContact,
  getContactSummary,
  getEnrolledStudent,
  listEnrolledStudents,
  upsertGuardianContact,
} from "../repositories/studentRepository";

const schoolQuery = z.object({
  schoolCode: z.string().default("SCU-PREVIEW"),
});

const studentsQuery = schoolQuery.extend({
  classId: z.string().optional(),
  streamId: z.string().optional(),
  search: z.string().optional(),
});

const contactInput = z
  .object({
    guardianName: z.string().trim().min(2, "Guardian name is required."),
    relationship: z.string().trim().min(2, "Relationship is required."),
    phone: z.string().trim().optional(),
    email: z.string().trim().email("Email must be valid.").optional().or(z.literal("")),
    preferredContactMethod: z.enum(["PHONE", "SMS", "EMAIL", "WHATSAPP"]),
    isPrimary: z.boolean(),
    canReceiveReports: z.boolean(),
    notes: z.string().trim().optional(),
  })
  .refine((data) => data.phone || data.email, {
    message: "Add at least a phone number or email address.",
    path: ["phone"],
  });

export function studentsRoutes() {
  const router = Router();

  router.get("/internal/students", async (req, res, next) => {
    try {
      const query = studentsQuery.parse(req.query);
      res.json({ students: await listEnrolledStudents(prisma, query.schoolCode, query) });
    } catch (error) {
      next(error);
    }
  });

  router.get("/internal/students/contact-summary", async (req, res, next) => {
    try {
      const query = schoolQuery.parse(req.query);
      res.json(await getContactSummary(prisma, query.schoolCode));
    } catch (error) {
      next(error);
    }
  });

  router.get("/internal/students/:id", async (req, res, next) => {
    try {
      const query = schoolQuery.parse(req.query);
      const student = await getEnrolledStudent(prisma, query.schoolCode, req.params.id);
      if (!student) {
        res.status(404).json({ error: "No actively enrolled student was found." });
        return;
      }
      res.json(student);
    } catch (error) {
      next(error);
    }
  });

  router.post("/internal/students/:id/contacts", async (req, res, next) => {
    try {
      const query = schoolQuery.parse(req.query);
      const contact = await upsertGuardianContact(prisma, query.schoolCode, req.params.id, contactInput.parse(req.body));
      res.status(201).json(contact);
    } catch (error) {
      if (error instanceof Error && error.message.includes("enrolled")) {
        res.status(400).json({ error: error.message });
        return;
      }
      next(error);
    }
  });

  router.patch("/internal/students/:id/contacts/:contactId", async (req, res, next) => {
    try {
      const query = schoolQuery.parse(req.query);
      const contact = await upsertGuardianContact(
        prisma,
        query.schoolCode,
        req.params.id,
        contactInput.parse(req.body),
        req.params.contactId,
      );
      res.json(contact);
    } catch (error) {
      if (error instanceof Error && error.message.includes("enrolled")) {
        res.status(400).json({ error: error.message });
        return;
      }
      next(error);
    }
  });

  router.delete("/internal/students/:id/contacts/:contactId", async (req, res, next) => {
    try {
      const query = schoolQuery.parse(req.query);
      await deleteGuardianContact(prisma, query.schoolCode, req.params.id, req.params.contactId);
      res.status(204).end();
    } catch (error) {
      if (error instanceof Error && error.message.includes("enrolled")) {
        res.status(400).json({ error: error.message });
        return;
      }
      next(error);
    }
  });

  return router;
}
