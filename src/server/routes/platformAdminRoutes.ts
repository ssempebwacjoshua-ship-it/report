import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma";
import { requirePlatformKey } from "../middleware/requirePlatformKey";
import { provisionSchool } from "../services/schoolProvisioningService";

const provisionSchema = z.object({
  schoolCode: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[A-Z0-9-]+$/, "schoolCode must be uppercase letters, digits, and hyphens only."),
  schoolName: z.string().min(1).max(200),
  sections: z
    .array(z.enum(["NURSERY", "PRIMARY", "SECONDARY"]))
    .min(1, "At least one section is required."),
  adminEmail: z.string().email("adminEmail must be a valid email address."),
  adminName: z.string().min(1).max(100),
  adminPassword: z.string().min(8, "adminPassword must be at least 8 characters."),
});

export function platformAdminRoutes() {
  const router = Router();

  router.post("/api/platform/schools", requirePlatformKey, async (req, res, next) => {
    try {
      const input = provisionSchema.parse(req.body);
      const result = await provisionSchool(prisma, input);
      res.status(201).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
