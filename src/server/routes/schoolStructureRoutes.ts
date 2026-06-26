import { Router } from "express";
import type { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../db/prisma";
import {
  CANONICAL_CLASSES,
  expandSchoolSections,
  getClassesForSections,
  isCanonicalClassCode,
  type SchoolSection,
} from "../../shared/constants/classes";
import { getSettingsSections, patchSettingsSection } from "../repositories/settingsRepository";
import {
  normalizeStreamCodes,
  provisionCanonicalSchoolStructure,
} from "../services/schoolStructureProvisioningService";

const AVAILABLE_SECTIONS = [
  { code: "NURSERY" as const, label: "Nursery / Pre-primary" },
  { code: "PRIMARY" as const, label: "Primary" },
  { code: "SECONDARY" as const, label: "Secondary" },
  // COMBINED currently means PRIMARY + SECONDARY. Add NURSERY separately when needed.
  { code: "COMBINED" as const, label: "Combined Primary + Secondary" },
];

async function buildStructureResponse(school: { id: string; code: string; name: string }) {
  const schoolCode = school.code;
  const settings = await getSettingsSections(prisma, schoolCode);
  const selectedSections: SchoolSection[] = settings.school.schoolSections;

  const allClasses = await prisma.schoolClass.findMany({
    where: { schoolId: school.id },
    orderBy: { level: "asc" },
  });
  const canonicalClasses = allClasses.filter((c) => isCanonicalClassCode(c.code));

  const classIds = canonicalClasses.map((c) => c.id);
  const streams =
    classIds.length > 0
      ? await prisma.stream.findMany({
          where: { classId: { in: classIds } },
          orderBy: { name: "asc" },
        })
      : [];

  const streamsByClassId: Record<string, Array<{ id: string; name: string; code: string }>> = {};
  for (const s of streams) {
    if (!streamsByClassId[s.classId]) streamsByClassId[s.classId] = [];
    streamsByClassId[s.classId]!.push({ id: s.id, name: s.name, code: s.code });
  }

  const classesWithMeta = canonicalClasses.map((c) => {
    const catalogEntry = CANONICAL_CLASSES.find((cc) => cc.code === c.code);
    return {
      id: c.id,
      name: c.name,
      code: c.code,
      level: c.level,
      section: (catalogEntry?.section ?? "SECONDARY") as SchoolSection,
      streams: streamsByClassId[c.id] ?? [],
    };
  });

  const lockWarnings: Partial<Record<SchoolSection, string>> = {};
  for (const section of selectedSections) {
    const sectionClassIds = classesWithMeta.filter((c) => c.section === section).map((c) => c.id);
    if (sectionClassIds.length === 0) continue;
    const [enrollCount, markCount] = await Promise.all([
      prisma.classEnrollment.count({ where: { schoolId: school.id, classId: { in: sectionClassIds } } }),
      prisma.subjectMark.count({ where: { schoolId: school.id, classId: { in: sectionClassIds } } }),
    ]);
    if (enrollCount > 0 || markCount > 0) {
      const label = AVAILABLE_SECTIONS.find((s) => s.code === section)?.label ?? section;
      lockWarnings[section] = `${label} has ${enrollCount} enrolment(s) and ${markCount} mark(s) and cannot be removed without platform-owner approval.`;
    }
  }

  return {
    success: true as const,
    school: { id: school.id, code: school.code, name: school.name },
    selectedSections,
    availableSections: AVAILABLE_SECTIONS,
    canonicalClasses: classesWithMeta,
    streamsByClass: streamsByClassId,
    lockWarnings,
  };
}

const sectionsBodySchema = z.object({
  selectedSections: z.array(z.enum(["NURSERY", "PRIMARY", "SECONDARY", "COMBINED"])).min(1),
});

const streamCreateSchema = z.object({
  classId: z.string().min(1),
  name: z.string().min(1),
  code: z.string().min(1),
});

function requireSchoolContext(
  req: Request,
  res: Response,
): { id: string; code: string; name: string } | null {
  const school = req.school;
  if (!school) {
    res.status(401).json({ success: false, error: "Authentication required." });
    return null;
  }
  return school;
}

export function schoolStructureRoutes() {
  const router = Router();

  router.get("/api/settings/school-structure", async (req, res, next) => {
    try {
      const school = requireSchoolContext(req, res);
      if (!school) return;
      res.json(await buildStructureResponse(school));
    } catch (error) {
      next(error);
    }
  });

  router.patch("/api/settings/school-structure", async (req, res, next) => {
    try {
      const parsed = sectionsBodySchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: "selectedSections must be a non-empty array of NURSERY, PRIMARY, SECONDARY, or COMBINED.",
        });
        return;
      }
      const { selectedSections: newSections } = parsed.data;
      const school = requireSchoolContext(req, res);
      if (!school) return;
      const schoolCode = school.code;

      const currentSettings = await getSettingsSections(prisma, schoolCode);
      const currentSections = currentSettings.school.schoolSections;
      const newInstructionalSections = new Set(expandSchoolSections(newSections));
      const removedSections = expandSchoolSections(currentSections).filter((section) => !newInstructionalSections.has(section));

      if (removedSections.length > 0) {
        const removedCodes = new Set(getClassesForSections(removedSections).map((c) => c.code));
        const removedDbClasses = await prisma.schoolClass.findMany({
          where: { schoolId: school.id, code: { in: Array.from(removedCodes) } },
        });
        if (removedDbClasses.length > 0) {
          const removedClassIds = removedDbClasses.map((c) => c.id);
          const [enrollCount, markCount] = await Promise.all([
            prisma.classEnrollment.count({ where: { schoolId: school.id, classId: { in: removedClassIds } } }),
            prisma.subjectMark.count({ where: { schoolId: school.id, classId: { in: removedClassIds } } }),
          ]);
          if (enrollCount > 0 || markCount > 0) {
            const sectionLabels = removedSections
              .map((s) => AVAILABLE_SECTIONS.find((a) => a.code === s)?.label ?? s)
              .join(", ");
            res.status(409).json({
              success: false,
              code: "SECTION_HAS_DATA",
              error: `The section(s) "${sectionLabels}" have existing students or marks and cannot be removed without platform-owner approval.`,
            });
            return;
          }
        }
      }

      const structure = await provisionCanonicalSchoolStructure(prisma as any, school.id, {
        sections: newSections,
        defaultStreamCodes: ["A"],
      });

      await patchSettingsSection(prisma, schoolCode, "school", {
        ...currentSettings.school,
        schoolSections: newSections,
      });

      res.json({
        ...(await buildStructureResponse(school)),
        provisioning: {
          classesSeeded: structure.classCount,
          streamsCreated: structure.streamCount,
          subjectsProvisioned: structure.subjectCount,
        },
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/settings/school-structure/streams", async (req, res, next) => {
    try {
      const parsed = streamCreateSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, error: "classId, name, and code are required." });
        return;
      }
      const { classId, name, code } = parsed.data;
      const streamName = name.trim();
      const school = requireSchoolContext(req, res);
      if (!school) return;
      let streamCode: string;
      try {
        [streamCode] = normalizeStreamCodes([code]);
      } catch {
        res.status(400).json({ success: false, error: "Stream code must be one of A, B, C, or D." });
        return;
      }

      const klass = await prisma.schoolClass.findFirst({ where: { id: classId, schoolId: school.id } });
      if (!klass) {
        res.status(404).json({ success: false, error: "Class not found." });
        return;
      }
      if (!isCanonicalClassCode(klass.code)) {
        res.status(400).json({ success: false, error: "Streams can only be added to canonical classes." });
        return;
      }

      const existing = await prisma.stream.findFirst({
        where: { classId, schoolId: school.id, code: streamCode },
      });
      if (existing) {
        res.status(409).json({
          success: false,
          error: `Stream "${streamCode}" already exists in ${klass.name}.`,
        });
        return;
      }

      const stream = await prisma.stream.create({
        data: { schoolId: school.id, classId, name: streamName, code: streamCode },
      });

      res.status(201).json({
        success: true,
        stream: { id: stream.id, name: stream.name, code: stream.code },
        message: `Stream ${streamName} added to ${klass.name}.`,
      });
    } catch (error) {
      next(error);
    }
  });

  router.delete("/api/settings/school-structure/streams/:streamId", async (req, res, next) => {
    try {
      const { streamId } = req.params;
      const school = requireSchoolContext(req, res);
      if (!school) return;

      const stream = await prisma.stream.findFirst({ where: { id: streamId, schoolId: school.id } });
      if (!stream) {
        res.status(404).json({ success: false, error: "Stream not found." });
        return;
      }

      const [enrollCount, markCount] = await Promise.all([
        prisma.classEnrollment.count({ where: { schoolId: school.id, streamId } }),
        prisma.subjectMark.count({ where: { schoolId: school.id, streamId } }),
      ]);

      if (enrollCount > 0 || markCount > 0) {
        res.status(409).json({
          success: false,
          code: "STREAM_HAS_DATA",
          error: `Stream "${stream.name}" has ${enrollCount} enrolment(s) and ${markCount} mark(s). It cannot be removed while data exists.`,
        });
        return;
      }

      await prisma.stream.deleteMany({ where: { id: streamId, schoolId: school.id } });
      res.json({ success: true, message: `Stream "${stream.name}" removed.` });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

