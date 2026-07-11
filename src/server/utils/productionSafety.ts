export const DESTRUCTIVE_CONFIRMATION_TOKEN = "I_UNDERSTAND_THIS_MUTATES_SCHOOL_DATA";

export type RuntimeEnvironment =
  | "development"
  | "test"
  | "preview"
  | "staging"
  | "production"
  | "ambiguous";

export type RuntimeClassification = {
  environment: RuntimeEnvironment;
  isProduction: boolean;
  isAmbiguous: boolean;
  signals: Record<string, string>;
  reasons: string[];
};

const SIGNAL_KEYS = [
  "APP_ENV",
  "NODE_ENV",
  "RAILWAY_ENVIRONMENT",
  "RAILWAY_ENVIRONMENT_NAME",
  "VERCEL_ENV",
  "RENDER_SERVICE_TYPE",
  "FLY_APP_NAME",
] as const;

function normalizeSignal(value: string | undefined): string | null {
  const normalized = value?.trim().toLowerCase();
  return normalized || null;
}

function environmentFromValue(value: string): Exclude<RuntimeEnvironment, "ambiguous"> | null {
  if (["prod", "production"].includes(value)) return "production";
  if (["stage", "staging"].includes(value)) return "staging";
  if (["preview", "pr", "pull-request"].includes(value)) return "preview";
  if (["test", "testing", "ci"].includes(value)) return "test";
  if (["dev", "development", "local"].includes(value)) return "development";
  return null;
}

export function classifyRuntimeEnvironment(
  env: Record<string, string | undefined> = process.env,
): RuntimeClassification {
  const signals: Record<string, string> = {};
  const resolved = new Map<string, RuntimeEnvironment>();
  const reasons: string[] = [];

  for (const key of SIGNAL_KEYS) {
    const value = normalizeSignal(env[key]);
    if (!value) continue;
    signals[key] = value;
    const mapped = environmentFromValue(value);
    if (mapped) resolved.set(key, mapped);
  }

  if (env.VITEST || env.JEST_WORKER_ID) {
    signals.TEST_RUNNER = env.VITEST ? "vitest" : "jest";
    resolved.set("TEST_RUNNER", "test");
  }

  const unique = new Set(resolved.values());
  if (unique.has("production")) {
    const conflicting = [...unique].filter((value) => value !== "production");
    if (conflicting.length > 0) {
      reasons.push(`Conflicting production/non-production runtime signals: ${[...unique].join(", ")}.`);
      return { environment: "ambiguous", isProduction: false, isAmbiguous: true, signals, reasons };
    }
    return { environment: "production", isProduction: true, isAmbiguous: false, signals, reasons };
  }

  if (unique.size > 1) {
    reasons.push(`Conflicting non-production runtime signals: ${[...unique].join(", ")}.`);
    return { environment: "ambiguous", isProduction: false, isAmbiguous: true, signals, reasons };
  }

  const environment = [...unique][0] ?? "development";
  return { environment, isProduction: false, isAmbiguous: false, signals, reasons };
}

export function isProductionEnvironment(env: Record<string, string | undefined> = process.env): boolean {
  const classification = classifyRuntimeEnvironment(env);
  if (classification.isAmbiguous) {
    throw new Error(`Runtime environment is ambiguous: ${classification.reasons.join(" ")}`);
  }
  return classification.isProduction;
}

export function assertNonProductionDestructiveOperation(input: {
  operation: string;
  env?: Record<string, string | undefined>;
  allowFlag?: string | undefined;
  confirmationToken?: string | undefined;
  expectedConfirmationToken?: string;
}): RuntimeClassification {
  const env = input.env ?? process.env;
  const classification = classifyRuntimeEnvironment(env);
  const allowFlag = input.allowFlag ?? env.ALLOW_DESTRUCTIVE_OPERATIONS;
  const confirmationToken = input.confirmationToken ?? env.CONFIRM_DESTRUCTIVE_OPERATION;
  const expectedConfirmationToken = input.expectedConfirmationToken ?? DESTRUCTIVE_CONFIRMATION_TOKEN;

  if (classification.isAmbiguous) {
    throw new Error(
      `Refusing destructive operation "${input.operation}" because runtime environment is ambiguous. ${classification.reasons.join(" ")}`,
    );
  }

  if (classification.isProduction) {
    throw new Error(
      `Refusing destructive operation "${input.operation}" in production. ALLOW_DESTRUCTIVE_OPERATIONS cannot override production safety.`,
    );
  }

  if (allowFlag !== "true") {
    throw new Error(
      `Refusing destructive operation "${input.operation}". Set ALLOW_DESTRUCTIVE_OPERATIONS=true for non-production execution.`,
    );
  }

  if (confirmationToken !== expectedConfirmationToken) {
    throw new Error(
      `Refusing destructive operation "${input.operation}". Set CONFIRM_DESTRUCTIVE_OPERATION=${expectedConfirmationToken}.`,
    );
  }

  console.warn(
    `[destructive-operation-guard] ${input.operation} allowed in ${classification.environment}. Confirmed token received; never use this against production or real client data.`,
  );

  return classification;
}
