import "dotenv/config";
import { randomUUID } from "node:crypto";
import dns from "node:dns";
import path from "node:path";
import fs from "node:fs";
// Force IPv4 DNS resolution — prevents "fetch failed" on Windows/IPv6 networks when reaching Gemini
dns.setDefaultResultOrder("ipv4first");
import cors from "cors";
import express, { type ErrorRequestHandler } from "express";
import http from "http";
import { ZodError } from "zod";
import multer from "multer";
import { dashboardRoutes } from "./routes/dashboardRoutes";
import { healthRoutes } from "./routes/healthRoutes";
import { reportsRoutes } from "./routes/reportsRoutes";
import { importsRoutes } from "./routes/importsRoutes";
import { studentsRoutes } from "./routes/studentsRoutes";
import { marksheetsRoutes } from "./routes/marksheetsRoutes";
import { settingsRoutes } from "./routes/settingsRoutes";
import { schoolStructureRoutes } from "./routes/schoolStructureRoutes";
import { resolveSchoolContext } from "./middleware/resolveSchoolContext";
import { authRoutes } from "./routes/authRoutes";
import { platformAdminRoutes } from "./routes/platformAdminRoutes";
import { platformOwnerRoutes } from "./routes/platformOwnerRoutes";
import { reportIssueRoutes } from "./routes/reportIssueRoutes";
import { reportAssistantRoutes } from "./routes/reportAssistantRoutes";
import { releaseCenterRoutes } from "./routes/releaseCenterRoutes";
import { parentRoutes } from "./routes/parentRoutes";
import { verifyRoutes } from "./routes/verifyRoutes";
import { ocrRoutes } from "./routes/ocrRoutes";
import { documentCleanerRoutes } from "./routes/documentCleanerRoutes";
import { subscriptionRoutes } from "./routes/subscriptionRoutes";
import { documentIntelligenceRoutes } from "./routes/documentIntelligenceRoutes";
import { creatorAuthRoutes } from "./routes/creatorAuthRoutes";
import { collectionRoutes } from "./routes/collectionRoutes";
import { bulkGenerationRoutes } from "./routes/bulkGenerationRoutes";
import { startBulkGenerationWorker } from "./services/bulkGenerationService";
import geminiOcrRoutes from "./routes/geminiOcrRoutes";
import geminiRosterRoutes from "./routes/geminiRosterRoutes";
import geminiMarksImportRoutes from "./routes/geminiMarksImportRoutes";
import { prisma } from "./db/prisma";
import { recoverStaleStudentImportJobs } from "./services/studentImportService";
import { validateEnv } from "./middleware/validateEnv";

export function createServer() {
  const app = express();
  app.use(cors({
    origin: (origin, callback) => {
      const allowed = process.env.CLIENT_ORIGIN?.trim();
      if (!origin) return callback(null, true); // non-browser (curl, server-to-server)
      if (allowed) {
        return callback(null, origin === allowed || /^https?:\/\/localhost(:\d+)?$/.test(origin));
      }
      return callback(null, true); // no CLIENT_ORIGIN — allow all (local dev)
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-request-id", "x-internal-test-key"],
  }));
  app.use(express.json({ limit: "2mb" }));

  app.use(
    "/templates",
    express.static(path.join(process.cwd(), "public", "templates")),
  );

  // Public routes — no authentication required
  app.use(healthRoutes());
  app.use(authRoutes());
  app.use(verifyRoutes());
  app.use(parentRoutes());

  // Document Intelligence Engine — creator auth accepts both school JWTs and external creator JWTs
  app.use("/api/creator", creatorAuthRoutes());
  app.use("/api/smart-documents", documentIntelligenceRoutes());
  app.use("/api/collections", collectionRoutes());
  app.use("/api/bulk-jobs", bulkGenerationRoutes());

  // Platform-owner provisioning — protected by PLATFORM_ADMIN_KEY, not by school JWT
  app.use(platformAdminRoutes());

  // Platform owner console APIs — protected by JWT with isPlatformOwner, not by school context
  app.use(platformOwnerRoutes());

  // Internal diagnostic routes — protected by their own x-internal-test-key, not by school context
  app.use("/api", geminiOcrRoutes);
  app.use("/api", geminiRosterRoutes);

  // Tenant isolation: resolve school context from JWT or (dev-only) schoolCode param
  app.use(resolveSchoolContext);

  // Protected data routes — all have req.school set by the middleware above
  app.use(dashboardRoutes());
  app.use(reportsRoutes());
  app.use(reportIssueRoutes());
  app.use(reportAssistantRoutes());
  app.use(releaseCenterRoutes());
  app.use(importsRoutes());
  app.use(studentsRoutes());
  app.use(marksheetsRoutes());
  app.use(schoolStructureRoutes());
  app.use(settingsRoutes());
  app.use(ocrRoutes());
  app.use(documentCleanerRoutes());
  app.use(subscriptionRoutes());
  app.use(geminiMarksImportRoutes());

  // Static file serving + SPA fallback (production only — never in test env, skipped when dist absent)
  const distDir = path.join(process.cwd(), "dist");
  if (process.env.NODE_ENV !== "test" && fs.existsSync(path.join(distDir, "index.html"))) {
    // /manifest.json alias — some Chrome versions probe this exact path
    app.get("/manifest.json", (_req, res) => {
      res.setHeader("Content-Type", "application/manifest+json");
      res.sendFile(path.join(distDir, "manifest.webmanifest"));
    });
    // Serve hashed assets (1-year cache), HTML no-cache
    app.use(express.static(distDir, {
      maxAge: "365d",
      setHeaders(res, filePath) {
        if (filePath.endsWith(".html")) res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      },
    }));
    // SPA fallback — non-API GET requests get index.html (React Router handles routing)
    app.get(/^(?!\/api\/).*/, (req, res) => {
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.sendFile(path.join(distDir, "index.html"));
    });
  }

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
        ? "File is too large. Please upload a smaller image (max 10 MB)."
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
      : randomUUID();
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
      requestId,
      details: [],
    });
  };
  app.use(errorHandler);

  return app;
}

if (process.env.NODE_ENV !== "test") {
  const envResult = validateEnv();
  for (const warning of envResult.warnings) console.warn("[env-check] WARNING:", warning);
  if (!envResult.valid) {
    for (const error of envResult.errors) console.error("[env-check] FATAL:", error);
    process.exit(1);
  }

  const port = Number(process.env.PORT ?? 4300);
  const geminiModel = process.env.GEMINI_MODEL ?? "gemini-2.5-flash (default)";
  const geminiKeyStatus = process.env.GEMINI_API_KEY ? "yes" : "no";
  console.log("[startup] Gemini routes: /api/test-gemini-marks, /api/test-gemini-roster, /api/marks-import/scan/extract, /api/test-gemini-health");
  console.log("[startup] Gemini model:", geminiModel);
  console.log("[startup] Gemini key configured:", geminiKeyStatus);
  console.log("[startup] Node DNS result order: ipv4first (forced)");
  console.log("[startup] Node version:", process.version);
  void recoverStaleStudentImportJobs(prisma).catch((error) => console.error("Failed to recover stale student import jobs", error));
  startBulkGenerationWorker();
  const httpServer = http.createServer(createServer());
  httpServer.requestTimeout = 120_000;
  httpServer.headersTimeout = 125_000;
  httpServer.listen(port, "0.0.0.0", () => {
    console.log(`Reports lab API listening on port ${port}`);
  });
}
