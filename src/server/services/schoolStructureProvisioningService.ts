import type { PrismaClient } from "@prisma/client";
import {
  expandSchoolSections,
  getClassesForSections,
  type CanonicalClass,
  type SchoolSection,
} from "../../shared/constants/classes";
import {
  defaultSettingsSections,
  settingsSectionsSchema,
  type SettingsSections,
} from "../../shared/types/settings";
import { getDefaultSubjectsForSections } from "../../shared/constants/subjects";
import { ensureDefaultSubjectsForSections } from "./subjectProvisioningService";
import { hashPassword } from "./authService";

type StructureDb = Pick<
  PrismaClient,
  "schoolClass" | "stream" | "subject" | "school" | "academicYear" | "term" | "appSetting" | "user" | "auditLog" | "reportLabSubscription" | "reportLabInvoice"
>;

export const CANONICAL_STREAM_CODES = ["A", "B", "C", "D"] as const;
export const DEFAULT_STREAM_CODE = "A";
const OWNER_TEMP_PASSWORD_MIN_LENGTH = 10;

export type CanonicalStreamCode = (typeof CANONICAL_STREAM_CODES)[number];

export type ProvisionStructureOptions = {
  sections: SchoolSection[];
  defaultStreamCodes?: string[];
  defaultStreamsByClassCode?: Record<string, string[]>;
};

export type ProvisionStructureResult = {
  classCount: number;
  streamCount: number;
  subjectCount: number;
  sectionClassCodes: string[];
};

export type OnboardingInput = {
  schoolName: string;
  schoolCode: string;
  phone?: string | null;
  address?: string | null;
  sections: SchoolSection[];
  defaultStreamCodes?: string[];
  defaultStreamsByClassCode?: Record<string, string[]>;
  planCode: string;
  trialDays?: number;
  adminName: string;
  adminEmail: string;
  adminTemporaryPassword: string;
};

export type OnboardingResult = {
  school: {
    id: string;
    code: string;
    name: string;
    phone: string | null;
    address: string | null;
    isActive: boolean;
  };
  subscription: {
    id: string;
    planCode: string;
    status: string;
    currentPeriodEnd: Date;
    studentLimit: number | null;
  };
  invoice: {
    id: string;
    setupFeeUgx: number;
    amountUgx: number;
    totalUgx: number;
    status: string;
  };
  admin: {
    id: string;
    email: string;
    name: string;
    mustChangePassword: boolean;
    tokenVersion: number;
  };
  academicYear: {
    id: string;
    name: string;
    startsOn: Date;
    endsOn: Date;
  };
  activeTerm: {
    id: string;
    name: string;
    startsOn: Date;
    endsOn: Date;
  };
  settings: {
    schoolSections: SchoolSection[];
    defaultStreamCodes: CanonicalStreamCode[];
    brandingMode: "PLATFORM_DEFAULTS";
    reportFooterText: string;
    marksheetFooterText: string;
    logoUrl: string;
  };
  structure: ProvisionStructureResult;
};

export type StructureRepairPreview = {
  schoolCode: string;
  selectedSections: SchoolSection[];
  classCodes: string[];
  streamCodes: string[];
  missingClasses: string[];
  missingStreamsByClassCode: Record<string, string[]>;
  missingSubjects: string[];
  applyChanges: {
    createClasses: number;
    createStreams: number;
    createSubjects: number;
  };
};

function cloneDefaultSettings(): SettingsSections {
  return JSON.parse(JSON.stringify(defaultSettingsSections)) as SettingsSections;
}

export function normalizeSchoolSections(sections: SchoolSection[]): SchoolSection[] {
  const ordered: SchoolSection[] = ["NURSERY", "PRIMARY", "SECONDARY", "COMBINED"];
  const seen = new Set<SchoolSection>();
  for (const section of sections) {
    seen.add(section);
  }
  return ordered.filter((section) => seen.has(section));
}

export function normalizeStreamCodes(codes?: string[]): CanonicalStreamCode[] {
  const source = codes && codes.length > 0 ? codes : [DEFAULT_STREAM_CODE];
  const normalized = source
    .map((code) => code.trim().toUpperCase())
    .filter((code, index, all) => code.length > 0 && all.indexOf(code) === index);

  if (normalized.length === 0) {
    return [DEFAULT_STREAM_CODE];
  }

  for (const code of normalized) {
    if (!CANONICAL_STREAM_CODES.includes(code as CanonicalStreamCode)) {
      throw Object.assign(new Error(`Unsupported stream code: ${code}. Allowed values: ${CANONICAL_STREAM_CODES.join(", ")}.`), { status: 400 });
    }
  }

  return normalized as CanonicalStreamCode[];
}

export function defaultAcademicConfig(now = new Date()) {
  const year = now.getUTCFullYear();
  return {
    academicYearName: `${year}/${year + 1}`,
    academicYearStartsOn: new Date(Date.UTC(year, 0, 1)),
    academicYearEndsOn: new Date(Date.UTC(year + 1, 11, 31)),
    termName: "Term 1",
    termStartsOn: new Date(Date.UTC(year, 0, 1)),
    termEndsOn: new Date(Date.UTC(year, 3, 30)),
  };
}

export function buildSchoolSettings(
  schoolName: string,
  schoolCode: string,
  sections: SchoolSection[],
  now = new Date(),
): SettingsSections {
  const defaults = cloneDefaultSettings();
  const academic = defaultAcademicConfig(now);
  return settingsSectionsSchema.parse({
    ...defaults,
    school: {
      ...defaults.school,
      schoolName,
      schoolCode,
      schoolSections: normalizeSchoolSections(sections),
    },
    academic: {
      ...defaults.academic,
      activeAcademicYear: academic.academicYearName,
      activeTerm: academic.termName,
      termStartDate: academic.termStartsOn.toISOString().slice(0, 10),
      termEndDate: academic.termEndsOn.toISOString().slice(0, 10),
    },
  });
}

function resolveStreamCodesForClass(
  classCode: string,
  options: ProvisionStructureOptions,
): CanonicalStreamCode[] {
  const classSpecific = options.defaultStreamsByClassCode?.[classCode];
  return normalizeStreamCodes(classSpecific ?? options.defaultStreamCodes);
}

async function ensureCanonicalClasses(
  db: Pick<PrismaClient, "schoolClass">,
  schoolId: string,
  sections: SchoolSection[],
): Promise<Array<CanonicalClass & { id: string }>> {
  const classDefs = getClassesForSections(sections);
  for (const classDef of classDefs) {
    await db.schoolClass.upsert({
      where: { schoolId_code: { schoolId, code: classDef.code } },
      create: {
        schoolId,
        name: classDef.name,
        code: classDef.code,
        level: classDef.level,
      },
      update: {
        name: classDef.name,
        level: classDef.level,
      },
    });
  }

  const rows = await db.schoolClass.findMany({
    where: {
      schoolId,
      code: { in: classDefs.map((classDef) => classDef.code) },
    },
    select: { id: true, name: true, code: true, level: true },
    orderBy: { level: "asc" },
  });

  return rows.map((row) => {
    const classDef = classDefs.find((candidate) => candidate.code === row.code)!;
    return {
      id: row.id,
      name: row.name,
      code: row.code,
      level: row.level,
      section: classDef.section,
    };
  });
}

async function ensureCanonicalStreams(
  db: Pick<PrismaClient, "stream">,
  schoolId: string,
  classes: Array<{ id: string; code: string; name: string }>,
  options: ProvisionStructureOptions,
): Promise<number> {
  if (classes.length === 0) return 0;

  const existingStreams = await db.stream.findMany({
    where: { schoolId, classId: { in: classes.map((klass) => klass.id) } },
    select: { id: true, classId: true, code: true },
  });

  const existingKeys = new Set(
    existingStreams.map((stream) => `${stream.classId}:${stream.code.toUpperCase()}`),
  );

  let created = 0;
  for (const klass of classes) {
    for (const code of resolveStreamCodesForClass(klass.code, options)) {
      const key = `${klass.id}:${code}`;
      if (existingKeys.has(key)) continue;
      await db.stream.create({
        data: {
          schoolId,
          classId: klass.id,
          name: code,
          code,
        },
      });
      existingKeys.add(key);
      created += 1;
    }
  }
  return created;
}

export async function provisionCanonicalSchoolStructure(
  db: StructureDb,
  schoolId: string,
  options: ProvisionStructureOptions,
): Promise<ProvisionStructureResult> {
  const classRows = await ensureCanonicalClasses(db, schoolId, options.sections);
  const streamCount = await ensureCanonicalStreams(db, schoolId, classRows, options);
  const subjectResult = await ensureDefaultSubjectsForSections(
    db,
    schoolId,
    options.sections,
    classRows.map((klass) => klass.code),
  );

  return {
    classCount: classRows.length,
    streamCount,
    subjectCount: subjectResult.totalDefaults,
    sectionClassCodes: classRows.map((klass) => klass.code),
  };
}

export async function provisionSchoolOnboarding(
  db: StructureDb,
  input: OnboardingInput,
  actorUserId: string,
  plan: {
    studentLimit: number | null;
    setupFeeUgx: number;
    annualLicenseUgx: number;
  },
  now = new Date(),
): Promise<OnboardingResult> {
  if (input.adminTemporaryPassword.length < OWNER_TEMP_PASSWORD_MIN_LENGTH) {
    throw Object.assign(new Error(`Temporary password must be at least ${OWNER_TEMP_PASSWORD_MIN_LENGTH} characters.`), { status: 400 });
  }

  const passwordHash = await hashPassword(input.adminTemporaryPassword);
  const sections = normalizeSchoolSections(input.sections);
  const defaultStreamCodes = normalizeStreamCodes(input.defaultStreamCodes);
  const settings = buildSchoolSettings(input.schoolName, input.schoolCode, sections, now);
  const academic = defaultAcademicConfig(now);
  const isTrialPeriod = (input.trialDays ?? 0) > 0;
  const currentPeriodEnd = isTrialPeriod
    ? new Date(now.getTime() + (input.trialDays ?? 0) * 24 * 60 * 60 * 1000)
    : new Date(Date.UTC(now.getUTCFullYear() + 1, now.getUTCMonth(), now.getUTCDate()));

  const school = await db.school.create({
    data: {
      code: input.schoolCode,
      name: input.schoolName,
      phone: input.phone ?? null,
      address: input.address ?? null,
      isActive: true,
    },
  });

  const academicYear = await db.academicYear.create({
    data: {
      schoolId: school.id,
      name: academic.academicYearName,
      startsOn: academic.academicYearStartsOn,
      endsOn: academic.academicYearEndsOn,
      isActive: true,
    },
  });

  const activeTerm = await db.term.create({
    data: {
      academicYearId: academicYear.id,
      name: academic.termName,
      startsOn: academic.termStartsOn,
      endsOn: academic.termEndsOn,
      isActive: true,
    },
  });

  await db.appSetting.create({
    data: {
      schoolCode: school.code,
      sections: settings,
      updatedBy: actorUserId,
    },
  });

  const structure = await provisionCanonicalSchoolStructure(db, school.id, {
    sections,
    defaultStreamCodes,
    defaultStreamsByClassCode: input.defaultStreamsByClassCode,
  });

  const subscription = await db.reportLabSubscription.create({
    data: {
      schoolId: school.id,
      planCode: input.planCode,
      billingCycle: "YEAR",
      studentLimit: plan.studentLimit,
      currentPeriodStart: now,
      currentPeriodEnd,
      status: isTrialPeriod ? "TRIAL" : "ACTIVE",
    },
  });

  const invoice = await db.reportLabInvoice.create({
    data: {
      subscriptionId: subscription.id,
      setupFeeUgx: plan.setupFeeUgx,
      amountUgx: plan.annualLicenseUgx,
      totalUgx: plan.setupFeeUgx + plan.annualLicenseUgx,
      status: "UNPAID",
    },
  });

  const admin = await db.user.create({
    data: {
      schoolId: school.id,
      name: input.adminName.trim(),
      email: input.adminEmail.toLowerCase().trim(),
      passwordHash,
      role: "ADMIN_OPERATOR",
      isActive: true,
      mustChangePassword: true,
      tokenVersion: 0,
    },
  });

  await db.auditLog.create({
    data: {
      schoolId: school.id,
      action: "OWNER_CREATE_SCHOOL",
      details: {
        actorUserId,
        schoolCode: school.code,
        schoolName: school.name,
        planCode: input.planCode,
        sections,
        expandedSections: expandSchoolSections(sections),
        streamCodes: defaultStreamCodes,
        classesSeeded: structure.classCount,
        streamsSeeded: structure.streamCount,
        subjectsSeeded: structure.subjectCount,
        adminEmail: admin.email,
        trialDays: input.trialDays ?? null,
        academicYear: academicYear.name,
        activeTerm: activeTerm.name,
      },
    },
  });

  return {
    school: {
      id: school.id,
      code: school.code,
      name: school.name,
      phone: school.phone,
      address: school.address,
      isActive: school.isActive,
    },
    subscription: {
      id: subscription.id,
      planCode: subscription.planCode,
      status: subscription.status,
      currentPeriodEnd: subscription.currentPeriodEnd,
      studentLimit: subscription.studentLimit,
    },
    invoice: {
      id: invoice.id,
      setupFeeUgx: invoice.setupFeeUgx,
      amountUgx: invoice.amountUgx,
      totalUgx: invoice.totalUgx,
      status: invoice.status,
    },
    admin: {
      id: admin.id,
      email: admin.email,
      name: admin.name,
      mustChangePassword: admin.mustChangePassword,
      tokenVersion: admin.tokenVersion,
    },
    academicYear: {
      id: academicYear.id,
      name: academicYear.name,
      startsOn: academicYear.startsOn,
      endsOn: academicYear.endsOn,
    },
    activeTerm: {
      id: activeTerm.id,
      name: activeTerm.name,
      startsOn: activeTerm.startsOn,
      endsOn: activeTerm.endsOn,
    },
    settings: {
      schoolSections: sections,
      defaultStreamCodes,
      brandingMode: "PLATFORM_DEFAULTS",
      reportFooterText: settings.school.reportFooterText,
      marksheetFooterText: settings.school.marksheetFooterText,
      logoUrl: settings.school.logoUrl,
    },
    structure,
  };
}

function inferSectionsFromClasses(classCodes: string[]): SchoolSection[] {
  const sections: SchoolSection[] = [];
  if (classCodes.some((code) => code.startsWith("NUR_"))) sections.push("NURSERY");
  if (classCodes.some((code) => /^P\d+$/i.test(code))) sections.push("PRIMARY");
  if (classCodes.some((code) => /^S\d+$/i.test(code))) sections.push("SECONDARY");
  return sections.length > 0 ? sections : ["SECONDARY"];
}

export async function previewSchoolStructureRepair(
  db: Pick<PrismaClient, "school" | "schoolClass" | "stream" | "subject" | "appSetting">,
  schoolCode: string,
  options: ProvisionStructureOptions = { sections: ["SECONDARY"] },
): Promise<StructureRepairPreview> {
  const school = await db.school.findUnique({
    where: { code: schoolCode },
    select: { id: true, code: true, name: true },
  });
  if (!school) {
    throw Object.assign(new Error(`School not found: ${schoolCode}`), { status: 404 });
  }

  const savedSetting = await db.appSetting.findUnique({
    where: { schoolCode },
    select: { sections: true },
  });

  const savedSections = (savedSetting?.sections as { school?: { schoolSections?: SchoolSection[] } } | null)?.school?.schoolSections;
  const existingClasses = await db.schoolClass.findMany({
    where: { schoolId: school.id },
    select: { id: true, code: true, name: true },
  });
  const selectedSections = normalizeSchoolSections(
    savedSections && savedSections.length > 0
      ? savedSections
      : options.sections.length > 0
      ? options.sections
      : inferSectionsFromClasses(existingClasses.map((klass) => klass.code)),
  );

  const classDefs = getClassesForSections(selectedSections);
  const expectedSubjects = getDefaultSubjectsForSections(selectedSections, classDefs.map((klass) => klass.code));
  const existingStreams = await db.stream.findMany({
    where: { schoolId: school.id },
    select: { classId: true, code: true },
  });
  const existingSubjects = await db.subject.findMany({
    where: { schoolId: school.id },
    select: { code: true, name: true },
  });

  const existingClassCodes = new Set(existingClasses.map((klass) => klass.code.toUpperCase()));
  const missingClasses = classDefs
    .filter((klass) => !existingClassCodes.has(klass.code))
    .map((klass) => klass.code);

  const missingStreamsByClassCode: Record<string, string[]> = {};
  const classMap = new Map(existingClasses.map((klass) => [klass.code, klass]));
  const streamKeys = new Set(existingStreams.map((stream) => `${stream.classId}:${stream.code.toUpperCase()}`));
  const allClassCodes = classDefs.map((klass) => klass.code);
  for (const classCode of allClassCodes) {
    const existingClass = classMap.get(classCode);
    const requiredCodes = resolveStreamCodesForClass(classCode, options);
    if (!existingClass) {
      missingStreamsByClassCode[classCode] = requiredCodes;
      continue;
    }
    const missing = requiredCodes.filter((code) => !streamKeys.has(`${existingClass.id}:${code}`));
    if (missing.length > 0) {
      missingStreamsByClassCode[classCode] = missing;
    }
  }

  const subjectKeys = new Set(
    existingSubjects.flatMap((subject) => [subject.code.toUpperCase(), subject.name.toUpperCase()]),
  );
  const missingSubjects = expectedSubjects
    .filter((subject) => !subjectKeys.has(subject.code.toUpperCase()) && !subjectKeys.has(subject.name.toUpperCase()))
    .map((subject) => subject.code);

  return {
    schoolCode: school.code,
    selectedSections,
    classCodes: classDefs.map((klass) => klass.code),
    streamCodes: normalizeStreamCodes(options.defaultStreamCodes),
    missingClasses,
    missingStreamsByClassCode,
    missingSubjects,
    applyChanges: {
      createClasses: missingClasses.length,
      createStreams: Object.values(missingStreamsByClassCode).reduce((sum, codes) => sum + codes.length, 0),
      createSubjects: missingSubjects.length,
    },
  };
}

export async function applySchoolStructureRepair(
  db: StructureDb,
  schoolCode: string,
  options: ProvisionStructureOptions = { sections: ["SECONDARY"] },
): Promise<StructureRepairPreview> {
  const preview = await previewSchoolStructureRepair(db, schoolCode, options);
  const school = await db.school.findUnique({
    where: { code: schoolCode },
    select: { id: true },
  });
  if (!school) {
    throw Object.assign(new Error(`School not found: ${schoolCode}`), { status: 404 });
  }

  if (preview.applyChanges.createClasses > 0 || preview.applyChanges.createStreams > 0 || preview.applyChanges.createSubjects > 0) {
    await provisionCanonicalSchoolStructure(db, school.id, {
      sections: preview.selectedSections,
      defaultStreamCodes: options.defaultStreamCodes,
      defaultStreamsByClassCode: options.defaultStreamsByClassCode,
    });
  }

  return previewSchoolStructureRepair(db, schoolCode, {
    sections: preview.selectedSections,
    defaultStreamCodes: options.defaultStreamCodes,
    defaultStreamsByClassCode: options.defaultStreamsByClassCode,
  });
}
