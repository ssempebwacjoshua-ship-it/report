export type RuntimeEnvironment =
  | "development"
  | "test"
  | "staging"
  | "production"
  | "unknown";

export type RuntimeClassification = {
  environment: RuntimeEnvironment;
  databaseHostClass: "local" | "remote" | "unknown";
  reasons: string[];
  signals: Record<string, string>;
};

const SIGNAL_KEYS = [
  "APP_ENV",
  "NODE_ENV",
  "RAILWAY_ENVIRONMENT",
  "RAILWAY_ENVIRONMENT_NAME",
  "VERCEL_ENV",
  "RENDER_SERVICE_TYPE",
  "FLY_APP_NAME",
  "EXPLICIT_PRODUCTION_MARKER",
];

const LOCAL_DATABASE_NAMES = [
  "school_connect_reports_lab_test",
  "school_connect_reports_lab",
];

function approvedLocalDatabaseHost(env: Record<string, string | undefined>): string | null {
  const value = env.APPROVED_LOCAL_TEST_DB_HOST?.trim().toLowerCase();
  return value || null;
}

function normalize(value: string | undefined): string | null {
  const trimmed = value?.trim().toLowerCase();
  return trimmed || null;
}

function parseDatabaseHost(databaseUrl: string | undefined): string | null {
  if (!databaseUrl) return null;
  try {
    return new URL(databaseUrl).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function classifyDatabaseHost(env: Record<string, string | undefined>): RuntimeClassification["databaseHostClass"] {
  const raw = env.DATABASE_URL;
  if (!raw) return "unknown";

  const host = parseDatabaseHost(raw);
  if (!host) return "unknown";
  if (["localhost", "127.0.0.1"].includes(host)) return "local";
  if (approvedLocalDatabaseHost(env) === host) return "local";
  if (LOCAL_DATABASE_NAMES.some((name) => raw.toLowerCase().includes(name))) return "local";
  return "remote";
}

function environmentFromSignal(value: string): RuntimeEnvironment | null {
  if (["prod", "production"].includes(value)) return "production";
  if (["stage", "staging"].includes(value)) return "staging";
  if (["test", "testing", "ci"].includes(value)) return "test";
  if (["dev", "development", "local"].includes(value)) return "development";
  if (value === "true" || value === "1") return "production";
  if (value === "false" || value === "0") return "development";
  return null;
}

export function classifyRuntimeEnvironment(
  env: Record<string, string | undefined> = process.env,
): RuntimeClassification {
  const signals: Record<string, string> = {};
  const resolved = new Set<RuntimeEnvironment>();
  const reasons: string[] = [];
  const databaseHostClass = classifyDatabaseHost(env);

  for (const key of SIGNAL_KEYS) {
    const value = normalize(env[key]);
    if (!value) continue;
    signals[key] = value;
    const mapped = environmentFromSignal(value);
    if (mapped) resolved.add(mapped);
  }

  if (env.VITEST || env.JEST_WORKER_ID) {
    signals.TEST_RUNNER = env.VITEST ? "vitest" : "jest";
    resolved.add("test");
  }

  if (resolved.has("production") && resolved.size > 1) {
    reasons.push(`Conflicting runtime signals: ${[...resolved].join(", ")}.`);
    return { environment: "unknown", databaseHostClass, reasons, signals };
  }

  if (resolved.size > 1) {
    reasons.push(`Conflicting non-production runtime signals: ${[...resolved].join(", ")}.`);
    return { environment: "unknown", databaseHostClass, reasons, signals };
  }

  const fromSignal = [...resolved][0] ?? null;

  if (fromSignal === "production") {
    return { environment: "production", databaseHostClass, reasons, signals };
  }

  if (fromSignal === "staging") {
    return { environment: "staging", databaseHostClass, reasons, signals };
  }

  if (fromSignal === "test") {
    return { environment: "test", databaseHostClass, reasons, signals };
  }

  if (fromSignal === "development") {
    if (databaseHostClass === "remote") {
      reasons.push("Development/local runtime is connected to a non-local database host.");
      return { environment: "unknown", databaseHostClass, reasons, signals };
    }
    return { environment: "development", databaseHostClass, reasons, signals };
  }

  if (databaseHostClass === "local") {
    return { environment: "development", databaseHostClass, reasons, signals };
  }

  reasons.push("Runtime environment could not be classified safely.");
  return { environment: "unknown", databaseHostClass, reasons, signals };
}

export function isStrictlyEnabled(value: string | undefined): boolean {
  return value === "true";
}

export function assertNonProductionOperation(
  operationName: string,
  env: Record<string, string | undefined> = process.env,
): RuntimeClassification {
  const classification = classifyRuntimeEnvironment(env);
  if (classification.environment === "production") {
    throw new Error(`Refusing operation: ${operationName} is not allowed in production.`);
  }
  if (classification.environment === "unknown") {
    if (classification.databaseHostClass === "remote") {
      throw new Error("Refusing operation: local runtime is connected to a protected production database.");
    }
    throw new Error(`Refusing operation: ${operationName} requires a known non-production runtime.`);
  }
  return classification;
}

export function assertProductionCredentialRepairAllowed(
  input: {
    operationName: string;
    schoolCode: string;
    userEmail: string;
    repairReason?: string;
    auditActor?: string;
    env?: Record<string, string | undefined>;
  },
): RuntimeClassification {
  const env = input.env ?? process.env;
  const classification = classifyRuntimeEnvironment(env);

  if (classification.environment !== "production") {
    throw new Error(`Refusing operation: ${input.operationName} is only valid in production break-glass mode.`);
  }

  if (!isStrictlyEnabled(env.ALLOW_DESTRUCTIVE_OPERATIONS)) {
    throw new Error("Refusing operation: ALLOW_DESTRUCTIVE_OPERATIONS must be true.");
  }
  if (!isStrictlyEnabled(env.ALLOW_PRODUCTION_DATA_REPAIR)) {
    throw new Error("Refusing operation: ALLOW_PRODUCTION_DATA_REPAIR must be true.");
  }
  if (!isStrictlyEnabled(env.ALLOW_PRODUCTION_CREDENTIAL_REPAIR)) {
    throw new Error("Refusing operation: ALLOW_PRODUCTION_CREDENTIAL_REPAIR must be true.");
  }
  if (!input.schoolCode.trim()) {
    throw new Error("Refusing operation: exact school code is required.");
  }
  if (!input.userEmail.trim()) {
    throw new Error("Refusing operation: exact user email is required.");
  }
  if (!input.repairReason?.trim()) {
    throw new Error("Refusing operation: explicit repair reason is required.");
  }
  if (!input.auditActor?.trim()) {
    throw new Error("Refusing operation: audit actor is required.");
  }

  return classification;
}
