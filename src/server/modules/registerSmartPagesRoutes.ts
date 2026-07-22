import type { Express } from "express";
import { bulkGenerationRoutes } from "../routes/bulkGenerationRoutes";
import { collectionRoutes } from "../routes/collectionRoutes";
import { documentIntelligenceRoutes } from "../routes/documentIntelligenceRoutes";
import { documentOsRoutes } from "../routes/documentOsRoutes";
import { smartPagesBillingRoutes } from "../routes/smartPagesBillingRoutes";
import { smartPagesTemplateRoutes } from "../routes/smartPagesTemplateRoutes";

export function registerSmartPagesPublicRoutes(app: Express) {
  app.use("/api/smart-documents", documentIntelligenceRoutes());
  app.use("/api/document-os", documentOsRoutes());
  app.use("/api/collections", collectionRoutes());
  app.use("/api/bulk-jobs", bulkGenerationRoutes());
}

export function registerSmartPagesRoutes(app: Express) {
  app.use(smartPagesBillingRoutes());
  app.use(smartPagesTemplateRoutes());
}
