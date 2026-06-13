import "dotenv/config";
import cors from "cors";
import express, { type ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { healthRoutes } from "./routes/healthRoutes";
import { reportsRoutes } from "./routes/reportsRoutes";
import { importsRoutes } from "./routes/importsRoutes";
import { studentsRoutes } from "./routes/studentsRoutes";
import { marksheetsRoutes } from "./routes/marksheetsRoutes";
import { settingsRoutes } from "./routes/settingsRoutes";
import { authRoutes } from "./routes/authRoutes";
import { reportIssueRoutes } from "./routes/reportIssueRoutes";
import { releaseCenterRoutes } from "./routes/releaseCenterRoutes";
import { parentRoutes } from "./routes/parentRoutes";
import { verifyRoutes } from "./routes/verifyRoutes";
import { ocrRoutes } from "./routes/ocrRoutes";
import { prisma } from "./db/prisma";
import { recoverStaleStudentImportJobs } from "./services/studentImportService";

export function createServer() {
  const app = express();
  app.use(cors({ origin: process.env.CLIENT_ORIGIN ?? true, credentials: true }));
  app.use(express.json({ limit: "2mb" }));

  app.use(healthRoutes());
  app.use(authRoutes());
  app.use(reportsRoutes());
  app.use(reportIssueRoutes());
  app.use(releaseCenterRoutes());
  app.use(importsRoutes());
  app.use(studentsRoutes());
  app.use(marksheetsRoutes());
  app.use(settingsRoutes());
  app.use(parentRoutes());
  app.use(verifyRoutes());
  app.use(ocrRoutes());

  const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
    if (error instanceof ZodError) {
      const fieldErrors = error.flatten().fieldErrors;
      res.status(400).json({
        message: "Invalid request",
        fieldErrors,
        issues: error.issues,
      });
      return;
    }
    console.error(error);
    res.status(500).json({ error: "Unexpected server error" });
  };
  app.use(errorHandler);

  return app;
}

if (process.env.NODE_ENV !== "test") {
  const port = Number(process.env.PORT ?? 4300);
  void recoverStaleStudentImportJobs(prisma).catch((error) => console.error("Failed to recover stale student import jobs", error));
  createServer().listen(port, "0.0.0.0", () => {
    console.log(`Reports lab API listening on port ${port}`);
  });
}
