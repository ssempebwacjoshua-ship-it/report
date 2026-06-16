/**
 * Bootstrap script: create or update a platform owner user.
 *
 * Usage:
 *   npx tsx scripts/create-platform-owner.ts --email "owner@schoolconnect.local" --password "CHANGE_ME"
 *
 * The user is attached to the SCU-PREVIEW school (or the first school found).
 * If a user with this email already exists (in any school), isPlatformOwner is set to true.
 * The password is hashed; the plaintext is never stored or logged.
 */

import "dotenv/config";
import { pathToFileURL } from "node:url";
import { prisma } from "../src/server/db/prisma";
import { hashPassword } from "../src/server/services/authService";

const args = process.argv.slice(2);

function getArg(name: string): string | undefined {
  const flag = `--${name}=`;
  const entry = args.find((a) => a.startsWith(flag));
  return entry?.slice(flag.length);
}

async function main() {
  const email = getArg("email");
  const password = getArg("password");

  if (!email || !password) {
    console.error("Usage: npx tsx scripts/create-platform-owner.ts --email=<email> --password=<password>");
    process.exit(1);
  }

  if (password.length < 8) {
    console.error("Password must be at least 8 characters.");
    process.exit(1);
  }

  // Find the anchor school: SCU-PREVIEW first, then any school
  let school = await prisma.school.findUnique({ where: { code: "SCU-PREVIEW" } });
  if (!school) {
    school = await prisma.school.findFirst({ orderBy: { createdAt: "asc" } });
  }
  if (!school) {
    console.error("No school found. Run the seed script first or create a school.");
    process.exit(1);
  }

  const passwordHash = await hashPassword(password);

  // Check if user already exists (any school)
  const existing = await prisma.user.findFirst({ where: { email: email.toLowerCase() } });

  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: { passwordHash, isPlatformOwner: true, isActive: true, mustChangePassword: false },
    });
    console.log(`[ok] Updated existing user ${email} → isPlatformOwner=true (school: ${existing.schoolId})`);
  } else {
    const user = await prisma.user.create({
      data: {
        schoolId: school.id,
        name: "Platform Owner",
        email: email.toLowerCase(),
        passwordHash,
        role: "ADMIN_OPERATOR",
        isPlatformOwner: true,
        isActive: true,
        mustChangePassword: false,
      },
    });
    console.log(`[ok] Created platform owner user: ${user.email} (school: ${school.code}, id: ${user.id})`);
  }

  console.log(`[ok] Login: schoolCode=PLATFORM, email=${email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());

export {};
