import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  deriveLocalTestDatabaseUrl,
  isValidPostgresUrl,
  looksLikeSafeTestDatabaseUrl,
  resolveSafeTestDatabaseEnvironment,
} from "../testDatabaseEnvironment";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("testDatabaseEnvironment", () => {
  it("accepts only postgres connection string syntax", () => {
    expect(isValidPostgresUrl("postgresql://user:pass@localhost:5432/db")).toBe(true);
    expect(isValidPostgresUrl("postgres://user:pass@localhost:5432/db")).toBe(true);
    expect(isValidPostgresUrl("http://localhost:5173")).toBe(false);
  });

  it("derives a local _test database URL from a local postgres DATABASE_URL", () => {
    expect(deriveLocalTestDatabaseUrl("postgresql://user:pass@localhost:5432/school_connect_reports_lab?schema=public"))
      .toBe("postgresql://user:pass@localhost:5432/school_connect_reports_lab_test?schema=public");
  });

  it("keeps safeguards for non-local or non-test URLs", () => {
    expect(looksLikeSafeTestDatabaseUrl("postgresql://user:pass@db.example.com:5432/school_connect_reports_lab_test?schema=public")).toBe(false);
    expect(looksLikeSafeTestDatabaseUrl("postgresql://user:pass@localhost:5432/school_connect_reports_lab?schema=public")).toBe(false);
  });

  it("loads fallback env values from the primary worktree when the current worktree has no .env", () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "sms-test-env-"));
    const worktreeRoot = path.join(tempRoot, "worktree");
    const primaryRoot = path.join(tempRoot, "primary");
    fs.mkdirSync(worktreeRoot, { recursive: true });
    fs.mkdirSync(path.join(primaryRoot, ".git"), { recursive: true });
    fs.writeFileSync(
      path.join(primaryRoot, ".env"),
      "DATABASE_URL=postgresql://school_connect_reports_lab_local:local-pass@localhost:5432/school_connect_reports_lab_test?schema=public\n",
    );
    const execFileSync = vi.fn((command: string, args?: readonly string[]) => {
      if (command !== "git") throw new Error("unexpected command");
      const argList = (args ?? []) as string[];
      if (argList.includes("--show-toplevel")) return `${worktreeRoot}\n`;
      if (argList.includes("--git-common-dir")) return `${path.join(primaryRoot, ".git")}\n`;
      throw new Error("unexpected git args");
    });

    const result = resolveSafeTestDatabaseEnvironment({
      NODE_ENV: "test",
      VITEST: "true",
    }, worktreeRoot, { execFileSync: execFileSync as never });

    expect(result.databaseUrl).toBe("postgresql://school_connect_reports_lab_local:local-pass@localhost:5432/school_connect_reports_lab_test?schema=public");
    expect(result.source).toBe("envFile.DATABASE_URL");
  });
});
