import type { Express } from "express";
import { platformOwnerRoutes } from "../routes/platformOwnerRoutes";

export function registerOwnerRoutes(app: Express) {
  app.use(platformOwnerRoutes());
}
