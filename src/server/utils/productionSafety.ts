import {
  assertNonProductionOperation,
  classifyRuntimeEnvironment as classifyEnvironment,
  type RuntimeClassification as BaseRuntimeClassification,
  type RuntimeEnvironment,
} from "../security/environmentSafety";

export const DESTRUCTIVE_CONFIRMATION_TOKEN = "I_UNDERSTAND_THIS_MUTATES_SCHOOL_DATA";

export type { RuntimeEnvironment };

export type RuntimeClassification = BaseRuntimeClassification & {
  isProduction: boolean;
  isAmbiguous: boolean;
};

export function classifyRuntimeEnvironment(
  env: Record<string, string | undefined> = process.env,
): RuntimeClassification {
  const classification = classifyEnvironment(env);
  return {
    ...classification,
    isProduction: classification.environment === "production",
    isAmbiguous: classification.environment === "unknown",
  };
}

export function isProductionEnvironment(env: Record<string, string | undefined> = process.env): boolean {
  const classification = classifyEnvironment(env);
  if (classification.environment === "unknown") {
    throw new Error(`Runtime environment is ambiguous: ${classification.reasons.join(" ")}`);
  }
  return classification.environment === "production";
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

  assertNonProductionOperation(input.operation, env);

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
