import "dotenv/config";
import { randomUUID } from "node:crypto";
import dns from "node:dns";
import path from "node:path";
import fs from "node:fs";
// Force IPv4 DNS resolution ? prevents "fetch failed" on Windows/IPv6 networks when reaching Gemini
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
import { studentsRoutes, studentsPublicRoutes } from "./routes/studentsRoutes";
import { marksheetsRoutes } from "./routes/marksheetsRoutes";
import { settingsRoutes } from "./routes/settingsRoutes";
import { schoolStructureRoutes } from "./routes/schoolStructureRoutes";
import { resolveSchoolContext } from "./middleware/resolveSchoolContext";
import { enforceSchoolRoleAccess } from "./middleware/enforceSchoolRoleAccess";
import { authRoutes } from "./routes/authRoutes";
import { platformAdminRoutes } from "./routes/platformAdminRoutes";
import { platformOwnerRoutes } from "./routes/platformOwnerRoutes";
import { reportIssueRoutes } from "./routes/reportIssueRoutes";
import { reportAssistantRoutes } from "./routes/reportAssistantRoutes";
import { promotionRoutes } from "./routes/promotionRoutes";
import { releaseCenterRoutes } from "./routes/releaseCenterRoutes";
import { communicationRoutes } from "./routes/communicationRoutes";
import { parentRoutes } from "./routes/parentRoutes";
import { verifyRoutes } from "./routes/verifyRoutes";
import { ocrRoutes } from "./routes/ocrRoutes";
import { subscriptionRoutes } from "./routes/subscriptionRoutes";
import { studentCredentialRoutes } from "./routes/studentCredentialRoutes";
import { nfcOperationsRoutes, nfcPublicRoutes } from "./routes/nfcOperationsRoutes";
import { staffUsersRoutes } from "./routes/staffUsersRoutes";
import { nfcTagsPublicRoutes, nfcTagsRoutes } from "./routes/nfcTagsRoutes";
import { nfcOfflineRoutes } from "./routes/nfcOfflineRoutes";
import { readerGatewayRoutes } from "./routes/readerGatewayRoutes";
import { documentIntelligenceRoutes } from "./routes/documentIntelligenceRoutes";
import { creatorAuthRoutes } from "./routes/creatorAuthRoutes";
import { collectionRoutes } from "./routes/collectionRoutes";
import { bulkGenerationRoutes } from "./routes/bulkGenerationRoutes";
import { documentOsRoutes } from "./routes/documentOsRoutes";
import { supportRoutes } from "./routes/supportRoutes";
import { smartPagesBillingRoutes } from "./routes/smartPagesBillingRoutes";
import { smartPagesTemplateRoutes } from "./routes/smartPagesTemplateRoutes";
import { startBulkGenerationWorker } from "./services/bulkGenerationService";
import { startDocumentExtractionWorker } from "./services/documentIntelligenceService";
import geminiOcrRoutes from "./routes/geminiOcrRoutes";
import geminiRosterRoutes from "./routes/geminiRosterRoutes";
import geminiMarksImportRoutes from "./routes/geminiMarksImportRoutes";
import geminiOcrBenchmarkRoutes from "./routes/geminiOcrBenchmarkRoutes";
import { prisma } from "./db/prisma";
import { recoverStaleStudentImportJobs } from "./services/studentImportService";
import { validateEnv } from "./middleware/validateEnv";
import { createRateLimiter, rateLimitWhen } from "./middleware/rateLimiters";
import { securityHeaders } from "./middleware/securityHeaders";
import { checkNfcWristbandSchema } from "./utils/nfcSchemaCheck";
import { assertPlatformIntegrationConfigured } from "./platformClient";

const LOCALHOST_ORIGIN = /^https?:\/\/(?:localhost|127\.0\.0\.1)(:\d+)?$/;
const CANONICAL_PRODUCTION_ORIGINS = new Set([
  "https://ssamenj.online",
  "https://www.ssamenj.online",
]);

function normalizeOrigin(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

function getAllowedBrowserOrigins() {
  const allowed = process.env.CLIENT_ORIGIN?.trim();
  const origins = new Set<string>();
  if (allowed) {
    const normalized = normalizeOrigin(allowed);
    origins.add(normalized);
    try {
      const parsed = new URL(normalized);
      if (parsed.hostname === "ssamenj.online") origins.add("https://www.ssamenj.online");
      if (parsed.hostname === "www.ssamenj.online") origins.add("https://ssamenj.online");
    } catch {
      // Leave the configured origin as-is; validateEnv will fail closed for bad production config.
    }
  } else if (process.env.NODE_ENV !== "production") {
    return null;
  } else {
    for (const origin of CANONICAL_PRODUCTION_ORIGINS) origins.add(origin);
  }
  return origins;
}

function isAllowedBrowserOrigin(origin: string, allowedOrigins: Set<string> | null): boolean {
  const normalized = normalizeOrigin(origin);
  if (allowedOrigins) {
    if (allowedOrigins.has(normalized)) return true;
    return process.env.NODE_ENV !== "production" && LOCALHOST_ORIGIN.test(normalized);
  }
  return process.env.NODE_ENV !== "production" && LOCALHOST_ORIGIN.test(normalized);
}

function isAuthAttemptPath(pathname: string) {
  return pathname === "/api/auth/login"
    || pathname === "/api/auth/forgot-password"
    || pathname === "/api/auth/reset-password"
    || pathname === "/api/auth/account-setup"
    || pathname.endsWith("/resend-invitation")
    || pathname === "/api/creator/login"
    || pathname === "/api/creator/signup";
}

function isUploadOrImportPath(pathname: string) {
  return pathname.startsWith("/api/imports/")
    || pathname.startsWith("/api/marks-import/")
    || pathname.startsWith("/api/marksheets/")
    || pathname.includes("/import-jobs/upload")
    || pathname.includes("/passport-photo")
    || pathname.includes("/import/")
    || pathname.includes("/upload")
    || pathname.endsWith("/import-csv");
}

function isPublicTokenPath(pathname: string) {
  return pathname.startsWith("/api/verify/")
    || pathname.startsWith("/api/p/")
    || pathname.startsWith("/api/nfc/t/")
    || pathname.startsWith("/api/nfc/resolve/")
    || pathname.startsWith("/api/readers/")
    || /^\/api\/smart-documents\/p\/[^/]+/.test(pathname);
}

function isOcrOrScanPath(pathname: string) {
  return pathname.includes("/scan")
    || pathname.includes("/ocr")
    || pathname.includes("gemini")
    || pathname === "/internal/ocr/read";
}

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
    if (error instanceof ZodError) {
      const fieldErrors = error.flatten().fieldErrors;
      const details = error.issues
        .map((issue) => issue.message)
        .filter((message): message is string => typeof message === "string" && message.trim().length > 0);
      const requestId = typeof req.headers["x-request-id"] === "string"
        ? req.headers["x-request-id"]
        : randomUUID();
      res.status(400).json({
        ok: false,
        error: true,
        code: "VALIDATION_ERROR",
        message: "Please check the submitted details.",
        requestId,
        fieldErrors,
        details,
      });
      return;
    }
    if (error instanceof multer.MulterError) {
      const message = error.code === "LIMIT_FILE_SIZE"
        ? (req.url.includes("/passport-photo") || req.url.includes("/assets/"))
          ? "File is too large. Please upload a smaller image (max 2 MB)."
          : "File is too large. Please upload a smaller image (max 10 MB)."
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
    const status = typeof (error as { status?: unknown })?.status === "number"
      ? Math.max(400, Math.min(599, (error as { status: number }).status))
      : 500;
    const isProduction = process.env.NODE_ENV === "production";
    console.error("[server-error]", {
      route: `${req.method} ${req.url}`,
      requestId,
      status,
      message: isProduction && status >= 500
        ? "Internal server error"
        : error instanceof Error ? error.message : String(error),
      stack: !isProduction && error instanceof Error ? error.stack : undefined,
    });
    const exposeMessage = (error as { expose?: unknown })?.expose === true;
    const safeDetails = !isProduction && exposeMessage && (error as { details?: unknown })?.details
      ? (error as { details: unknown }).details
      : [];
    res.status(status).json({
      ok: false,
      error: true,
      code: status >= 500 ? "SERVER_ERROR" : "REQUEST_FAILED",
      message: error instanceof Error && (status < 500 || (!isProduction && exposeMessage)) ? error.message : "A server error occurred. Please try again or contact support if the problem persists.",
      requestId,
      details: safeDetails,
    });
};

export function createServer() {
  const app = express();
  app.use(securityHeaders);
  app.use(cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true); // non-browser (curl, server-to-server)
      const allowedOrigins = getAllowedBrowserOrigins();
      return callback(null, isAllowedBrowserOrigin(origin, allowedOrigins));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-request-id", "x-internal-test-key"],
  }));
  app.use(express.json({ limit: "2mb" }));

  const authLimiter = createRateLimiter({ name: "auth", windowMs: 60_000, max: 20 });
  const uploadImportLimiter = createRateLimiter({ name: "upload-import", windowMs: 10 * 60_000, max: 120 });
  const publicTokenLimiter = createRateLimiter({ name: "public-token", windowMs: 60_000, max: 120 });
  const ocrScanLimiter = createRateLimiter({ name: "ocr-scan", windowMs: 10 * 60_000, max: 180 });
  app.use(rateLimitWhen((req) => isAuthAttemptPath(req.path), authLimiter));
  app.use(rateLimitWhen((req) => req.method !== "GET" && isUploadOrImportPath(req.path), uploadImportLimiter));
  app.use(rateLimitWhen((req) => isPublicTokenPath(req.path), publicTokenLimiter));
  app.use(rateLimitWhen((req) => req.method !== "GET" && isOcrOrScanPath(req.path), ocrScanLimiter));

  app.use(
    "/templates",
    express.static(path.join(process.cwd(), "public", "templates")),
  );
  app.use(
    "/uploads",
    express.static(path.join(process.cwd(), "public", "uploads"), {
      maxAge: "7d",
      fallthrough: true,
    }),
  );

  // Public routes ? no authentication required
  app.use(healthRoutes());
  app.use(authRoutes());
  app.use(verifyRoutes());
  app.use(parentRoutes());
  app.use(studentsPublicRoutes());
  app.use(nfcPublicRoutes());
  app.use(nfcTagsPublicRoutes());
  app.use(readerGatewayRoutes());

  // Document Intelligence Engine ? creator auth accepts both school JWTs and external creator JWTs
  app.use("/api/creator", creatorAuthRoutes());
  app.use("/api/smart-documents", documentIntelligenceRoutes());
  app.use("/api/document-os", documentOsRoutes());
  app.use("/api/collections", collectionRoutes());
  app.use("/api/bulk-jobs", bulkGenerationRoutes());

  // Platform-owner provisioning ? protected by PLATFORM_ADMIN_KEY, not by school JWT
  app.use(platformAdminRoutes());

  // Platform owner console APIs ? protected by JWT with isPlatformOwner, not by school context
  app.use(platformOwnerRoutes());

  // Internal diagnostic routes ? protected by their own x-internal-test-key, not by school context
  app.use("/api", geminiOcrRoutes);
  app.use("/api", geminiOcrBenchmarkRoutes);
  app.use("/api", geminiRosterRoutes);
  app.use(supportRoutes());

  // Tenant isolation: resolve school context from JWT or (dev-only) schoolCode param
  app.use(resolveSchoolContext);

  app.use(enforceSchoolRoleAccess);

  // Protected data routes ? all have req.school set by the middleware above
  app.use(dashboardRoutes());
  app.use(reportsRoutes());
  app.use(reportIssueRoutes());
  app.use(reportAssistantRoutes());
  app.use(releaseCenterRoutes());
  app.use(communicationRoutes());
  app.use(importsRoutes());
  app.use(studentsRoutes());
  app.use(marksheetsRoutes());
  app.use(schoolStructureRoutes());
  app.use(settingsRoutes());
  app.use(ocrRoutes());
  app.use(subscriptionRoutes());
  app.use(studentCredentialRoutes());
  app.use(nfcOperationsRoutes());
  app.use(nfcTagsRoutes());
  app.use(nfcOfflineRoutes());
  app.use(staffUsersRoutes());
  app.use(smartPagesBillingRoutes());
  app.use(smartPagesTemplateRoutes());
  app.use(geminiMarksImportRoutes());
  app.use(promotionRoutes());

  // Static file serving + SPA fallback (production only ? never in test env, skipped when dist absent)
  const distDir = path.join(process.cwd(), "dist");
  if (process.env.NODE_ENV !== "test" && fs.existsSync(path.join(distDir, "index.html"))) {
    // /manifest.json alias ? some Chrome versions probe this exact path
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
    // SPA fallback ? non-API GET requests get index.html (React Router handles routing)
    app.get(/^(?!\/api\/).*/, (req, res) => {
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.sendFile(path.join(distDir, "index.html"));
    });
  }

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

  if (process.env.SSAMENJ_PLATFORM_INTEGRATION_ENABLED === "true") {
    assertPlatformIntegrationConfigured();
  }

  const port = Number(process.env.PORT ?? 4300);
  const geminiKeyStatus = process.env.GEMINI_API_KEY ? "yes" : "no";
  const geminiModelFast = process.env.SMART_PAGES_GEMINI_FAST_MODEL?.trim() || process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
  const geminiModelHighAccuracy = process.env.SMART_PAGES_GEMINI_HIGH_ACCURACY_MODEL?.trim() || geminiModelFast;
  const geminiModelStable = process.env.SMART_PAGES_GEMINI_STABLE_ACCURACY_MODEL?.trim() || "gemini-2.5-flash";
  console.log("[startup] Gemini routes: /api/test-gemini-marks, /api/test-gemini-roster, /api/marks-import/scan/extract, /api/test-gemini-health, /api/test-gemini-benchmark, /api/test-gemini-document-benchmark");
  console.log("[startup] Gemini model (fast):", geminiModelFast);
  console.log("[startup] Gemini model (high-accuracy):", geminiModelHighAccuracy);
  console.log("[startup] Gemini model (stable):", geminiModelStable);
  console.log("[startup] Gemini key configured:", geminiKeyStatus);
  console.log("[startup] Node DNS result order: ipv4first (forced)");
  console.log("[startup] Node version:", process.version);
  void recoverStaleStudentImportJobs(prisma).catch((error) => console.error("Failed to recover stale student import jobs", error));
  void checkNfcWristbandSchema(prisma).then((status) => {
    if (!status.ok) {
      console.warn("[startup] NFC wristband schema incomplete. Missing:", status.missing.join(", "));
      console.warn("[startup] Fix: npx prisma migrate deploy");
    } else {
      console.log("[startup] NFC wristband schema OK");
    }
  });
  startBulkGenerationWorker();
  startDocumentExtractionWorker();
  const httpServer = http.createServer(createServer());
  httpServer.requestTimeout = 120_000;
  httpServer.headersTimeout = 125_000;
  httpServer.listen(port, "0.0.0.0", () => {
    console.log(`Reports lab API listening on port ${port}`);
  });
}

