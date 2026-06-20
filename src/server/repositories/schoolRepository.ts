import type { PrismaClient } from "@prisma/client";
import type { ReportContext } from "../../shared/types/reports";
import { ensureDefaultSubjectsForSections } from "../services/subjectProvisioningService";
import { getSettingsSections } from "./settingsRepository";

export async function getReportContext(prisma: PrismaClient, schoolCode: string): Promise<ReportContext> {
  const school = await prisma.school.findUnique({
    where: { code: schoolCode },
    include: {
      academicYears: { orderBy: [{ isActive: "desc" }, { startsOn: "desc" }] },
      classes: { orderBy: [{ level: "asc" }, { name: "asc" }] },
      streams: { orderBy: [{ code: "asc" }] },
      subjects: { where: { isActive: true }, orderBy: { sortOrder: "asc" } },
    },
  });

  if (!school) {
    return { school: null, academicYears: [], terms: [], classes: [], streams: [], subjects: [] };
  }

  let subjects = school.subjects;
  if (subjects.length === 0 && school.classes.length > 0) {
    const settings = await getSettingsSections(prisma, schoolCode);
    const sections = settings.school.schoolSections;
    if (sections.length > 0) {
      await ensureDefaultSubjectsForSections(
        prisma,
        school.id,
        sections,
        school.classes.map((klass) => klass.code),
      );
      subjects = await prisma.subject.findMany({
        where: { schoolId: school.id, isActive: true },
        orderBy: { sortOrder: "asc" },
      });
    }
  }

  const yearIds = school.academicYears.map((year) => year.id);
  const terms = await prisma.term.findMany({
    where: { academicYearId: { in: yearIds } },
    orderBy: [{ isActive: "desc" }, { startsOn: "asc" }],
  });

  return {
    school: { id: school.id, code: school.code, name: school.name },
    academicYears: school.academicYears.map((year) => ({ id: year.id, name: year.name, isActive: year.isActive })),
    terms: terms.map((term) => ({ id: term.id, name: term.name, isActive: term.isActive })),
    classes: school.classes.map((klass) => ({ id: klass.id, name: klass.name, code: klass.code })),
    streams: school.streams.map((stream) => ({ id: stream.id, name: stream.name, code: stream.code, classId: stream.classId })),
    subjects: subjects.map((subject) => ({ id: subject.id, name: subject.name, code: subject.code })),
  };
}

