import { classifyRuntimeEnvironment } from "../utils/productionSafety";

const LOCALHOST_ORIGIN = /^https?:\/\/(?:localhost|127\.0\.0\.1)(:\d+)?$/i;

export const REQUIRED_PRODUCTION_CORS_ORIGINS = [
  "https://schools.ssamenj.online",
  "https://report-sigma-one.vercel.app",
  "https://ssamenj.online",
  "https://www.ssamenj.online",
] as const;

export const APP_BUILD_VERSION = (
  process.env.RAILWAY_GIT_COMMIT_SHA
  || process.env.VERCEL_GIT_COMMIT_SHA
  || process.env.RENDER_GIT_COMMIT
  || process.env.SOURCE_VERSION
  || process.env.GIT_COMMIT_SHA
  || process.env.npm_package_version
  || "development"
).trim();

export const APP_BUILD_TIME = process.env.BUILD_TIME?.trim() || null;

export function normalizeOrigin(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

function collectConfiguredOrigins(env: Record<string, string | undefined>) {
  const configured = [
    env.CLIENT_ORIGIN,
    env.CORS_ORIGIN,
    env.ALLOWED_ORIGINS,
  ]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .flatMap((value) => value.split(/[,\n]/))
    .map((value) => value.trim())
    .filter(Boolean);

  const origins = new Set<string>();
  for (const value of configured) {
    const normalized = normalizeOrigin(value);
    origins.add(normalized);
    try {
      const parsed = new URL(normalized);
      if (parsed.hostname === "ssamenj.online") origins.add("https://www.ssamenj.online");
      if (parsed.hostname === "www.ssamenj.online") origins.add("https://ssamenj.online");
    } catch {
      origins.add(normalized);
    }
  }
  return origins;
}

export function getAllowedBrowserOrigins(env: Record<string, string | undefined> = process.env) {
  const runtime = classifyRuntimeEnvironment(env);
  const configuredOrigins = collectConfiguredOrigins(env);

  if (configuredOrigins.size > 0) {
    return configuredOrigins;
  }

  if (!runtime.isProduction) {
    return null;
  }

  return new Set<string>(REQUIRED_PRODUCTION_CORS_ORIGINS);
}

export function isAllowedBrowserOrigin(
  origin: string,
  allowedOrigins: Set<string> | null,
  env: Record<string, string | undefined> = process.env,
) {
  const normalized = normalizeOrigin(origin);
  const runtime = classifyRuntimeEnvironment(env);
  if (allowedOrigins) {
    if (allowedOrigins.has(normalized)) return true;
    return !runtime.isProduction && LOCALHOST_ORIGIN.test(normalized);
  }
  return !runtime.isProduction && LOCALHOST_ORIGIN.test(normalized);
}

export function getRuntimeDiagnostics(env: Record<string, string | undefined> = process.env) {
  const runtime = classifyRuntimeEnvironment(env);
  return {
    runtime: runtime.isProduction ? "production" : env.NODE_ENV?.trim() || "development",
    appVersion: APP_BUILD_VERSION,
    buildTime: APP_BUILD_TIME,
    allowedOrigins: Array.from(getAllowedBrowserOrigins(env) ?? []).sort(),
  };
}
