import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { resolveSafeTestDatabaseEnvironment } from "./testDatabaseEnvironment";

export default async function globalSetup() {
  const resolution = resolveSafeTestDatabaseEnvironment();
  execSync("npm exec -- prisma migrate deploy", {
    stdio: "inherit",
    env: {
      ...process.env,
      ...resolution.envOverride,
    },
  });

  const prisma = new PrismaClient({
    datasources: { db: { url: resolution.databaseUrl } },
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
