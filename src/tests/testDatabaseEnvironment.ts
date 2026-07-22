import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { parse as parseDotenv } from "dotenv";

const LOCAL_DB_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

export type TestDatabaseResolution = {
  databaseUrl: string;
  source: "process.TEST_DATABASE_URL" | "process.DATABASE_URL" | "envFile.TEST_DATABASE_URL" | "envFile.DATABASE_URL" | "derivedFromProcess.DATABASE_URL" | "derivedFromEnvFile.DATABASE_URL";
  envOverride: Record<string, string>;
};

type ResolverDependencies = {
  execFileSync?: typeof execFileSync;
};

export function resolveSafeTestDatabaseEnvironment(
  processEnv: Record<string, string | undefined> = process.env,
  cwd = process.cwd(),
  dependencies: ResolverDependencies = {},
): TestDatabaseResolution {
  const nodeEnv = processEnv.NODE_ENV?.trim().toLowerCase();
  const vitestEnabled = Boolean(processEnv.VITEST);
  if (nodeEnv !== "test" && !vitestEnabled) {
    throw new Error("Refusing to run test migrations because NODE_ENV is not test and VITEST is not set.");
  }

  const envFileValues = loadRepositoryEnvValues(cwd, dependencies);
  const explicitDatabaseUrl = normalizeEnvValue(processEnv.DATABASE_URL) ?? normalizeEnvValue(envFileValues.DATABASE_URL);

  const candidates: Array<{ value: string | null; source: TestDatabaseResolution["source"] }> = [
    { value: normalizeEnvValue(processEnv.TEST_DATABASE_URL), source: "process.TEST_DATABASE_URL" },
    { value: normalizeEnvValue(processEnv.DATABASE_URL), source: "process.DATABASE_URL" },
    { value: normalizeEnvValue(envFileValues.TEST_DATABASE_URL), source: "envFile.TEST_DATABASE_URL" },
    { value: normalizeEnvValue(envFileValues.DATABASE_URL), source: "envFile.DATABASE_URL" },
    { value: deriveLocalTestDatabaseUrl(explicitDatabaseUrl), source: normalizeEnvValue(processEnv.DATABASE_URL) ? "derivedFromProcess.DATABASE_URL" : "derivedFromEnvFile.DATABASE_URL" },
  ];

  for (const candidate of candidates) {
    if (!candidate.value) continue;
    if (!looksLikeSafeTestDatabaseUrl(candidate.value)) {
      continue;
    }
    return {
      databaseUrl: candidate.value,
      source: candidate.source,
      envOverride: {
        DATABASE_URL: candidate.value,
        TEST_DATABASE_URL: candidate.value,
        NODE_ENV: "test",
      },
    };
  }

  throw new Error("Refusing to run test migrations because DATABASE_URL does not look like a safe local PostgreSQL test database.");
}

export function looksLikeSafeTestDatabaseUrl(value: string | undefined) {
  if (!value) return false;
  if (!isValidPostgresUrl(value)) return false;
  const parsed = new URL(value);
  const host = parsed.hostname.toLowerCase();
  if (!LOCAL_DB_HOSTS.has(host)) return false;
  const databaseName = parsed.pathname.replace(/^\//, "").toLowerCase();
  return databaseName.includes("test");
}

export function deriveLocalTestDatabaseUrl(value: string | null | undefined) {
  if (!value || !isValidPostgresUrl(value)) return null;
  const parsed = new URL(value);
  const host = parsed.hostname.toLowerCase();
  if (!LOCAL_DB_HOSTS.has(host)) return null;
  const databaseName = parsed.pathname.replace(/^\//, "");
  if (!databaseName) return null;
  if (databaseName.toLowerCase().includes("test")) return parsed.toString();
  parsed.pathname = `/${databaseName}_test`;
  return parsed.toString();
}

export function isValidPostgresUrl(value: string | undefined) {
  if (!value) return false;
  return value.startsWith("postgresql://") || value.startsWith("postgres://");
}

function loadRepositoryEnvValues(cwd: string, dependencies: ResolverDependencies) {
  const values: Record<string, string> = {};
  for (const filePath of getCandidateEnvFiles(cwd, dependencies)) {
    const parsed = parseDotenv(fs.readFileSync(filePath, "utf8"));
    Object.assign(values, parsed);
  }
  return values;
}

function getCandidateEnvFiles(cwd: string, dependencies: ResolverDependencies) {
  const roots = [resolvePrimaryWorktreeRoot(cwd, dependencies), resolveGitRoot(cwd, dependencies)]
    .filter((value): value is string => Boolean(value))
    .filter((value, index, items) => items.indexOf(value) === index);
  const files = new Set<string>();
  for (const root of roots) {
    for (const name of [".env", ".env.local", ".env.test", ".env.test.local"]) {
      const filePath = path.join(root, name);
      if (fs.existsSync(filePath)) files.add(filePath);
    }
  }
  return [...files];
}

function resolveGitRoot(cwd: string, dependencies: ResolverDependencies) {
  try {
    return (dependencies.execFileSync ?? execFileSync)("git", ["rev-parse", "--show-toplevel"], { cwd, encoding: "utf8" }).trim();
  } catch {
    return cwd;
  }
}

function resolvePrimaryWorktreeRoot(cwd: string, dependencies: ResolverDependencies) {
  try {
    const commonDir = (dependencies.execFileSync ?? execFileSync)("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], { cwd, encoding: "utf8" }).trim();
    return path.dirname(commonDir);
  } catch {
    return null;
  }
}

function normalizeEnvValue(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
