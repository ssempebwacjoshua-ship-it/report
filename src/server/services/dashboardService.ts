import type { PrismaClient } from "@prisma/client";
import type { DashboardActivity, DashboardStats, RecentBatch } from "../../shared/types/dashboard";

function extractRowCount(summary: string | null): number {
  if (!summary) return 0;
  const match = /(\d+)\s+rows?/i.exec(summary);
  return match ? parseInt(match[1], 10) : 0;
}

function formatAuditAction(action: string, details: unknown): string {
  const d =
    typeof details === "object" && details !== null
      ? (details as Record<string, unknown>)
      : {};
  switch (action) {
    case "marks.committed":
      return `Marks imported: ${d.rowCount != null ? String(d.rowCount) : ""} rows`.trim();
    case "marks.dry_run":
      return "Marks dry-run validation completed";
    case "student.import.commit":
      return "Student import committed";
    case "reports.issued":
      return "Reports issued to parents";
    case "reports.released":
      return "Reports released via parent link";
    default:
      return action.replace(/[._]/g, " ");
  }
}

export async function getDashboardStats(
  prisma: PrismaClient,
  schoolCode: string,
): Promise<DashboardStats> {
  const school = await prisma.school.findUnique({
    where: { code: schoolCode },
    include: {
      academicYears: {
        where: { isActive: true },
        include: { terms: { where: { isActive: true } } },
      },
    },
  });

  if (!school) {
    return {
      schoolName: schoolCode,
      activeTerm: null,
      enrolledStudents: 0,
      marksUploadsPendingReview: 0,
      reportsIssuedCount: 0,
      reportsReleasedCount: 0,
      workflow: { marksUploaded: 0, reviewed: 0, generated: 0, approved: 0, released: 0 },
      recentBatches: [],
      recentActivity: [],
    };
  }

  const activeYear = school.academicYears[0];
  const activeTerm = activeYear?.terms[0];

  const [
    enrolledStudents,
    marksUploaded,
    reviewed,
    generated,
    approved,
    released,
    rawBatches,
    rawActivity,
  ] = await Promise.all([
    // Enrolled students in active term
    activeTerm
      ? prisma.classEnrollment.count({
          where: {
            academicYearId: activeYear.id,
            termId: activeTerm.id,
            isActive: true,
            status: "ACTIVE",
          },
        })
      : Promise.resolve(0),

    // Total committed import batches
    prisma.markImportBatch.count({
      where: { schoolId: school.id, status: "COMMITTED" },
    }),

    // Reviewed = committed batches that have at least one finalized mark
    prisma.markImportBatch.count({
      where: {
        schoolId: school.id,
        status: "COMMITTED",
        marks: { some: { status: "FINALIZED" } },
      },
    }),

    // Generated = total issued reports (all statuses)
    prisma.issuedReport.count({ where: { schoolId: school.id } }),

    // Approved = active issued reports (ISSUED status)
    prisma.issuedReport.count({ where: { schoolId: school.id, status: "ISSUED" } }),

    // Released = reports that have been sent to parents
    prisma.issuedReport.count({
      where: { schoolId: school.id, sentAt: { not: null } },
    }),

    // Recent committed batches
    prisma.markImportBatch.findMany({
      where: { schoolId: school.id, status: "COMMITTED" },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, createdAt: true, summary: true, status: true },
    }),

    // Recent audit log
    prisma.auditLog.findMany({
      where: { schoolId: school.id },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { action: true, createdAt: true, details: true },
    }),
  ]);

  // Pending review = committed batches where marks are still all-DRAFT
  const marksUploadsPendingReview = Math.max(marksUploaded - reviewed, 0);

  const recentBatches: RecentBatch[] = rawBatches.map((b) => ({
    id: b.id,
    uploadedAt: b.createdAt.toISOString(),
    rowCount: extractRowCount(b.summary ?? null),
    status: "COMMITTED" as const,
  }));

  const recentActivity: DashboardActivity[] = rawActivity.map((a) => ({
    action: a.action,
    label: formatAuditAction(a.action, a.details),
    occurredAt: a.createdAt.toISOString(),
  }));

  return {
    schoolName: school.name,
    activeTerm: activeTerm
      ? {
          id: activeTerm.id,
          name: activeTerm.name,
          academicYear: activeYear.name,
        }
      : null,
    enrolledStudents,
    marksUploadsPendingReview,
    reportsIssuedCount: approved,
    reportsReleasedCount: released,
    workflow: {
      marksUploaded,
      reviewed,
      generated,
      approved,
      released,
    },
    recentBatches,
    recentActivity,
  };
}
