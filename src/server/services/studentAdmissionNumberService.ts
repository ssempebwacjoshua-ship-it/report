import type { PrismaClient } from "@prisma/client";

function slug(value: string) {
  return value.replace(/[^A-Za-z0-9]+/g, "").toUpperCase();
}

const WORD_NUMBERS: Record<string, string> = {
  one: "1",
  two: "2",
  three: "3",
  four: "4",
  five: "5",
  six: "6",
};

function classCode(className: string) {
  const normalized = className
    .trim()
    .toLowerCase()
    .replace(/\b(one|two|three|four|five|six)\b/g, (word) => WORD_NUMBERS[word] ?? word);
  const number = normalized.match(/(\d+)/)?.[1] ?? (slug(className).slice(0, 2) || "1");
  const compact = normalized.replace(/[^a-z0-9]/g, "");
  const suffix = compact.match(/^(?:senior|primary|s|p)?\d+([a-z])$/)?.[1]?.toUpperCase() ?? "";
  return `S${number}${suffix}`;
}

/**
 * Generate a unique admission number for the given class/stream.
 *
 * @param alsoExclude - set of admission numbers already allocated in the
 *   current in-memory batch (so two rows in the same import don't get the
 *   same auto-generated number even though neither has been written to DB yet).
 */
export async function generateAdmissionNumber(
  prisma: PrismaClient,
  schoolCode: string,
  className: string,
  streamName: string,
  alsoExclude: Set<string> = new Set(),
): Promise<string> {
  const school = await prisma.school.findUnique({ where: { code: schoolCode } });
  const prefix = school?.code ? `${slug(school.code)}-` : "";
  const base = `${prefix}${classCode(className)}${slug(streamName).slice(0, 1) || "A"}`;
  const existing = await prisma.student.findMany({
    where: { schoolId: school?.id },
    select: { admissionNumber: true },
  });
  const used = new Set<string>(existing.map((item) => item.admissionNumber.trim().toUpperCase()));
  for (const exc of alsoExclude) used.add(exc.toUpperCase());
  for (let i = 1; i < 10000; i += 1) {
    const candidate = `${base}-${String(i).padStart(3, "0")}`;
    if (!used.has(candidate.toUpperCase())) return candidate;
  }
  throw new Error("Could not generate a unique admission number. Please provide admission numbers manually.");
}
