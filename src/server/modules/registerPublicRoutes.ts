import type { Express } from "express";
import { healthRoutes } from "../routes/healthRoutes";
import { parentRoutes } from "../routes/parentRoutes";
import { verifyRoutes } from "../routes/verifyRoutes";
import { studentsPublicRoutes } from "../routes/studentsRoutes";
import { registerAuthRoutes } from "./registerAuthRoutes";
import { registerCommunicationPublicRoutes } from "./registerCommunicationRoutes";
import { registerNfcPublicRoutes } from "./registerNfcRoutes";
import { registerPlatformDiagnosticRoutes } from "./registerPlatformRoutes";
import { registerSmartPagesPublicRoutes } from "./registerSmartPagesRoutes";

export function registerPublicRoutes(app: Express) {
  app.use(healthRoutes());
  registerAuthRoutes(app);
  app.use(verifyRoutes());
  app.use(parentRoutes());
  app.use(studentsPublicRoutes());
  registerNfcPublicRoutes(app);
  registerCommunicationPublicRoutes(app);
  registerPlatformDiagnosticRoutes(app);
  registerSmartPagesPublicRoutes(app);
}
