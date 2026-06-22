import { Router } from "express";
import { z } from "zod";
import { verifyToken } from "../services/authService";
import {
  assignTag,
  disableTag,
  generateTags,
  getTagEvents,
  listTags,
  resolvePublicCode,
  unassignTag,
  type NfcTagsContext,
} from "../services/nfcTagsService";

const generateSchema = z.object({
  count: z.coerce.number().int().min(1).max(100).default(1),
});

const assignSchema = z.object({
  studentId: z.string().uuid("studentId must be a valid UUID."),
});

const listFiltersSchema = z.object({
  search: z.string().optional(),
  status: z.enum(["UNASSIGNED", "ASSIGNED", "DISABLED"]).optional(),
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

function getBaseUrl(req: Express.Request): string {
  const proto = (req.headers["x-forwarded-proto"] as string) ?? req.protocol ?? "https";
  const host = (req.headers["x-forwarded-host"] as string) ?? req.get("host") ?? "localhost";
  return `${proto}://${host}`;
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

  router.get("/api/nfc/tags", async (req, res, next) => {
    try {
      res.json(await listTags(ctx(req), listFiltersSchema.parse(req.query)));
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/nfc/tags/generate", async (req, res, next) => {
    try {
      const { count } = generateSchema.parse(req.body);
      res.status(201).json(await generateTags(ctx(req), count, getBaseUrl(req)));
    } catch (error) {
      next(error);
    }
  });

  router.patch("/api/nfc/tags/:id/assign", async (req, res, next) => {
    try {
      const { studentId } = assignSchema.parse(req.body);
      res.json(await assignTag(ctx(req), req.params.id, studentId));
    } catch (error) {
      next(error);
    }
  });

  router.patch("/api/nfc/tags/:id/unassign", async (req, res, next) => {
    try {
      res.json(await unassignTag(ctx(req), req.params.id));
    } catch (error) {
      next(error);
    }
  });

  router.patch("/api/nfc/tags/:id/disable", async (req, res, next) => {
    try {
      res.json(await disableTag(ctx(req), req.params.id));
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/nfc/tags/:id/events", async (req, res, next) => {
    try {
      res.json(await getTagEvents(ctx(req), req.params.id));
    } catch (error) {
      next(error);
    }
  });

  return router;
}
