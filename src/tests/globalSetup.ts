import "dotenv/config";
import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

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

  const prisma = new PrismaClient({
    datasources: envOverride.DATABASE_URL ? { db: { url: envOverride.DATABASE_URL } } : undefined,
  });
  try {
    const school = await prisma.school.upsert({
      where: { code: "SCU-PREVIEW" },
      update: { name: "School Connect Preview" },
      create: { code: "SCU-PREVIEW", name: "School Connect Preview" },
    });
    await prisma.reportLabSubscription.upsert({
      where: { schoolId: school.id },
      update: {
        planCode: "REPORT_LAB_1000",
        status: "ACTIVE",
        currentPeriodEnd: new Date("2030-01-01T00:00:00.000Z"),
      },
      create: {
        schoolId: school.id,
        planCode: "REPORT_LAB_1000",
        billingCycle: "YEAR",
        status: "ACTIVE",
        currentPeriodStart: new Date("2026-01-01T00:00:00.000Z"),
        currentPeriodEnd: new Date("2030-01-01T00:00:00.000Z"),
        studentLimit: 1000,
      },
    });
  } finally {
    await prisma.$disconnect();
  }
}
