/**
 * Diagnostic script: prints the canonical class/stream inventory for a school.
 * Usage: npx tsx src/scripts/verifySchoolClasses.ts [schoolCode...]
 */

import type { PrismaClient } from "@prisma/client";
import { isCanonicalClassCode } from "../shared/constants/classes";

async function verifySchoolClasses(prisma: PrismaClient, schoolCode: string): Promise<void> {
  const school = await prisma.school.findUnique({ where: { code: schoolCode } });
  if (!school) {
    console.error(`School not found: ${schoolCode}`);
    return;
  }

  const [classes, streams, allEnrollments] = await Promise.all([
    prisma.schoolClass.findMany({
      where: { schoolId: school.id },
      orderBy: { level: "asc" },
    }),
    prisma.stream.findMany({ where: { schoolId: school.id } }),
    prisma.classEnrollment.findMany({
      where: { student: { schoolId: school.id }, isActive: true, status: "ACTIVE" },
      select: { classId: true, streamId: true },
    }),
  ]);

  const streamsByClass = new Map<string, typeof streams>();
  for (const s of streams) {
    const list = streamsByClass.get(s.classId) ?? [];
    list.push(s);
    streamsByClass.set(s.classId, list);
  }

  const enrollCountByStream = new Map<string, number>();
  for (const e of allEnrollments) {
    const key = `${e.classId}:${e.streamId}`;
    enrollCountByStream.set(key, (enrollCountByStream.get(key) ?? 0) + 1);
  }

  const canonical = classes.filter((c) => isCanonicalClassCode(c.code));
  const archived = classes.filter((c) => c.name.startsWith("ARCHIVED:"));
  const orphans = classes.filter((c) => !isCanonicalClassCode(c.code) && !c.name.startsWith("ARCHIVED:"));

  console.log(`\n=== ${schoolCode} ? Class Inventory ===\n`);
  console.log(`Canonical classes (${canonical.length}):`);
  for (const c of canonical) {
    const classStreams = streamsByClass.get(c.id) ?? [];
    const classEnrollCount = allEnrollments.filter((e) => e.classId === c.id).length;
    console.log(`  [${c.code}] ${c.name}  (id: ${c.id.slice(0, 8)}...)  ? ${classEnrollCount} enrolled`);
    for (const s of classStreams.sort((a, b) => a.code.localeCompare(b.code))) {
      const count = enrollCountByStream.get(`${c.id}:${s.id}`) ?? 0;
      console.log(`      stream [${s.code}] ${s.name} ? ${count} enrolled`);
    }
    if (classStreams.length === 0) console.log(`      (no streams)`);
  }

  if (orphans.length > 0) {
    console.log(`\nOrphan classes ? non-canonical, non-archived (${orphans.length}) ? RUN REPAIR SCRIPT:`);
    for (const c of orphans) console.log(`  [${c.code}] ${c.name}  (id: ${c.id.slice(0, 8)}...)`);
  }

  if (archived.length > 0) {
    console.log(`\nArchived classes (${archived.length}):`);
    for (const c of archived) console.log(`  [${c.code}] ${c.name}`);
  }

  console.log(`\nTotal active enrollments: ${allEnrollments.length}`);
}

async function main(): Promise<void> {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  const schoolCodes = process.argv.slice(2).length ? process.argv.slice(2) : ["SCU-PREVIEW"];
  try {
    for (const code of schoolCodes) {
      await verifySchoolClasses(prisma, code);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

