import prismaPkg from "@prisma/client";
import { Router, type ErrorRequestHandler } from "express";
import { z } from "zod";
import {
  amendStudentCredential,
  bulkAllocateCredentials,
  deactivateStudentCredential,
  reactivateStudentCredential,
  getCredentialAllocation,
  issueStudentCredential,
  listStudentCredentials,
  scanStudentCredential,
  type CredentialScanContext,
} from "../services/studentCredentialService";
import { isPrismaSchemaMissingError } from "../utils/nfcSchemaCheck";

const { CredentialStatus, CredentialType } = prismaPkg;

const issueSchema = z.object({
  studentId: z.string().uuid(),
  credentialUID: z.string().trim().min(1, "Credential UID is required."),
});

const listQuerySchema = z.object({
  search: z.string().optional(),
  studentId: z.string().uuid().optional(),
  status: z.enum(CredentialStatus).optional(),
});

const deactivateSchema = z.object({
  reason: z.string().trim().min(1, "Deactivation reason is required."),
});

const reactivateSchema = z.object({
  reason: z.string().trim().min(1, "Re-activation reason is required."),
});

const scanSchema = z.object({
  credentialUID: z.string().trim().min(1, "Credential UID is required."),
  context: z.enum(["GATE", "CLASS", "WALLET", "VERIFY"]).optional(),
});

const allocationQuerySchema = z.object({
  classId: z.string().uuid().optional(),
  streamId: z.string().uuid().optional(),
  status: z.enum(["ALL", "ALLOCATED", "UNALLOCATED", "DEACTIVATED"]).optional(),
  search: z.string().optional(),
});

const bulkAllocateSchema = z.object({
  reason: z.string().trim().min(1, "Reason is required."),
  assignments: z
    .array(
      z.object({
        studentId: z.string().uuid(),
        credentialUID: z.string().min(1, "Wristband UID is required."),
      }),
    )
    .min(1, "At least one assignment is required."),
});

const amendSchema = z.object({
  studentId: z.string().uuid().optional(),
  admissionNumber: z.string().optional(),
  credentialUID: z.string().optional(),
  reason: z.string().trim().min(1, "Amendment reason is required."),
});

function credentialContext(req: Express.Request) {
  return {
    schoolId: req.school?.id,
    actorId: req.user?.userId,
    actorEmail: req.user?.email,
    actorName: req.user?.name,
    role: req.user?.role,
  };
}

export function studentCredentialRoutes() {
  const router = Router();

  router.post("/api/student-credentials", async (req, res, next) => {
    try {
      const input = issueSchema.parse(req.body);
      const result = await issueStudentCredential(credentialContext(req), {
        ...input,
        type: CredentialType.NFC_WRISTBAND,
      });
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/student-credentials", async (req, res, next) => {
    try {
      const query = listQuerySchema.parse(req.query);
      const result = await listStudentCredentials(credentialContext(req), {
        ...query,
        type: CredentialType.NFC_WRISTBAND,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.patch("/api/student-credentials/:id/deactivate", async (req, res, next) => {
    try {
      const input = deactivateSchema.parse(req.body);
      const result = await deactivateStudentCredential(credentialContext(req), req.params.id, input.reason);
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.patch("/api/student-credentials/:id/reactivate", async (req, res, next) => {
    try {
      const { reason } = reactivateSchema.parse(req.body);
      const result = await reactivateStudentCredential(credentialContext(req), req.params.id, reason);
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/student-credentials/allocation", async (req, res, next) => {
    try {
      const query = allocationQuerySchema.parse(req.query);
      const result = await getCredentialAllocation(credentialContext(req), query);
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/student-credentials/bulk-allocate", async (req, res, next) => {
    try {
      const input = bulkAllocateSchema.parse(req.body);
      const result = await bulkAllocateCredentials(credentialContext(req), input);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  });

  router.patch("/api/student-credentials/:id/amend", async (req, res, next) => {
    try {
      const { admissionNumber, ...rest } = amendSchema.parse(req.body);
      let resolvedStudentId = rest.studentId;
      if (admissionNumber && !resolvedStudentId) {
        const { prisma } = await import("../db/prisma");
        const schoolId = req.school?.id;
        if (!schoolId) throw Object.assign(new Error("School context required."), { status: 401 });
        const found = await prisma.student.findFirst({
          where: { schoolId, admissionNumber: admissionNumber.trim(), isActive: true },
        });
        if (!found) throw Object.assign(new Error("Student not found in this school."), { status: 404 });
        resolvedStudentId = found.id;
      }
      const input = { ...rest, studentId: resolvedStudentId };
      const result = await amendStudentCredential(credentialContext(req), req.params.id, input);
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/student-credentials/scan", async (req, res, next) => {
    try {
      const input = scanSchema.parse(req.body);
      const result = await scanStudentCredential(credentialContext(req), {
        credentialUID: input.credentialUID,
        context: input.context as CredentialScanContext | undefined,
        type: CredentialType.NFC_WRISTBAND,
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  // Convert Prisma "table/column does not exist" errors to a clear 503
  // so callers know to run the repair migration rather than seeing a generic 500.
  const schemaMissingHandler: ErrorRequestHandler = (error, _req, res, next) => {
    const missing = isPrismaSchemaMissingError(error);
    if (missing) {
      res.status(503).json({
        error: "NFC wristband schema not ready",
        detail: `Missing ${missing.missing}. Run: npx prisma migrate deploy`,
      });
      return;
    }
    next(error);
  };
  router.use(schemaMissingHandler);

  return router;
}
