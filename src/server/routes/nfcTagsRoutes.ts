import { Router } from "express";
import { z } from "zod";
import { verifyToken } from "../services/authService";
import {
  assignTag,
  disableTag,
  enableTag,
  generateTags,
  getTagEvents,
  listTags,
  resolvePublicCode,
  unassignTag,
  type NfcTagsContext,
} from "../services/nfcTagsService";
import {
  amendTag,
  bulkAllocateFromInventory,
  bulkImportUids,
  createUrlTagBatch,
  listTagBatches,
  listTagInventory,
  verifyTag,
} from "../services/nfcTagBatchService";
import { attachUsageWarning, recordPlatformUsage, requirePlatformModule } from "../platformIntegration";

const generateSchema = z.object({
  count: z.coerce.number().int().min(1).max(100).default(1),
});

const assignSchema = z
  .object({
    studentId: z.string().uuid("studentId must be a valid UUID.").optional(),
    admissionNumber: z.string().min(1).optional(),
  })
  .refine((v) => v.studentId || v.admissionNumber, {
    message: "Provide studentId or admissionNumber.",
  });

const listFiltersSchema = z.object({
  search: z.string().optional(),
  status: z.string().optional(),
});

const createUrlBatchSchema = z.object({
  name: z.string().min(1, "Batch name is required."),
  quantity: z.coerce.number().int().min(1).max(500),
  labelPrefix: z.string().optional(),
});

const bulkImportUidsSchema = z.object({
  batchName: z.string().min(1, "Batch name is required."),
  uids: z.array(z.string().min(1)).min(1, "At least one UID is required.").max(500, "Maximum 500 UIDs per import."),
  reason: z.string().optional(),
});

const inventoryFiltersSchema = z.object({
  batchId: z.string().uuid().optional(),
  tagMode: z.enum(["URL", "UID"]).optional(),
  status: z.string().optional(),
  search: z.string().optional(),
});

const amendTagSchema = z.object({
  label: z.string().optional(),
  physicalUid: z.string().optional(),
  status: z.string().optional(),
  reason: z.string().min(1, "Reason is required."),
});

const bulkAllocateInventorySchema = z.object({
  assignments: z
    .array(
      z.object({
        tagId: z.string().uuid(),
        studentId: z.string().uuid(),
      }),
    )
    .min(1),
  reason: z.string().min(1, "Reason is required."),
});

function ctx(req: Express.Request): NfcTagsContext {
  return {
    schoolId: req.school?.id,
    actorId: req.user?.userId,
    role: req.user?.role,
  };
}

function authPayloadFromHeader(authHeader: string | undefined) {
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  try {
    return token ? verifyToken(token) : null;
  } catch {
    return null;
  }
}

function cleanUrl(value: string): string {
  return value.replace(/\/+$/, "");
}

function getPublicAppUrl(req: Express.Request): string {
  const configured =
    process.env.NFC_PUBLIC_APP_URL ??
    process.env.PUBLIC_APP_URL ??
    process.env.FRONTEND_APP_URL ??
    process.env.VITE_PUBLIC_APP_URL;

  if (configured?.trim()) {
    return cleanUrl(configured.trim());
  }

  // Fallback: use the request Origin header when available (set by browsers on cross-origin requests).
  const origin = req.headers.origin;
  if (typeof origin === "string" && origin.trim()) {
    return cleanUrl(origin.trim());
  }

  // Last resort: derive from request host (may still be the API domain — set NFC_PUBLIC_APP_URL).
  const proto = (req.headers["x-forwarded-proto"] as string) ?? req.protocol ?? "https";
  const host = (req.headers["x-forwarded-host"] as string) ?? req.get("host") ?? "localhost";
  return cleanUrl(`${proto}://${host}`);
}

/** Public route — no school context, no auth required. Mount BEFORE resolveSchoolContext. */
export function nfcTagsPublicRoutes() {
  const router = Router();

  router.get("/api/nfc/resolve/:publicCode", async (req, res, next) => {
    try {
      const auth = authPayloadFromHeader(req.headers.authorization);
      const result = await resolvePublicCode(
        req.params.publicCode,
        {
          userAgent: req.headers["user-agent"],
          ip: req.ip ?? req.socket.remoteAddress,
          isAuthenticated: !!auth,
        },
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  return router;
}

/** Protected routes — mount AFTER resolveSchoolContext. */
export function nfcTagsRoutes() {
  const router = Router();

  // ── Batches ───────────────────────────────────────────────────────────────

  router.get("/api/nfc/tag-batches", async (req, res, next) => {
    try {
      if (!(await requirePlatformModule(req, res, "nfc.tags"))) {
        return;
      }
      const { tagMode } = z.object({ tagMode: z.enum(["URL", "UID"]).optional() }).parse(req.query);
      res.json(await listTagBatches(ctx(req), { tagMode }));
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/nfc/tag-batches", async (req, res, next) => {
    try {
      if (!(await requirePlatformModule(req, res, "nfc.tags"))) {
        return;
      }
      const input = createUrlBatchSchema.parse(req.body);
      const result = await createUrlTagBatch(ctx(req), { ...input, baseUrl: getPublicAppUrl(req) });
      if (result.tags.length > 0) {
        const warning = await Promise.all(result.tags.map((tag) => recordPlatformUsage(req, {
          moduleCode: "nfc.tags",
          quantity: 1,
          sourceType: "nfc_tag_issue",
          sourceId: tag.id,
          metadataJson: { batchId: result.batch.id, tagMode: "URL" },
        })));
        attachUsageWarning(res, warning.find(Boolean) ?? null);
      }
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  });

  // ── Static tag sub-routes (must be before /:id) ───────────────────────────

  router.get("/api/nfc/tags/inventory", async (req, res, next) => {
    try {
      if (!(await requirePlatformModule(req, res, "nfc.tags"))) {
        return;
      }
      res.json(await listTagInventory(ctx(req), inventoryFiltersSchema.parse(req.query)));
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/nfc/tags/generate", async (req, res, next) => {
    try {
      if (!(await requirePlatformModule(req, res, "nfc.tags"))) {
        return;
      }
      const { count } = generateSchema.parse(req.body);
      const result = await generateTags(ctx(req), count, getPublicAppUrl(req));
      const warning = await Promise.all(result.tags.map((tag) => recordPlatformUsage(req, {
        moduleCode: "nfc.tags",
        quantity: 1,
        sourceType: "nfc_tag_issue",
        sourceId: tag.id,
        metadataJson: { tagMode: "TEXT" },
      })));
      attachUsageWarning(res, warning.find(Boolean) ?? null);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/nfc/tags/bulk-import-uids", async (req, res, next) => {
    try {
      if (!(await requirePlatformModule(req, res, "nfc.tags"))) {
        return;
      }
      const result = await bulkImportUids(ctx(req), bulkImportUidsSchema.parse(req.body));
      const warnings = await Promise.all(result.tags.map((tag) => recordPlatformUsage(req, {
        moduleCode: "nfc.tags",
        quantity: 1,
        sourceType: "nfc_tag_issue",
        sourceId: tag.id,
        metadataJson: { batchId: result.batch.id, tagMode: "UID" },
      })));
      attachUsageWarning(res, warnings.find(Boolean) ?? null);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/nfc/tags/bulk-allocate", async (req, res, next) => {
    try {
      if (!(await requirePlatformModule(req, res, "nfc.tags"))) {
        return;
      }
      const result = await bulkAllocateFromInventory(ctx(req), bulkAllocateInventorySchema.parse(req.body));
      const warnings = await Promise.all(result.tags.map((tag) => recordPlatformUsage(req, {
        moduleCode: "nfc.tags",
        quantity: 1,
        sourceType: "nfc_tag_issue",
        sourceId: tag.id,
        metadataJson: { kind: "allocation" },
      })));
      attachUsageWarning(res, warnings.find(Boolean) ?? null);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  });

  // ── Per-tag routes (/:id) ─────────────────────────────────────────────────

  router.get("/api/nfc/tags", async (req, res, next) => {
    try {
      if (!(await requirePlatformModule(req, res, "nfc.tags"))) {
        return;
      }
      res.json(await listTags(ctx(req), listFiltersSchema.parse(req.query)));
    } catch (error) {
      next(error);
    }
  });

  router.patch("/api/nfc/tags/:id/assign", async (req, res, next) => {
    try {
      if (!(await requirePlatformModule(req, res, "nfc.tags"))) {
        return;
      }
      const assignment = assignSchema.parse(req.body);
      res.json(await assignTag(ctx(req), req.params.id, assignment));
    } catch (error) {
      next(error);
    }
  });

  router.patch("/api/nfc/tags/:id/unassign", async (req, res, next) => {
    try {
      if (!(await requirePlatformModule(req, res, "nfc.tags"))) {
        return;
      }
      res.json(await unassignTag(ctx(req), req.params.id));
    } catch (error) {
      next(error);
    }
  });

  router.patch("/api/nfc/tags/:id/disable", async (req, res, next) => {
    try {
      if (!(await requirePlatformModule(req, res, "nfc.tags"))) {
        return;
      }
      res.json(await disableTag(ctx(req), req.params.id));
    } catch (error) {
      next(error);
    }
  });

  router.patch("/api/nfc/tags/:id/enable", async (req, res, next) => {
    try {
      if (!(await requirePlatformModule(req, res, "nfc.tags"))) {
        return;
      }
      const { reason } = z.object({ reason: z.string().trim().min(1, "Reason is required.") }).parse(req.body);
      res.json(await enableTag(ctx(req), req.params.id, reason));
    } catch (error) {
      next(error);
    }
  });

  router.patch("/api/nfc/tags/:id/verify", async (req, res, next) => {
    try {
      if (!(await requirePlatformModule(req, res, "nfc.tags"))) {
        return;
      }
      res.json(await verifyTag(ctx(req), req.params.id));
    } catch (error) {
      next(error);
    }
  });

  router.patch("/api/nfc/tags/:id/amend", async (req, res, next) => {
    try {
      if (!(await requirePlatformModule(req, res, "nfc.tags"))) {
        return;
      }
      res.json(await amendTag(ctx(req), req.params.id, amendTagSchema.parse(req.body)));
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/nfc/tags/:id/events", async (req, res, next) => {
    try {
      if (!(await requirePlatformModule(req, res, "nfc.tags"))) {
        return;
      }
      res.json(await getTagEvents(ctx(req), req.params.id));
    } catch (error) {
      next(error);
    }
  });

  return router;
}
