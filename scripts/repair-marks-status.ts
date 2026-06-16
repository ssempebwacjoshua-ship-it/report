/**
 * repair-marks-status.ts
 *
 * Repairs SubjectMark records stuck in DRAFT status that should be FINALIZED.
 * A mark is considered "stuck" if:
 *  - status is DRAFT
 *  - it was created more than 24 hours ago
 *  - its import batch (if any) has status COMMITTED
 *
 * Usage:
 *   # Dry-run first — required before any live repair
 *   npx tsx scripts/repair-marks-status.ts --dry-run --school SCU-PREVIEW
 *
 *   # Live repair only after confirming the dry-run output
 *   npx tsx scripts/repair-marks-status.ts --school SCU-PREVIEW
 *
 * Flags:
 *   --dry-run     Preview which records would change without writing anything.
 *   --school CODE Target a specific school by code (required).
 *   --limit N     Maximum records to repair in one run (default: 100).
 */

import "dotenv/config";
import { prisma } from "../src/server/db/prisma";

// ── Arg parsing ───────────────────────────────────────────────────────────────

function parseArgs(argv: string[]) {
  const args = argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const schoolIdx = args.indexOf("--school");
  const schoolCode = schoolIdx !== -1 ? args[schoolIdx + 1] : null;
  const limitIdx = args.indexOf("--limit");
  const limit = limitIdx !== -1 ? Number(args[limitIdx + 1]) : 100;
  return { dryRun, schoolCode, limit };
}

export async function repairMarksStatus(opts: {
  dryRun: boolean;
  schoolCode: string;
  limit: number;
  db?: typeof prisma;
}) {
  const db = opts.db ?? prisma;
  const { dryRun, schoolCode, limit } = opts;

  const school = await db.school.findUnique({ where: { code: schoolCode } });
  if (!school) {
    console.error(`School not found: ${schoolCode}`);
    return { repaired: 0, dryRun };
  }

  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24h ago

  const stuckMarks = await db.subjectMark.findMany({
    where: {
      schoolId: school.id,
      status: "DRAFT",
      createdAt: { lt: cutoff },
      OR: [
        { importBatchId: null },
        { importBatch: { status: "COMMITTED" } },
      ],
    },
    take: limit,
    select: { id: true, studentId: true, subjectId: true, assessmentType: true, marks: true, createdAt: true },
  });

  if (stuckMarks.length === 0) {
    console.log(`[repair] No stuck DRAFT marks found for school ${schoolCode}.`);
    return { repaired: 0, dryRun };
  }

  console.log(`[repair] Found ${stuckMarks.length} stuck DRAFT mark(s) for school ${schoolCode}.`);
  for (const mark of stuckMarks) {
    console.log(`  - markId=${mark.id} student=${mark.studentId} subject=${mark.subjectId} type=${mark.assessmentType} marks=${mark.marks} created=${mark.createdAt.toISOString()}`);
  }

  if (dryRun) {
    console.log(`[repair] DRY-RUN: no changes written. Re-run without --dry-run to apply.`);
    return { repaired: 0, dryRun: true, wouldRepair: stuckMarks.length };
  }

  const ids = stuckMarks.map((m) => m.id);
  const result = await db.subjectMark.updateMany({
    where: { id: { in: ids } },
    data: { status: "FINALIZED" },
  });

  console.log(`[repair] Repaired ${result.count} mark(s) → FINALIZED.`);
  return { repaired: result.count, dryRun: false };
}

// ── Entry point ───────────────────────────────────────────────────────────────

if (process.argv[1]?.endsWith("repair-marks-status.ts") || process.argv[1]?.endsWith("repair-marks-status.js")) {
  const { dryRun, schoolCode, limit } = parseArgs(process.argv);

  if (!schoolCode) {
    console.error("Usage: repair-marks-status.ts --dry-run --school <CODE> [--limit N]");
    process.exit(1);
  }

  repairMarksStatus({ dryRun, schoolCode, limit })
    .then(({ repaired, dryRun: wasDryRun }) => {
      if (wasDryRun) {
        console.log("[repair] Dry-run complete. No data was changed.");
      } else {
        console.log(`[repair] Done. ${repaired} record(s) repaired.`);
      }
    })
    .catch((err: unknown) => {
      console.error("[repair] Fatal error:", err instanceof Error ? err.message : err);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
