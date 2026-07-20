import type { Express } from "express";
import { authRoutes } from "../routes/authRoutes";
import { creatorAuthRoutes } from "../routes/creatorAuthRoutes";

export function registerAuthRoutes(app: Express) {
  app.use(authRoutes());
  app.use("/api/creator", creatorAuthRoutes());
}
