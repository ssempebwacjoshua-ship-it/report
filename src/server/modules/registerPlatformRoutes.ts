import type { Express, RequestHandler } from "express";
import { APP_BUILD_TIME, APP_BUILD_VERSION } from "../config/deployRuntime";
import geminiOcrBenchmarkRoutes from "../routes/geminiOcrBenchmarkRoutes";
import geminiOcrRoutes from "../routes/geminiOcrRoutes";
import geminiRosterRoutes from "../routes/geminiRosterRoutes";
import { platformAdminRoutes } from "../routes/platformAdminRoutes";

export function registerPlatformRoutes(app: Express) {
  app.use(platformAdminRoutes());
}

export function registerPlatformDiagnosticRoutes(app: Express) {
  const appVersionHandler: RequestHandler = (_req, res) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.json({ version: APP_BUILD_VERSION, buildTime: APP_BUILD_TIME });
  };

  app.get("/api/app-version", appVersionHandler);
  app.get("/report-lab/api/app-version", appVersionHandler);
  app.use("/api", geminiOcrRoutes);
  app.use("/api", geminiOcrBenchmarkRoutes);
  app.use("/api", geminiRosterRoutes);
}
