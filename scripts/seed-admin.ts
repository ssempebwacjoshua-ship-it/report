import "dotenv/config";
import { pathToFileURL } from "node:url";
import { prisma } from "../src/server/db/prisma";
import { hashPassword, normalizeLoginEmail, normalizeSchoolCode } from "../src/server/services/authService";
import { assertScriptWriteAllowed } from "../src/server/services/authScriptSafety";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "password123";
const ADMIN_NAME = "School Admin";

type DbLike = typeof prisma;

function getArg(args: string[], name: string): string | undefined {
  const flag = `--${name}=`;
  const entry = args.find((arg) => arg.startsWith(flag));
  return entry?.slice(flag.length);
}

export async function runSeedAdmin(args: string[], db: DbLike = prisma, env: Record<string, string | undefined> = process.env) {
  const { mode, classification } = assertScriptWriteAllowed("seed-admin", args, env);
  const schoolCode = normalizeSchoolCode(getArg(args, "schoolCode") ?? "");
  const email = normalizeLoginEmail(getArg(args, "email") ?? "");

  if (!schoolCode) {
    throw new Error("Missing required argument: --schoolCode=<SCHOOL_CODE>");
  }
  if (!email) {
    throw new Error("Missing required argument: --email=<email>");
  }

  console.log(`[seed-admin] mode=${mode} environment=${classification.environment}`);

  const school = await db.school.findUnique({ where: { code: schoolCode } });
  if (!school) {
    console.log(`[seed-admin] School not found: ${schoolCode}.`);
    console.log("[seed-admin] Action refused: CREATE_MISSING_USER_ONLY requires an existing school.");
    if (mode === "apply") {
      throw new Error(`Refusing operation: school ${schoolCode} must already exist.`);
    }
    return;
  }

  console.log(`[seed-admin] Existing school preserved: ${school.code}.`);

  const existing = await db.user.findFirst({
    where: { schoolId: school.id, email },
  });

  if (existing) {
    console.log(`[seed-admin] Existing record preserved for ${email}.`);
    return;
  }

  if (mode === "dry-run") {
    console.log(`[seed-admin] Would create missing admin user ${email}.`);
    return;
  }

  console.log(`Environment: ${classification.environment}`);
  console.log(`Database classification: ${classification.databaseHostClass}`);
  console.log(`School code: ${schoolCode}`);
  console.log(`Email: ${email}`);
  console.log("Action: CREATE_MISSING_USER_ONLY");
  console.log("Existing user found: false");

  const passwordHash = await hashPassword(ADMIN_PASSWORD);
  await db.user.create({
    data: {
      schoolId: school.id,
      name: ADMIN_NAME,
      email,
      passwordHash,
      role: "ADMIN_OPERATOR",
      isActive: true,
    },
  });
  console.log(`[seed-admin] Created missing admin user ${email}.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runSeedAdmin(process.argv.slice(2))
    .catch((error) => {
      console.error("Seed failed:", error instanceof Error ? error.message : error);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
