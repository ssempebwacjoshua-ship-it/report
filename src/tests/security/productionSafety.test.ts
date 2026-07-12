import { describe, expect, it, vi } from "vitest";
import {
  DESTRUCTIVE_CONFIRMATION_TOKEN,
  assertNonProductionDestructiveOperation,
  classifyRuntimeEnvironment,
} from "../../server/utils/productionSafety";

describe("productionSafety", () => {
  it("fails closed for ambiguous runtime signals", () => {
    const runtime = classifyRuntimeEnvironment({
      NODE_ENV: "development",
      RAILWAY_ENVIRONMENT_NAME: "production",
    });

    expect(runtime.environment).toBe("unknown");
    expect(() => assertNonProductionDestructiveOperation({
      operation: "seed-preview",
      env: {
        NODE_ENV: "development",
        RAILWAY_ENVIRONMENT_NAME: "production",
        ALLOW_DESTRUCTIVE_OPERATIONS: "true",
        CONFIRM_DESTRUCTIVE_OPERATION: DESTRUCTIVE_CONFIRMATION_TOKEN,
      },
    })).toThrow(/ambiguous/i);
  });

  it("does not allow the destructive allow flag to override production", () => {
    expect(() => assertNonProductionDestructiveOperation({
      operation: "repair",
      env: {
        APP_ENV: "production",
        ALLOW_DESTRUCTIVE_OPERATIONS: "true",
        CONFIRM_DESTRUCTIVE_OPERATION: DESTRUCTIVE_CONFIRMATION_TOKEN,
      },
    })).toThrow(/production/i);
  });

  it("requires both non-production allow flag and confirmation token", () => {
    expect(() => assertNonProductionDestructiveOperation({
      operation: "seed",
      env: { NODE_ENV: "development", ALLOW_DESTRUCTIVE_OPERATIONS: "true" },
    })).toThrow(/CONFIRM_DESTRUCTIVE_OPERATION/);
  });

  it("allows explicitly confirmed non-production destructive execution", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(assertNonProductionDestructiveOperation({
      operation: "seed",
      env: {
        NODE_ENV: "development",
        ALLOW_DESTRUCTIVE_OPERATIONS: "true",
        CONFIRM_DESTRUCTIVE_OPERATION: DESTRUCTIVE_CONFIRMATION_TOKEN,
      },
    }).environment).toBe("development");
    warn.mockRestore();
  });
});
