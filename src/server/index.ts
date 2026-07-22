import "dotenv/config";
import { randomUUID } from "node:crypto";
import dns from "node:dns";
import path from "node:path";
import fs from "node:fs";
// Force IPv4 DNS resolution ? prevents "fetch failed" on Windows/IPv6 networks when reaching Gemini
dns.setDefaultResultOrder("ipv4first");
import cors, { type CorsOptions } from "cors";
import express, { type ErrorRequestHandler } from "express";
import http from "http";
import { ZodError } from "zod";
import multer from "multer";
import { resolveSchoolContext } from "./middleware/resolveSchoolContext";
import { enforceSchoolRoleAccess } from "./middleware/enforceSchoolRoleAccess";
import { ocrRoutes } from "./routes/ocrRoutes";
import { subscriptionRoutes } from "./routes/subscriptionRoutes";
import geminiMarksImportRoutes from "./routes/geminiMarksImportRoutes";
import { prisma } from "./db/prisma";
import { validateEnv } from "./middleware/validateEnv";
import { createRateLimiter, rateLimitWhen } from "./middleware/rateLimiters";
import { securityHeaders } from "./middleware/securityHeaders";
import { assertPlatformIntegrationConfigured } from "./platformClient";
import { getAllowedBrowserOrigins, getRuntimeDiagnostics, isAllowedBrowserOrigin } from "./config/deployRuntime";
import { registerCommunicationPlatformRoutes, registerCommunicationRoutes } from "./modules/registerCommunicationRoutes";
import { registerNfcRoutes } from "./modules/registerNfcRoutes";
import { registerOwnerRoutes } from "./modules/registerOwnerRoutes";
import { registerPlatformRoutes } from "./modules/registerPlatformRoutes";
import { registerPublicRoutes } from "./modules/registerPublicRoutes";
import { registerReportsRoutes } from "./modules/registerReportsRoutes";
import { registerSmartPagesRoutes } from "./modules/registerSmartPagesRoutes";
import { registerWorkers } from "./modules/registerWorkers";
import { dashboardRoutes } from "./routes/dashboardRoutes";
import { schoolStructureRoutes } from "./routes/schoolStructureRoutes";
import { settingsRoutes } from "./routes/settingsRoutes";
import { studentsRoutes } from "./routes/studentsRoutes";

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
    || pathname.startsWith("/api/integrations/whatsapp/webhook")
    || pathname.startsWith("/api/integrations/sms/webhook")
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

const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // non-browser (curl, server-to-server)
    const allowedOrigins = getAllowedBrowserOrigins();
    return callback(null, isAllowedBrowserOrigin(origin, allowedOrigins));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "Cache-Control", "Pragma", "x-request-id", "x-internal-test-key"],
};

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
  app.use(cors(corsOptions));
  app.options(/.*/, cors(corsOptions));
  app.use(express.json({
    limit: "2mb",
    verify: (req, _res, buf) => {
      (req as express.Request).rawBody = Buffer.from(buf);
    },
  }));

  const authLimiter = createRateLimiter({ name: "auth", windowMs: 60_000, max: 20 });
  const uploadImportLimiter = createRateLimiter({ name: "upload-import", windowMs: 10 * 60_000, max: 120 });
  const publicTokenLimiter = createRateLimiter({ name: "public-token", windowMs: 60_000, max: 120 });
  const webhookLimiter = createRateLimiter({ name: "webhook", windowMs: 60_000, max: 240 });
  const ocrScanLimiter = createRateLimiter({ name: "ocr-scan", windowMs: 10 * 60_000, max: 180 });
  app.use(rateLimitWhen((req) => isAuthAttemptPath(req.path), authLimiter));
  app.use(rateLimitWhen((req) => req.method !== "GET" && isUploadOrImportPath(req.path), uploadImportLimiter));
  app.use(rateLimitWhen((req) => isPublicTokenPath(req.path), publicTokenLimiter));
  app.use(rateLimitWhen((req) => req.method !== "GET" && isOcrOrScanPath(req.path), ocrScanLimiter));
  app.use(rateLimitWhen((req) => req.path.startsWith("/api/integrations/whatsapp/webhook") || req.path.startsWith("/api/integrations/sms/webhook"), webhookLimiter));

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
  registerPublicRoutes(app);

  // Platform-owner provisioning ? protected by PLATFORM_ADMIN_KEY, not by school JWT
  registerPlatformRoutes(app);

  // Platform owner console APIs ? protected by JWT with isPlatformOwner, not by school context
  registerOwnerRoutes(app);

  // Internal diagnostic routes ? protected by their own x-internal-test-key, not by school context
  registerCommunicationPlatformRoutes(app);

  // Tenant isolation: resolve school context from JWT or (dev-only) schoolCode param
  app.use(resolveSchoolContext);

  app.use(enforceSchoolRoleAccess);

  // Protected data routes ? all have req.school set by the middleware above
  app.use(dashboardRoutes());
  registerReportsRoutes(app);
  registerCommunicationRoutes(app);
  app.use(studentsRoutes());
  app.use(schoolStructureRoutes());
  app.use(settingsRoutes());
  app.use(ocrRoutes());
  app.use(subscriptionRoutes());
  registerNfcRoutes(app);
  registerSmartPagesRoutes(app);
  app.use(geminiMarksImportRoutes());

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
  console.log("[startup] Runtime diagnostics:", getRuntimeDiagnostics());
  console.log("[startup] Node DNS result order: ipv4first (forced)");
  console.log("[startup] Node version:", process.version);
  registerWorkers(prisma);
  const httpServer = http.createServer(createServer());
  httpServer.requestTimeout = 120_000;
  httpServer.headersTimeout = 125_000;
  httpServer.listen(port, "0.0.0.0", () => {
    console.log(`Reports lab API listening on port ${port}`);
  });
}

