import { CredentialStatus, CredentialType } from "@prisma/client";
import { Router, type ErrorRequestHandler } from "express";
import { z } from "zod";
import {
  deactivateStudentCredential,
  issueStudentCredential,
  listStudentCredentials,
  scanStudentCredential,
  type CredentialScanContext,
} from "../services/studentCredentialService";
import { isPrismaSchemaMissingError } from "../utils/nfcSchemaCheck";

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

const scanSchema = z.object({
  credentialUID: z.string().trim().min(1, "Credential UID is required."),
  context: z.enum(["GATE", "CLASS", "WALLET", "VERIFY"]).optional(),
});

function credentialContext(req: Express.Request) {
  return {
    schoolId: req.school?.id,
    actorId: req.user?.userId,
    actorEmail: req.user?.email,
    actorName: req.user?.name,
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
