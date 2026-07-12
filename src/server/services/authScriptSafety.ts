import { assertNonProductionOperation, classifyRuntimeEnvironment, type RuntimeEnvironment } from "../security/environmentSafety";

export type ScriptMode = "dry-run" | "apply";

export function parseScriptMode(args: string[]): ScriptMode {
  return args.includes("-Apply") || args.includes("--apply") ? "apply" : "dry-run";
}

export function isSeedEnvironment(environment: RuntimeEnvironment): boolean {
  return environment === "development" || environment === "test";
}

export function describeWriteMode(args: string[]): { mode: ScriptMode; apply: boolean } {
  const mode = parseScriptMode(args);
  return { mode, apply: mode === "apply" };
}

export function assertScriptWriteAllowed(
  operationName: string,
  args: string[],
  env: Record<string, string | undefined> = process.env,
) {
  const mode = parseScriptMode(args);
  const classification = classifyRuntimeEnvironment(env);
  if (mode === "dry-run") {
    return { mode, classification };
  }
  assertNonProductionOperation(operationName, env);
  if (!isSeedEnvironment(classification.environment)) {
    throw new Error(`Refusing operation: ${operationName} is limited to development/test environments.`);
  }
  if (classification.databaseHostClass !== "local") {
    throw new Error(`Refusing operation: ${operationName} requires a local database host.`);
  }
  return { mode, classification };
}
