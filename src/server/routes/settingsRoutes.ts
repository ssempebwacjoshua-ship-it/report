import { Router } from "express";
import { prisma } from "../db/prisma";
import { getSettings, patchSettingsSection } from "../repositories/settingsRepository";
import { SETTING_SECTIONS, type SettingSection } from "../../shared/types/settings";
import { requireSchoolPermission } from "../middleware/requireSchoolPermission";

function updatedByFromRequest(req: { header: (name: string) => string | undefined; user?: { name?: string; email?: string } }) {
  return req.user?.name ?? req.user?.email ?? req.header("x-user-name") ?? req.header("x-user-email") ?? null;
}

export function settingsRoutes() {
  const router = Router();
  router.use(requireSchoolPermission("app.admin"));

  router.get("/api/settings", async (req, res, next) => {
    try {
      res.json(await getSettings(prisma, req.school!.code));
    } catch (error) {
      next(error);
    }
  });

  for (const section of SETTING_SECTIONS) {
    router.patch(`/api/settings/${section}`, async (req, res, next) => {
      try {
        res.json(
          await patchSettingsSection(
            prisma,
            req.school!.code,
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
