import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { assertPlatformIntegrationConfigured, checkEntitlement, recordUsageWithWarning, PlatformIntegrationError } from "../../server/platformClient";

describe("platformClient", () => {
  const originalEnv = {
    ...process.env,
  };

  beforeEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("allows entitlement checks and no-ops usage recording when integration is disabled", async () => {
    process.env.SSAMENJ_PLATFORM_INTEGRATION_ENABLED = "false";

    const entitlement = await checkEntitlement({
      organizationId: "school-1",
      moduleCode: "report_lab.core",
    });

    expect(entitlement.allowed).toBe(true);
    await expect(recordUsageWithWarning({
      organizationId: "school-1",
      moduleCode: "report_lab.core",
      quantity: 1,
      sourceType: "report_generation",
      sourceId: "report-1",
    })).resolves.toBeNull();
  });

  it("requires URL and token when integration is enabled", () => {
    process.env.SSAMENJ_PLATFORM_INTEGRATION_ENABLED = "true";
    delete process.env.SSAMENJ_PLATFORM_URL;
    delete process.env.SSAMENJ_PLATFORM_SERVICE_TOKEN;

    expect(() => assertPlatformIntegrationConfigured()).toThrow(/SSAMENJ_PLATFORM_URL/);
  });

  it("returns a safe timeout error", async () => {
    process.env.SSAMENJ_PLATFORM_INTEGRATION_ENABLED = "true";
    process.env.SSAMENJ_PLATFORM_URL = "http://platform.test";
    process.env.SSAMENJ_PLATFORM_SERVICE_TOKEN = "token";
    process.env.SSAMENJ_PLATFORM_TIMEOUT_MS = "1";

    const originalFetch = global.fetch;
    global.fetch = vi.fn((_input, init?: RequestInit) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => {
        reject(new DOMException("The operation was aborted.", "AbortError"));
      });
    })) as typeof fetch;

    await expect(checkEntitlement({
      organizationId: "school-1",
      moduleCode: "report_lab.core",
    })).rejects.toBeInstanceOf(PlatformIntegrationError);

    global.fetch = originalFetch;
  });

  it("does not leak service token outside server code", async () => {
    const { readFileSync, readdirSync, statSync } = await import("node:fs");
    const { join } = await import("node:path");

    const root = join(process.cwd(), "src");
    const stack = [root];
    const leakedFiles: string[] = [];

    while (stack.length > 0) {
      const current = stack.pop()!;
      for (const entry of readdirSync(current)) {
        const full = join(current, entry);
        const stat = statSync(full);
        if (stat.isDirectory()) {
          stack.push(full);
          continue;
        }
        if (full.includes(`${join("src", "tests")}`)) {
          continue;
        }
        if (full.includes(`${join("src", "server")}`)) {
          continue;
        }
        const content = readFileSync(full, "utf8");
        if (content.includes("SSAMENJ_PLATFORM_SERVICE_TOKEN") || content.includes("x-ssamenj-service-token")) {
          leakedFiles.push(full);
        }
      }
    }

    expect(leakedFiles).toEqual([]);
  });
});
