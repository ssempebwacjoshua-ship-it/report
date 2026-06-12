import type { PrismaClient } from "@prisma/client";
import type { z } from "zod";
import {
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
          marksheets: { ...defaults.marksheets, ...((saved as Partial<SettingsSections>).marksheets ?? {}) },
          ocr: { ...defaults.ocr, ...((saved as Partial<SettingsSections>).ocr ?? {}) },
          grading: { ...defaults.grading, ...((saved as Partial<SettingsSections>).grading ?? {}) },
          approval: { ...defaults.approval, ...((saved as Partial<SettingsSections>).approval ?? {}) },
          appearance: { ...defaults.appearance, ...((saved as Partial<SettingsSections>).appearance ?? {}) },
        }
      : defaults;

  return settingsSectionsSchema.parse(candidate);
}

export async function getSettings(prisma: PrismaClient, schoolCode = "SCU-PREVIEW"): Promise<SettingsResponse> {
  const [school, saved] = await Promise.all([
    prisma.school.findUnique({ where: { code: schoolCode }, select: { code: true, name: true } }),
    prisma.appSetting.findUnique({ where: { schoolCode } }),
  ]);

  const sections = mergeSections(saved?.sections, school);
  return {
    schoolCode,
    sections,
    updatedAt: saved?.updatedAt.toISOString() ?? null,
    updatedBy: saved?.updatedBy ?? null,
  };
}

export async function getSettingsSections(prisma: PrismaClient, schoolCode = "SCU-PREVIEW"): Promise<SettingsSections> {
  return (await getSettings(prisma, schoolCode)).sections;
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

  const saved = await prisma.appSetting.upsert({
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

  return {
    schoolCode,
    sections: mergeSections(saved.sections),
    updatedAt: saved.updatedAt.toISOString(),
    updatedBy: saved.updatedBy,
  };
}
