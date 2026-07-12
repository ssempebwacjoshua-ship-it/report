/**
 * Controlled local-only provisioning script for a platform owner user.
 *
 * Usage:
 *   npx tsx scripts/create-platform-owner.ts --email=<email> --password=<password> [-Apply]
 */

import "dotenv/config";
import { pathToFileURL } from "node:url";
import { prisma } from "../src/server/db/prisma";
import { hashPassword, normalizeLoginEmail } from "../src/server/services/authService";
import { assertScriptWriteAllowed } from "../src/server/services/authScriptSafety";

function getArg(args: string[], name: string): string | undefined {
  const flag = `--${name}=`;
  const entry = args.find((a) => a.startsWith(flag));
  return entry?.slice(flag.length);
}

export async function runCreatePlatformOwner(inputArgs: string[], db = prisma, env: Record<string, string | undefined> = process.env) {
  const { mode, classification } = assertScriptWriteAllowed("create-platform-owner", inputArgs, env);
  const email = normalizeLoginEmail(getArg(inputArgs, "email") ?? "");
  const password = getArg(inputArgs, "password") ?? "";

  console.log(`[create-platform-owner] mode=${mode} environment=${classification.environment}`);

  if (!email || !password) {
    throw new Error("Usage: npx tsx scripts/create-platform-owner.ts --email=<email> --password=<password> [-Apply]");
  }

  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }

  let school = await db.school.findUnique({ where: { code: "SCU-PREVIEW" } });
  if (!school) {
    school = await db.school.findFirst({ orderBy: { createdAt: "asc" } });
  }
  if (!school) {
    throw new Error("No school found. Provision a school intentionally before creating a platform owner.");
  }

  const existing = await db.user.findFirst({ where: { email } });
  if (existing) {
    console.log(`[create-platform-owner] Existing user preserved for ${email}. Controlled repair or admin action is required.`);
    return;
  }

  if (mode === "dry-run") {
    console.log(`[create-platform-owner] Would create platform owner ${email} in school ${school.code}.`);
    return;
  }

  const passwordHash = await hashPassword(password);
  const user = await db.user.create({
    data: {
      schoolId: school.id,
      name: "Platform Owner",
      email,
      passwordHash,
      role: "ADMIN_OPERATOR",
      isPlatformOwner: true,
      isActive: true,
      mustChangePassword: false,
    },
  });
  console.log(`[create-platform-owner] Created platform owner ${user.email} in school ${school.code}.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCreatePlatformOwner(process.argv.slice(2))
    .catch((e) => {
      console.error(e instanceof Error ? e.message : e);
      process.exit(1);
    })
    .finally(async () => prisma.$disconnect());
}

export {};
