import type { PrismaClient } from "@prisma/client";
import type { z } from "zod";
import {
  academicSetupSchema,
  defaultSettingsSections,
  sectionSchemas,
  settingsSectionsSchema,
  type SettingSection,
  type SettingsResponse,
  type SettingsSections,
} from "../../shared/types/settings";

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function formatIsoDate(value: Date | null | undefined) {
  return value ? value.toISOString().slice(0, 10) : null;
}

function parseIsoDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function deriveAcademicYearBounds(academic: SettingsSections["academic"]) {
  const match = academic.activeAcademicYear.match(/^(\d{4})\s*\/\s*(\d{4})$/);
  if (!match) {
    return {
      startsOn: parseIsoDate(academic.termStartDate),
      endsOn: parseIsoDate(academic.termEndDate),
    };
  }

  const startYear = Number(match[1]);
  const endYear = Number(match[2]);
  if (!Number.isFinite(startYear) || !Number.isFinite(endYear) || endYear < startYear) {
    return {
      startsOn: parseIsoDate(academic.termStartDate),
      endsOn: parseIsoDate(academic.termEndDate),
    };
  }

  return {
    startsOn: new Date(Date.UTC(startYear, 0, 1)),
    endsOn: new Date(Date.UTC(endYear, 11, 31)),
  };
}

type AcademicSyncDelegate = Pick<PrismaClient, "academicYear" | "term">;

async function syncAcademicRows(
  db: AcademicSyncDelegate,
  schoolId: string,
  academic: SettingsSections["academic"],
) {
  const academicYearBounds = deriveAcademicYearBounds(academic);
  const termStart = parseIsoDate(academic.termStartDate);
  const termEnd = parseIsoDate(academic.termEndDate);

  const academicYear = await db.academicYear.upsert({
    where: {
      schoolId_name: {
        schoolId,
        name: academic.activeAcademicYear,
      },
    },
    create: {
      schoolId,
      name: academic.activeAcademicYear,
      startsOn: academicYearBounds.startsOn,
      endsOn: academicYearBounds.endsOn,
      isActive: true,
    },
    update: {
      startsOn: academicYearBounds.startsOn,
      endsOn: academicYearBounds.endsOn,
      isActive: true,
    },
  });

  await db.academicYear.updateMany({
    where: {
      schoolId,
      id: { not: academicYear.id },
      isActive: true,
    },
    data: {
      isActive: false,
    },
  });

  const term = await db.term.upsert({
    where: {
      academicYearId_name: {
        academicYearId: academicYear.id,
        name: academic.activeTerm,
      },
    },
    create: {
      academicYearId: academicYear.id,
      name: academic.activeTerm,
      startsOn: termStart,
      endsOn: termEnd,
      isActive: true,
    },
    update: {
      startsOn: termStart,
      endsOn: termEnd,
      isActive: true,
    },
  });

  await db.term.updateMany({
    where: {
      academicYearId: academicYear.id,
      id: { not: term.id },
      isActive: true,
    },
    data: {
      isActive: false,
    },
  });

  return { academicYear, term };
}

function mergeSections(saved: unknown, school?: { code: string; name: string } | null): SettingsSections {
  const defaults = deepClone(defaultSettingsSections);
  if (school) {
    defaults.school.schoolCode = school.code;
    defaults.school.schoolName = school.name;
  }

  const candidate =
    saved && typeof saved === "object"
      ? {
          ...defaults,
          ...(saved as Partial<SettingsSections>),
          school: { ...defaults.school, ...((saved as Partial<SettingsSections>).school ?? {}) },
          academic: { ...defaults.academic, ...((saved as Partial<SettingsSections>).academic ?? {}) },
          reports: { ...defaults.reports, ...((saved as Partial<SettingsSections>).reports ?? {}) },
          reportPersonalization: {
            ...defaults.reportPersonalization,
            ...((saved as Partial<SettingsSections>).reportPersonalization ?? {}),
            branding: {
              ...defaults.reportPersonalization.branding,
              ...(((saved as Partial<SettingsSections>).reportPersonalization as Partial<SettingsSections["reportPersonalization"]> | undefined)?.branding ?? {}),
            },
            layout: {
              ...defaults.reportPersonalization.layout,
              ...(((saved as Partial<SettingsSections>).reportPersonalization as Partial<SettingsSections["reportPersonalization"]> | undefined)?.layout ?? {}),
            },
          },
          marksheets: { ...defaults.marksheets, ...((saved as Partial<SettingsSections>).marksheets ?? {}) },
          ocr: { ...defaults.ocr, ...((saved as Partial<SettingsSections>).ocr ?? {}) },
          grading: { ...defaults.grading, ...((saved as Partial<SettingsSections>).grading ?? {}) },
          approval: { ...defaults.approval, ...((saved as Partial<SettingsSections>).approval ?? {}) },
          appearance: { ...defaults.appearance, ...((saved as Partial<SettingsSections>).appearance ?? {}) },
        }
      : defaults;

  return settingsSectionsSchema.parse(candidate);
}

function hydrateAcademicSectionFromDb(
  sections: SettingsSections,
  activeAcademicYear?: { name: string; terms: Array<{ name: string; startsOn: Date; endsOn: Date }> } | null,
): SettingsSections {
  const activeTerm = activeAcademicYear?.terms[0] ?? null;
  if (!activeAcademicYear || !activeTerm) return sections;

  const termStartDate = formatIsoDate(activeTerm.startsOn);
  const termEndDate = formatIsoDate(activeTerm.endsOn);
  if (!termStartDate || !termEndDate) return sections;

  return settingsSectionsSchema.parse({
    ...sections,
    academic: {
      ...sections.academic,
      activeAcademicYear: activeAcademicYear.name,
      activeTerm: activeTerm.name,
      termStartDate,
      termEndDate,
    },
  });
}

export async function getSettings(prisma: PrismaClient, schoolCode: string): Promise<SettingsResponse> {
  const [school, saved] = await Promise.all([
    prisma.school.findUnique({
      where: { code: schoolCode },
      select: {
        code: true,
        name: true,
        academicYears: {
          where: { isActive: true },
          orderBy: [{ startsOn: "desc" }],
          select: {
            name: true,
            terms: {
              where: { isActive: true },
              orderBy: [{ startsOn: "desc" }],
              select: {
                name: true,
                startsOn: true,
                endsOn: true,
              },
            },
          },
        },
      },
    }),
    prisma.appSetting.findUnique({ where: { schoolCode } }),
  ]);

  const sections = hydrateAcademicSectionFromDb(
    mergeSections(saved?.sections, school),
    school?.academicYears[0] ?? null,
  );
  return {
    schoolCode,
    sections,
    updatedAt: saved?.updatedAt.toISOString() ?? null,
    updatedBy: saved?.updatedBy ?? null,
  };
}

export async function getSettingsSections(prisma: PrismaClient, schoolCode: string): Promise<SettingsSections> {
  return (await getSettings(prisma, schoolCode)).sections;
}

export async function ensureAcademicSettingsBackedByDatabase(prisma: PrismaClient, schoolCode: string) {
  const [school, saved] = await Promise.all([
    prisma.school.findUnique({
      where: { code: schoolCode },
      select: {
        id: true,
        code: true,
        name: true,
        academicYears: {
          where: { isActive: true },
          orderBy: [{ startsOn: "desc" }],
          select: {
            id: true,
            terms: {
              where: { isActive: true },
              orderBy: [{ startsOn: "desc" }],
              select: { id: true },
            },
          },
        },
      },
    }),
    prisma.appSetting.findUnique({ where: { schoolCode }, select: { sections: true } }),
  ]);

  if (!school) return false;
  if (school.academicYears[0]?.terms[0]) return false;

  const parsed = academicSetupSchema.safeParse((saved?.sections as Partial<SettingsSections> | undefined)?.academic);
  if (!parsed.success) return false;

  await prisma.$transaction(async (tx) => {
    await syncAcademicRows(tx as unknown as AcademicSyncDelegate, school.id, parsed.data);
  });
  return true;
}

export async function patchSettingsSection<K extends SettingSection>(
  prisma: PrismaClient,
  schoolCode: string,
  section: K,
  payload: z.input<(typeof sectionSchemas)[K]>,
  updatedBy?: string | null,
): Promise<SettingsResponse> {
  const current = await getSettings(prisma, schoolCode);
  const parsed = sectionSchemas[section].parse(payload);
  const nextSections = settingsSectionsSchema.parse({
    ...current.sections,
    [section]: parsed,
  });

  const school = await prisma.school.findUnique({
    where: { code: schoolCode },
    select: { id: true, code: true, name: true },
  });
  if (!school) {
    throw new Error(`School ${schoolCode} was not found.`);
  }

  const saved = await prisma.$transaction(async (tx) => {
    if (section === "academic") {
      await syncAcademicRows(
        tx as unknown as AcademicSyncDelegate,
        school.id,
        nextSections.academic,
      );
    }

    return tx.appSetting.upsert({
      where: { schoolCode },
      create: {
        schoolCode,
        sections: nextSections,
        updatedBy: updatedBy ?? null,
      },
      update: {
        sections: nextSections,
        updatedBy: updatedBy ?? null,
      },
    });
  });

  return {
    schoolCode,
    sections: hydrateAcademicSectionFromDb(mergeSections(saved.sections, school), section === "academic"
      ? {
        name: nextSections.academic.activeAcademicYear,
        terms: [{
          name: nextSections.academic.activeTerm,
          startsOn: parseIsoDate(nextSections.academic.termStartDate),
          endsOn: parseIsoDate(nextSections.academic.termEndDate),
        }],
      }
      : null),
    updatedAt: saved.updatedAt.toISOString(),
    updatedBy: saved.updatedBy,
  };
}

