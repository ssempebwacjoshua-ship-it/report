const DEV_JWT_SECRET = "dev-secret-change-in-production";
const MIN_JWT_SECRET_LENGTH = 32;

export type EnvValidationResult = {
  valid: boolean;
  errors: string[];
  warnings: string[];
};

/**
 * Validate that required environment variables are present and safe.
 * Accepts an env object for testability â€” defaults to process.env.
 *
 * Production rules (NODE_ENV=production):
 *  - JWT_SECRET must be set, not the dev default, and at least 32 characters.
 *  - DATABASE_URL must be set.
 *  - CLIENT_ORIGIN must be set (without it CORS allows all origins).
 *
 * Always (all environments):
 *  - Any VITE_-prefixed var that looks like an API key is an error â€” it would
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
    }

    if (!env.CLIENT_ORIGIN) {
      errors.push("CLIENT_ORIGIN is not set. CORS will accept requests from any origin.");
    }

    if (!env.PLATFORM_ADMIN_KEY) {
      warnings.push(
        "PLATFORM_ADMIN_KEY is not set. The /api/platform/schools provisioning endpoint will be unavailable (503).",
      );
    }
  }

  // Any VITE_-prefixed API key is bundled into the frontend JS bundle â€” a secret leak.
  for (const key of Object.keys(env)) {
    if (key.startsWith("VITE_") && /API.?KEY|SECRET|TOKEN/i.test(key)) {
      errors.push(
        `${key} is prefixed with VITE_ and will be exposed in the frontend bundle. API keys and secrets must not use the VITE_ prefix.`,
      );
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

