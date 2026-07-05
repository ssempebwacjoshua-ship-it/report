import "dotenv/config";
import { execSync } from "node:child_process";

function looksLikeSafeTestDatabaseUrl(value: string | undefined) {
  if (!value) return false;
  const lower = value.trim().toLowerCase();
  return (
    lower.includes("localhost")
    || lower.includes("127.0.0.1")
    || lower.includes("[::1]")
    || lower.includes("::1")
    || lower.includes("test")
  );
}

function assertSafeTestMigrationsEnvironment() {
  const nodeEnv = process.env.NODE_ENV?.trim().toLowerCase();
  const vitestEnabled = Boolean(process.env.VITEST);
  if (nodeEnv !== "test" && !vitestEnabled) {
    throw new Error("Refusing to run test migrations because NODE_ENV is not test and VITEST is not set.");
  }

  const testDatabaseUrl = process.env.TEST_DATABASE_URL?.trim();
  const databaseUrl = process.env.DATABASE_URL?.trim();
  const candidateUrl = testDatabaseUrl || databaseUrl;

  if (!candidateUrl || !looksLikeSafeTestDatabaseUrl(candidateUrl)) {
    throw new Error("Refusing to run test migrations because DATABASE_URL does not look like a test database.");
  }

  return testDatabaseUrl ? { DATABASE_URL: testDatabaseUrl } : {};
}

export default async function globalSetup() {
  const envOverride = assertSafeTestMigrationsEnvironment();
  execSync("npm exec -- prisma migrate deploy", {
    stdio: "inherit",
    env: {
      ...process.env,
      ...envOverride,
    },
  });
}
