import type { Express } from "express";
import { importsRoutes } from "../routes/importsRoutes";
import { marksheetsRoutes } from "../routes/marksheetsRoutes";
import { promotionRoutes } from "../routes/promotionRoutes";
import { releaseCenterRoutes } from "../routes/releaseCenterRoutes";
import { reportAssistantRoutes } from "../routes/reportAssistantRoutes";
import { reportIssueRoutes } from "../routes/reportIssueRoutes";
import { reportsRoutes } from "../routes/reportsRoutes";

export function registerReportsRoutes(app: Express) {
  app.use(reportsRoutes());
  app.use(reportIssueRoutes());
  app.use(reportAssistantRoutes());
  app.use(releaseCenterRoutes());
  app.use(importsRoutes());
  app.use(marksheetsRoutes());
  app.use(promotionRoutes());
}
