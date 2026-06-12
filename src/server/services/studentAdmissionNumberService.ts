import type { PrismaClient } from "@prisma/client";

function slug(value: string) {
  return value.replace(/[^A-Za-z0-9]+/g, "").toUpperCase();
}

function classCode(className: string) {
  const match = className.match(/(\d+)/);
  const number = (match?.[1] ?? slug(className).slice(0, 2)) || "S1";
  const suffix = className.replace(/.*?([A-Za-z])\s*$/, "$1").toUpperCase();
  return `S${number}${suffix}`.replace(/\s+/g, "");
}

export async function generateAdmissionNumber(
  prisma: PrismaClient,
  schoolCode: string,
  className: string,
  streamName: string,
): Promise<string> {
  const school = await prisma.school.findUnique({ where: { code: schoolCode } });
  const prefix = school?.code ? `${slug(school.code)}-` : "";
  const base = `${prefix}${classCode(className)}${slug(streamName).slice(0, 1) || "A"}`;
  const existing = await prisma.student.findMany({
    where: { schoolId: school?.id },
    select: { admissionNumber: true },
  });
  const used = new Set(existing.map((item) => item.admissionNumber.trim().toUpperCase()));
  for (let i = 1; i < 1000; i += 1) {
    const candidate = `${base}-${String(i).padStart(3, "0")}`;
    if (!used.has(candidate.toUpperCase())) return candidate;
  }
  throw new Error("Could not generate a unique admission number.");
}
