const DEV_JWT_SECRET = "dev-secret-change-in-production";
const MIN_JWT_SECRET_LENGTH = 32;

function isLocalUrl(value: string) {
  return /^https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0)(?::\d+)?(?:\/|$)/i.test(value.trim());
}

function isLocalDatabaseUrl(value: string) {
  return /@(?:localhost|127\.0\.0\.1|0\.0\.0\.0)(?::\d+)?[/?]/i.test(value)
    || /school_connect_reports_lab_test/i.test(value);
}

export type EnvValidationResult = {
  valid: boolean;
  errors: string[];
  warnings: string[];
};

/**
 * Validate that required environment variables are present and safe.
 * Accepts an env object for testability ? defaults to process.env.
 *
 * Production rules (NODE_ENV=production):
 *  - JWT_SECRET must be set, not the dev default, and at least 32 characters.
 *  - DATABASE_URL must be set.
 *  - CLIENT_ORIGIN must be set (without it CORS allows all origins).
 *
 * Always (all environments):
 *  - Any VITE_-prefixed var that looks like an API key is an error ? it would
 *    be bundled into the frontend and exposed to the browser.
 */
export function validateEnv(env: Record<string, string | undefined> = process.env): EnvValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const isProd = env.NODE_ENV === "production";

  if (isProd) {
    if (!env.JWT_SECRET) {
      errors.push("JWT_SECRET is not set. The server cannot sign authentication tokens safely.");
    } else if (env.JWT_SECRET === DEV_JWT_SECRET) {
      errors.push(
        "JWT_SECRET is the development placeholder. Set a strong random secret in production (e.g. openssl rand -hex 32).",
      );
    } else if (env.JWT_SECRET.length < MIN_JWT_SECRET_LENGTH) {
      errors.push(
        `JWT_SECRET is too short (${env.JWT_SECRET.length} chars). Use at least ${MIN_JWT_SECRET_LENGTH} characters.`,
      );
    }

    if (!env.DATABASE_URL) {
      errors.push("DATABASE_URL is not set. The server cannot connect to the database.");
    } else if (isLocalDatabaseUrl(env.DATABASE_URL)) {
      errors.push(
        "DATABASE_URL points at localhost or the local test database. Production must use the Railway/Postgres production database, not a local/test database.",
      );
    }

    if (!env.CLIENT_ORIGIN) {
      errors.push("CLIENT_ORIGIN is not set. CORS will accept requests from any origin.");
    } else if (isLocalUrl(env.CLIENT_ORIGIN)) {
      errors.push("CLIENT_ORIGIN points at localhost. Production must use the real frontend origin.");
    }

    if (env.APP_BASE_URL && isLocalUrl(env.APP_BASE_URL)) {
      errors.push("APP_BASE_URL points at localhost. Parent report links must use the real production report domain.");
    }

    if (env.PUBLIC_APP_URL && isLocalUrl(env.PUBLIC_APP_URL)) {
      errors.push("PUBLIC_APP_URL points at localhost. Public report links must use the real production report domain.");
    }

    if (!env.APP_BASE_URL && !env.PUBLIC_APP_URL) {
      warnings.push(
        "APP_BASE_URL / PUBLIC_APP_URL is not set. Parent links will fall back to CLIENT_ORIGIN; set a branded report domain before releasing reports to parents.",
      );
    }

    if (!env.PLATFORM_ADMIN_KEY) {
      warnings.push(
        "PLATFORM_ADMIN_KEY is not set. The /api/platform/schools provisioning endpoint will be unavailable (503).",
      );
    }

    if (env.SSAMENJ_PLATFORM_INTEGRATION_ENABLED === "true") {
      if (!env.SSAMENJ_PLATFORM_URL) {
        errors.push("SSAMENJ_PLATFORM_URL is required when SSAMENJ_PLATFORM_INTEGRATION_ENABLED=true.");
      }
      if (!env.SSAMENJ_PLATFORM_SERVICE_TOKEN) {
        errors.push("SSAMENJ_PLATFORM_SERVICE_TOKEN is required when SSAMENJ_PLATFORM_INTEGRATION_ENABLED=true.");
      }
    }

    if (!env.INTERNAL_TEST_KEY) {
      warnings.push(
        "INTERNAL_TEST_KEY is not set. Protected diagnostics such as /api/health/env will be unavailable in production.",
      );
    }
  }

  // Any VITE_-prefixed API key is bundled into the frontend JS bundle ? a secret leak.
  for (const key of Object.keys(env)) {
    if (key.startsWith("VITE_") && /API.?KEY|SECRET|TOKEN/i.test(key)) {
      errors.push(
        `${key} is prefixed with VITE_ and will be exposed in the frontend bundle. API keys and secrets must not use the VITE_ prefix.`,
      );
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

