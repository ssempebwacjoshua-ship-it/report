import "dotenv/config";
import { prisma } from "../src/server/db/prisma";

const SCHOOL_CODE = process.env.SCHOOL_CODE ?? "SCU-PREVIEW";
const ADMIN_EMAIL = "admin@schoolconnect.test";

async function main() {
  const school = await prisma.school.findUnique({ where: { code: SCHOOL_CODE } });
  if (!school) {
    console.error(`School with code "${SCHOOL_CODE}" not found.`);
    process.exitCode = 1;
    return;
  }

  const user = await prisma.user.findFirst({
    where: { schoolId: school.id, email: ADMIN_EMAIL },
  });

  if (!user) {
    console.log("Admin user not found");
    return;
  }

  console.log(
    JSON.stringify(
      {
        exists: true,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt.toISOString(),
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
