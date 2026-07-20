import type { Express } from "express";
import { nfcOfflineRoutes } from "../routes/nfcOfflineRoutes";
import { nfcOperationsRoutes, nfcPublicRoutes } from "../routes/nfcOperationsRoutes";
import { nfcTagsPublicRoutes, nfcTagsRoutes } from "../routes/nfcTagsRoutes";
import { readerGatewayRoutes } from "../routes/readerGatewayRoutes";
import { staffUsersRoutes } from "../routes/staffUsersRoutes";
import { studentCredentialRoutes } from "../routes/studentCredentialRoutes";

export function registerNfcRoutes(app: Express) {
  app.use(studentCredentialRoutes());
  app.use(nfcOperationsRoutes());
  app.use(nfcTagsRoutes());
  app.use(nfcOfflineRoutes());
  app.use(staffUsersRoutes());
}

export function registerNfcPublicRoutes(app: Express) {
  app.use(nfcPublicRoutes());
  app.use(nfcTagsPublicRoutes());
  app.use(readerGatewayRoutes());
}
