import type { PrismaClient } from "@prisma/client";
import { CANONICAL_CLASSES } from "../../shared/constants/classes";

// Canonical progression: code → next code, or "GRADUATE"
const SORTED_CANONICAL = [...CANONICAL_CLASSES].sort((a, b) => a.level - b.level);

export function getNextClassCode(currentCode: string): string | "GRADUATE" {
  const idx = SORTED_CANONICAL.findIndex((c) => c.code === currentCode.toUpperCase());
  if (idx === -1 || idx === SORTED_CANONICAL.length - 1) return "GRADUATE";
  return SORTED_CANONICAL[idx + 1].code;
}

export type PromotionCandidate = {
  studentId: string;
  studentName: string;
  admissionNumber: string;
  enrollmentId: string;
  fromClassName: string;
  fromClassCode: string;
  fromStreamName: string;
  averageScore: number | null;
  decision: "PROMOTE" | "REPEAT" | "GRADUATE";
  toClassName: string | null;
  toClassCode: string | null;
};

export type PromotionPreviewInput = {
  schoolId: string;
  schoolCode: string;
  academicYearId: string;
  termId: string;
  assessmentType: string;
  classId?: string;
  streamId?: string;
  scoreThreshold?: number;
};

function roundMark(value: number): number {
  return Math.round(value * 10) / 10;
}

export async function previewPromotionCandidates(
  prisma: PrismaClient,
  input: PromotionPreviewInput,
): Promise<PromotionCandidate[]> {
  const threshold = input.scoreThreshold ?? 40;

  const enrollments = await prisma.classEnrollment.findMany({
    where: {
      schoolId: input.schoolId,
      academicYearId: input.academicYearId,
      termId: input.termId,
      ...(input.classId ? { classId: input.classId } : {}),
      ...(input.streamId ? { streamId: input.streamId } : {}),
      isActive: true,
      status: "ACTIVE",
      student: { isActive: true },
    },
    include: {
      student: { select: { id: true, firstName: true, lastName: true, admissionNumber: true } },
      class: { select: { id: true, name: true, code: true } },
      stream: { select: { id: true, name: true, code: true } },
    },
    orderBy: [{ student: { admissionNumber: "asc" } }],
  });

  if (enrollments.length === 0) return [];

  const studentIds = enrollments.map((e) => e.studentId);
  const marks = await prisma.subjectMark.findMany({
    where: {
      schoolId: input.schoolId,
      academicYearId: input.academicYearId,
      termId: input.termId,
      studentId: { in: studentIds },
      status: "FINALIZED",
    },
    select: { studentId: true, marks: true },
  });

  // Average per student across all finalized marks
  const marksByStudent = new Map<string, number[]>();
  for (const mark of marks) {
    const existing = marksByStudent.get(mark.studentId) ?? [];
    existing.push(Number(mark.marks));
    marksByStudent.set(mark.studentId, existing);
  }

  return enrollments.map((enrollment) => {
    const studentMarks = marksByStudent.get(enrollment.studentId) ?? [];
    const average =
      studentMarks.length > 0
        ? roundMark(studentMarks.reduce((sum, m) => sum + m, 0) / studentMarks.length)
        : null;

    const classCode = enrollment.class.code;
    const nextCode = getNextClassCode(classCode);
    const nextCanonical = nextCode === "GRADUATE" ? null : SORTED_CANONICAL.find((c) => c.code === nextCode) ?? null;

    let decision: PromotionCandidate["decision"];
    if (nextCode === "GRADUATE") {
      decision = "GRADUATE";
    } else if (average == null || average < threshold) {
      decision = "REPEAT";
    } else {
      decision = "PROMOTE";
    }

    return {
      studentId: enrollment.studentId,
      studentName: `${enrollment.student.firstName} ${enrollment.student.lastName}`,
      admissionNumber: enrollment.student.admissionNumber,
      enrollmentId: enrollment.id,
      fromClassName: enrollment.class.name,
      fromClassCode: classCode,
      fromStreamName: enrollment.stream.name,
      averageScore: average,
      decision,
      toClassName: nextCanonical?.name ?? null,
      toClassCode: nextCode === "GRADUATE" ? null : nextCode,
    };
  });
}

export type PromotionApplyInput = {
  schoolId: string;
  academicYearId: string;
  termId: string;
  assessmentType: string;
  classId?: string;
  streamId?: string;
  scoreThreshold: number;
  targetAcademicYearId: string;
  targetTermId: string;
  decisions: Array<{
    studentId: string;
    enrollmentId: string;
    fromClassName: string;
    fromClassCode: string;
    fromStreamName: string;
    toClassCode: string | null;
    decision: "PROMOTE" | "REPEAT" | "GRADUATE";
    averageScore: number | null;
    studentName: string;
  }>;
  appliedByName: string;
};

export async function applyPromotions(
  prisma: PrismaClient,
  input: PromotionApplyInput,
): Promise<{ batchId: string; applied: number; errors: string[] }> {
  const errors: string[] = [];

  const batch = await prisma.promotionBatch.create({
    data: {
      schoolId: input.schoolId,
      academicYearId: input.academicYearId,
      termId: input.termId,
      assessmentType: input.assessmentType,
      classId: input.classId ?? null,
      streamId: input.streamId ?? null,
      scoreThreshold: input.scoreThreshold,
      status: "APPLIED",
      appliedByName: input.appliedByName,
    },
  });

  let applied = 0;

  for (const d of input.decisions) {
    try {
      let toEnrollmentId: string | null = null;
      let toClassName: string | null = null;
      let toStreamName: string | null = null;

      if (d.decision === "PROMOTE" || d.decision === "REPEAT") {
        const targetClassCode = d.decision === "PROMOTE" ? d.toClassCode : d.fromClassCode ?? null;

        const targetClass = targetClassCode
          ? await prisma.schoolClass.findFirst({ where: { schoolId: input.schoolId, code: targetClassCode } })
          : null;

        if (targetClass) {
          // Find stream with matching code from source enrollment's stream, fall back to first
          const sourceEnrollment = await prisma.classEnrollment.findUnique({
            where: { id: d.enrollmentId },
            include: { stream: { select: { code: true } } },
          });
          const sourceStreamCode = sourceEnrollment?.stream.code;
          const targetStream = sourceStreamCode
            ? await prisma.stream.findFirst({ where: { classId: targetClass.id, code: sourceStreamCode } }) ??
              await prisma.stream.findFirst({ where: { classId: targetClass.id } })
            : await prisma.stream.findFirst({ where: { classId: targetClass.id } });

          if (targetStream) {
            // Check for duplicate enrollment
            const existing = await prisma.classEnrollment.findFirst({
              where: {
                studentId: d.studentId,
                academicYearId: input.targetAcademicYearId,
                termId: input.targetTermId,
              },
            });

            if (!existing) {
              const newEnrollment = await prisma.classEnrollment.create({
                data: {
                  studentId: d.studentId,
                  schoolId: input.schoolId,
                  academicYearId: input.targetAcademicYearId,
                  termId: input.targetTermId,
                  classId: targetClass.id,
                  streamId: targetStream.id,
                  status: "ACTIVE",
                  isActive: true,
                },
              });
              toEnrollmentId = newEnrollment.id;
              toClassName = targetClass.name;
              toStreamName = targetStream.name;
            } else {
              errors.push(`${d.studentName}: already enrolled in target term, skipped.`);
            }
          } else {
            errors.push(`${d.studentName}: no stream found in target class ${targetClassCode}, skipped.`);
          }
        } else {
          errors.push(`${d.studentName}: target class ${targetClassCode} not found in school, skipped.`);
        }
      }

      // Mark old enrollment COMPLETED
      await prisma.classEnrollment.update({
        where: { id: d.enrollmentId },
        data: { status: "COMPLETED", isActive: false, leftAt: new Date() },
      });

      await prisma.promotionAction.create({
        data: {
          batchId: batch.id,
          schoolId: input.schoolId,
          studentId: d.studentId,
          studentName: d.studentName,
          fromEnrollmentId: d.enrollmentId,
          toEnrollmentId,
          fromClassName: d.fromClassName,
          fromStreamName: d.fromStreamName,
          toClassName,
          toStreamName,
          averageScore: d.averageScore,
          decision: d.decision,
          status: "APPLIED",
        },
      });

      applied++;
    } catch (err) {
      errors.push(`${d.studentName}: unexpected error — ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return { batchId: batch.id, applied, errors };
}

export type ReversalResult = {
  reversed: number;
  blocked: Array<{ studentName: string; reason: string }>;
};

export async function reversePromotionBatch(
  prisma: PrismaClient,
  batchId: string,
  schoolId: string,
  reversedByName: string,
): Promise<ReversalResult> {
  const batch = await prisma.promotionBatch.findFirst({
    where: { id: batchId, schoolId },
    include: { actions: true },
  });

  if (!batch) throw new Error("Promotion batch not found.");
  if (batch.status === "REVERSED") throw new Error("This batch has already been reversed.");

  const blocked: ReversalResult["blocked"] = [];
  let reversed = 0;

  for (const action of batch.actions) {
    if (action.status === "REVERSED") continue;

    // Block reversal if new enrollment already has marks or reports
    if (action.toEnrollmentId) {
      const hasMarks = await prisma.subjectMark.findFirst({
        where: { schoolId, studentId: action.studentId },
        select: { id: true },
      });
      // Check specifically in the target enrollment context
      const newEnrollment = await prisma.classEnrollment.findUnique({
        where: { id: action.toEnrollmentId },
        select: { academicYearId: true, termId: true },
      });
      if (newEnrollment) {
        const hasMarksInNewTerm = await prisma.subjectMark.findFirst({
          where: {
            schoolId,
            studentId: action.studentId,
            academicYearId: newEnrollment.academicYearId,
            termId: newEnrollment.termId,
          },
          select: { id: true },
        });
        if (hasMarksInNewTerm) {
          blocked.push({
            studentName: action.studentName,
            reason: "The new class already has marks recorded. Reverse manually to avoid data loss.",
          });
          continue;
        }
        // Delete the new enrollment
        await prisma.classEnrollment.delete({ where: { id: action.toEnrollmentId } });
      } else if (hasMarks) {
        blocked.push({
          studentName: action.studentName,
          reason: "Student has marks in the system. Remove marks before reversing.",
        });
        continue;
      }
    }

    // Restore old enrollment to ACTIVE
    await prisma.classEnrollment.update({
      where: { id: action.fromEnrollmentId },
      data: { status: "ACTIVE", isActive: true, leftAt: null },
    });

    await prisma.promotionAction.update({
      where: { id: action.id },
      data: { status: "REVERSED" },
    });

    reversed++;
  }

  if (blocked.length === 0) {
    await prisma.promotionBatch.update({
      where: { id: batchId },
      data: { status: "REVERSED", reversedAt: new Date(), reversedByName },
    });
  }

  return { reversed, blocked };
}
