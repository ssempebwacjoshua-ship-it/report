import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma";
import { getSettings, patchSettingsSection } from "../repositories/settingsRepository";
import { SETTING_SECTIONS, type SettingSection } from "../../shared/types/settings";

const schoolCodeQuery = z.object({ schoolCode: z.string().default("SCU-PREVIEW") });

function updatedByFromRequest(req: { header: (name: string) => string | undefined }) {
  return req.header("x-user-name") ?? req.header("x-user-email") ?? null;
}

export function settingsRoutes() {
  const router = Router();

  router.get("/api/settings", async (req, res, next) => {
    try {
      const query = schoolCodeQuery.parse(req.query);
      res.json(await getSettings(prisma, query.schoolCode));
    } catch (error) {
      next(error);
    }
  });

  for (const section of SETTING_SECTIONS) {
    router.patch(`/api/settings/${section}`, async (req, res, next) => {
      try {
        const query = schoolCodeQuery.parse(req.query);
        res.json(
          await patchSettingsSection(
            prisma,
            query.schoolCode,
            section as SettingSection,
            req.body,
            updatedByFromRequest(req),
          ),
        );
      } catch (error) {
        next(error);
      }
    });
  }

  return router;
}
