import "dotenv/config";
import { prisma } from "../src/server/db/prisma";
import { hashPassword } from "../src/server/services/authService";

const SCHOOL_CODE = process.env.SCHOOL_CODE ?? "SCU-PREVIEW";
const ADMIN_EMAIL = "admin@schoolconnect.test";
const ADMIN_PASSWORD = "password123";
const ADMIN_NAME = "Demo Admin";

async function seedAdmin() {
  const school = await prisma.school.findUnique({ where: { code: SCHOOL_CODE } });

  if (!school) {
    console.error(`School with code "${SCHOOL_CODE}" not found. Run seed-preview.ts first.`);
    process.exit(1);
  }

  const existing = await prisma.user.findFirst({
    where: { schoolId: school.id, email: ADMIN_EMAIL },
  });

  if (existing) {
    console.log(`Admin user already exists: ${ADMIN_EMAIL}`);
    return;
  }

  await prisma.user.create({
    data: {
      schoolId: school.id,
      name: ADMIN_NAME,
      email: ADMIN_EMAIL,
      passwordHash: await hashPassword(ADMIN_PASSWORD),
      role: "ADMIN_OPERATOR",
      isActive: true,
    },
  });

  console.log(`Created admin user:`);
  console.log(`  Email:    ${ADMIN_EMAIL}`);
  console.log(`  Password: ${ADMIN_PASSWORD}`);
  console.log(`  School:   ${school.name} (${SCHOOL_CODE})`);
}

seedAdmin()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
