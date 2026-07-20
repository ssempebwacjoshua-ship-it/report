import type { Express } from "express";
import { communicationRoutes } from "../routes/communicationRoutes";
import { smsIntegrationRoutes } from "../routes/smsIntegrationRoutes";
import { supportRoutes } from "../routes/supportRoutes";
import { whatsappIntegrationRoutes } from "../routes/whatsappIntegrationRoutes";

export function registerCommunicationRoutes(app: Express) {
  app.use(communicationRoutes());
}

export function registerCommunicationPublicRoutes(app: Express) {
  app.use(whatsappIntegrationRoutes());
  app.use(smsIntegrationRoutes());
}

export function registerCommunicationPlatformRoutes(app: Express) {
  app.use(supportRoutes());
}
