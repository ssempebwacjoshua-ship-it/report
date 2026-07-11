import "dotenv/config";
import { prisma } from "../src/server/db/prisma";
import { assertNonProductionDestructiveOperation } from "../src/server/utils/productionSafety";
import { hashPassword } from "../src/server/services/authService";
import { O_LEVEL_SUBJECTS } from "../src/shared/constants/subjects";

const SCHOOL_CODE = process.env.SCHOOL_CODE ?? "SCU-PREVIEW";
const SCHOOL_NAME = process.env.SCHOOL_NAME ?? "School Connect Preview";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@schoolconnect.test";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "password123";
const ADMIN_NAME = "School Admin";

async function seedAdmin() {
  // Ensure the school exists — create it if missing (safe in any environment)
  let school = await prisma.school.findUnique({ where: { code: SCHOOL_CODE } });
  if (!school) {
    school = await prisma.school.create({
      data: { code: SCHOOL_CODE, name: SCHOOL_NAME },
    });
    console.log(`Created school: ${school.name} (${school.code})`);
  } else {
    console.log(`School found: ${school.name} (${school.code})`);
  }

  for (const [index, subject] of O_LEVEL_SUBJECTS.entries()) {
    await prisma.subject.upsert({
      where: { schoolId_code: { schoolId: school.id, code: subject.code } },
      update: { name: subject.name, sortOrder: index + 1, isActive: true },
      create: { schoolId: school.id, code: subject.code, name: subject.name, sortOrder: index + 1, isActive: true },
    });
  }

  const passwordHash = await hashPassword(ADMIN_PASSWORD);

  const existing = await prisma.user.findFirst({
    where: { schoolId: school.id, email: ADMIN_EMAIL },
  });

  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: { name: ADMIN_NAME, passwordHash, role: "ADMIN_OPERATOR", isActive: true },
    });
    console.log(`Admin user updated: ${ADMIN_EMAIL}`);
  } else {
    await prisma.user.create({
      data: {
        schoolId: school.id,
        name: ADMIN_NAME,
        email: ADMIN_EMAIL,
        passwordHash,
        role: "ADMIN_OPERATOR",
        isActive: true,
      },
    });
    console.log(`Admin user created: ${ADMIN_EMAIL}`);
  }
}

assertNonProductionDestructiveOperation({ operation: "seed-admin" });

seedAdmin()
  .catch((error) => {
    console.error("Seed failed:", error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
