import type { PrismaClient } from "@prisma/client";
import type {
  DashboardActivity,
  DashboardAttendanceSummary,
  DashboardInventorySummary,
  DashboardStats,
  RecentBatch,
} from "../../shared/types/dashboard";
import { getInventoryDashboardSummary } from "../../modules/inventory/server/services/inventoryService";
import { countCurrentEnrolledStudents } from "./currentEnrollmentService";
import {
  getDashboardAttendanceSummary as getCanonicalDashboardAttendanceSummary,
  getDashboardAttendanceSummaryForSchool as getCanonicalDashboardAttendanceSummaryForSchool,
} from "./locationAttendanceService";

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

const emptyInventorySummary: DashboardInventorySummary = {
  itemsTracked: 0,
  lowStock: 0,
  reportingToday: 0,
  itemsBroughtToday: 0,
  adjustmentsToday: 0,
};

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
      inventory: emptyInventorySummary,
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
    inventory,
  ] = await Promise.all([
    activeTerm
      ? countCurrentEnrolledStudents(prisma, school.id)
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
    getInventoryDashboardSummary(prisma, school.id),
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
    inventory,
    recentBatches,
    recentActivity,
  };
}

export async function getDashboardAttendanceSummary(
  prisma: PrismaClient,
  ctx: { schoolId?: string | null; actorId?: string | null; role?: string | null },
): Promise<DashboardAttendanceSummary> {
  return getCanonicalDashboardAttendanceSummary(ctx, prisma as never);
}

export async function getDashboardAttendanceSummaryForSchool(
  prisma: PrismaClient,
  schoolId: string,
): Promise<DashboardAttendanceSummary> {
  return getCanonicalDashboardAttendanceSummaryForSchool(schoolId, prisma as never);
}

