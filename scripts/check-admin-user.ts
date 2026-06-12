import "dotenv/config";
import { prisma } from "../src/server/db/prisma";

const SCHOOL_CODE = process.env.SCHOOL_CODE ?? "SCU-PREVIEW";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@schoolconnect.test";

async function main() {
  const school = await prisma.school.findUnique({ where: { code: SCHOOL_CODE } });
  if (!school) {
    console.error(`School with code "${SCHOOL_CODE}" not found. Run: npx tsx scripts/seed-admin.ts`);
    process.exitCode = 1;
    return;
  }
  console.log(`School : ${school.name} (${school.code})`);

  const user = await prisma.user.findFirst({
    where: { schoolId: school.id, email: ADMIN_EMAIL },
    select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true },
  });

  if (!user) {
    console.error(`Admin user "${ADMIN_EMAIL}" not found. Run: npx tsx scripts/seed-admin.ts`);
    process.exitCode = 1;
    return;
  }

  console.log(
    JSON.stringify(
      {
        exists: true,
        email: user.email,
        name: user.name,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt.toISOString(),
      },
      null,
      2,
    ),
  );
  console.log("\nAdmin user is present and ready.");
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
