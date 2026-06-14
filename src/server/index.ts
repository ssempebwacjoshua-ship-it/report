import "dotenv/config";
import cors from "cors";
import express, { type ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import multer from "multer";
import { dashboardRoutes } from "./routes/dashboardRoutes";
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
import { documentCleanerRoutes } from "./routes/documentCleanerRoutes";
import geminiOcrRoutes from "./routes/geminiOcrRoutes";
import geminiRosterRoutes from "./routes/geminiRosterRoutes";
import geminiMarksImportRoutes from "./routes/geminiMarksImportRoutes";
import { prisma } from "./db/prisma";
import { recoverStaleStudentImportJobs } from "./services/studentImportService";

export function createServer() {
  const app = express();
  app.use(cors({ origin: process.env.CLIENT_ORIGIN ?? true, credentials: true }));
  app.use(express.json({ limit: "2mb" }));

  app.use(healthRoutes());
  app.use(dashboardRoutes());
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
  app.use(documentCleanerRoutes());
  app.use("/api", geminiOcrRoutes);
  app.use("/api", geminiRosterRoutes);
  app.use(geminiMarksImportRoutes());
  console.log("[Gemini OCR] routes mounted at /api/test-gemini-marks and /api/test-gemini-roster");
  console.log("[Gemini Import] route mounted at /api/marks-import/scan/extract");

  const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
    if (error instanceof ZodError) {
      const fieldErrors = error.flatten().fieldErrors;
      res.status(400).json({
        error: true,
        code: "IMPORT_VALIDATION_FAILED",
        message: "Invalid request",
        fieldErrors,
        issues: error.issues,
        details: error.issues.map((issue) => issue.message),
      });
      return;
    }
    if (error instanceof multer.MulterError) {
      const message = error.code === "LIMIT_FILE_SIZE"
        ? "File is too large. Maximum scan file size is 20 MB."
        : `Upload failed: ${error.message}`;
      res.status(400).json({
        error: true,
        code: "FILE_TOO_LARGE",
        message,
        details: [error.code],
      });
      return;
    }
    const requestId = typeof req.headers["x-request-id"] === "string"
      ? req.headers["x-request-id"]
      : undefined;
    console.error("[server-error]", {
      route: `${req.method} ${req.url}`,
      requestId,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    res.status(500).json({
      error: true,
      code: "SERVER_ERROR",
      message: "A server error occurred. Please try again or contact support if the problem persists.",
      details: [],
    });
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
