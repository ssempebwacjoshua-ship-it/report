import { Router } from "express";
import multer from "multer";
import { prisma } from "../db/prisma";
import { getSettings, patchSettingsSection } from "../repositories/settingsRepository";
import { SETTING_SECTIONS, type SettingSection } from "../../shared/types/settings";
import { requireSchoolPermission } from "../middleware/requireSchoolPermission";
import { saveSchoolAssetUpload } from "../services/uploadStorageService";
import { requireSubscriptionEntitlement } from "../services/subscriptionEntitlementService";
import { ensureNonEmptyUpload, sendUploadValidationError } from "../utils/uploadSafety";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024, files: 1 } });

function updatedByFromRequest(req: { header: (name: string) => string | undefined; user?: { name?: string; email?: string } }) {
  return req.user?.name ?? req.user?.email ?? req.header("x-user-name") ?? req.header("x-user-email") ?? null;
}

export function settingsRoutes() {
  const router = Router();
  router.use("/api/settings", requireSchoolPermission("app.admin"));

  router.get("/api/settings", async (req, res, next) => {
    try {
      res.json(await getSettings(prisma, req.school!.code));
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/settings/report-personalization/assets/:assetType", requireSubscriptionEntitlement("settings.premium_branding"), upload.single("file"), async (req, res, next) => {
    try {
      const assetType = req.params.assetType;
      if (!["logo", "stamp", "signature"].includes(assetType)) {
        res.status(400).json({ error: "Unsupported asset type." });
        return;
      }
      if (!req.file) {
        res.status(400).json({ error: "Upload an image file." });
        return;
      }
      ensureNonEmptyUpload(req.file, "The settings asset file");
      const uploaded = await saveSchoolAssetUpload({
        buffer: req.file.buffer,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        schoolCode: req.school!.code,
        assetType: assetType as "logo" | "stamp" | "signature",
      });
      res.json({ assetType, assetUrl: uploaded.publicUrl });
    } catch (error) {
      if (sendUploadValidationError(res, error)) {
        return;
      }
      next(error);
    }
  });

  for (const section of SETTING_SECTIONS) {
    const handlers = section === "reportPersonalization"
      ? [requireSubscriptionEntitlement("settings.premium_branding")]
      : [];
    router.patch(`/api/settings/${section}`, ...handlers, async (req, res, next) => {
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
