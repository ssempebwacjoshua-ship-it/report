import crypto from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { buildParentReportPublicUrl } from "../config/publicUrl";
import { buildReportVersionSignature, isReportLinkExpired, sha256Hex } from "./reportLinkService";

function generateRawParentToken() {
  return crypto.randomBytes(32).toString("hex");
}

function generateReferenceCode() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const suffix = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `${y}${m}${d}-${suffix}`;
}

function generatePublicShortCode() {
  return crypto.randomBytes(5).toString("hex").toUpperCase();
}

async function assignUniquePublicShortCode(prisma: PrismaClient, issuedReportId: string) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const publicShortCode = generatePublicShortCode();
    try {
      const updated = await prisma.issuedReport.update({
        where: { id: issuedReportId },
        data: { publicShortCode },
      });
      return updated.publicShortCode!;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        continue;
      }
      throw error;
    }
  }

  throw new Error("Could not generate a unique public short code for issued report.");
}

export async function ensureIssuedReportPublicShortCode(
  prisma: PrismaClient,
  issuedReport: { id: string; publicShortCode: string | null },
) {
  if (issuedReport.publicShortCode) return issuedReport.publicShortCode;
  return assignUniquePublicShortCode(prisma, issuedReport.id);
}

type IssueOrReuseReportLinkInput = {
  prisma: PrismaClient;
  schoolId: string;
  studentId: string;
  academicYear: string;
  term: string;
  assessmentType: string;
  snapshot: Prisma.InputJsonValue;
  issuedById: string | null;
  issuedByName: string | null;
  auditActorId: string;
  auditActorName: string;
  expiresAt: Date | null;
};

export type IssuedReportLinkResult = {
  issuedReportId: string;
  referenceCode: string;
  parentAccessToken: string | null;
  publicShortCode: string;
  parentLink: string;
  issuedAt: Date;
  reusedExisting: boolean;
};

export async function issueOrReuseIssuedReportLink({
  prisma,
  schoolId,
  studentId,
  academicYear,
  term,
  assessmentType,
  snapshot,
  issuedById,
  issuedByName,
  auditActorId,
  auditActorName,
  expiresAt,
}: IssueOrReuseReportLinkInput): Promise<IssuedReportLinkResult> {
  const snapshotSignature = buildReportVersionSignature(snapshot);
  const existingReports = await prisma.issuedReport.findMany({
    where: {
      schoolId,
      studentId,
      academicYear,
      term,
      assessmentType,
    },
    orderBy: { issuedAt: "desc" },
  });

  const activeExisting = existingReports.find((report) => report.status === "ISSUED" && !isReportLinkExpired(report.expiresAt));
  const activeExistingSignature = activeExisting ? buildReportVersionSignature(activeExisting.reportSnapshotJson) : null;

  if (activeExisting && activeExistingSignature === snapshotSignature) {
    const publicShortCode = await ensureIssuedReportPublicShortCode(prisma, activeExisting);

    await prisma.auditLog.create({
      data: {
        schoolId,
        action: "report.link_reused",
        correlationId: activeExisting.id,
        details: {
          issuedReportId: activeExisting.id,
          referenceCode: activeExisting.referenceCode,
          studentId,
          academicYear,
          term,
          assessmentType,
          actorId: auditActorId,
          actorName: auditActorName,
        },
      },
    });

    return {
      issuedReportId: activeExisting.id,
      referenceCode: activeExisting.referenceCode,
      parentAccessToken: null,
      publicShortCode,
      parentLink: buildParentReportPublicUrl(publicShortCode),
      issuedAt: activeExisting.issuedAt,
      reusedExisting: true,
    };
  }

  if (activeExisting) {
    await prisma.issuedReport.updateMany({
      where: {
        schoolId,
        studentId,
        academicYear,
        term,
        assessmentType,
        status: "ISSUED",
      },
      data: { status: "SUPERSEDED", updatedAt: new Date() },
    });

    await prisma.auditLog.create({
      data: {
        schoolId,
        action: "report.link_replaced",
        correlationId: activeExisting.id,
        details: {
          previousIssuedReportId: activeExisting.id,
          previousReferenceCode: activeExisting.referenceCode,
          studentId,
          academicYear,
          term,
          assessmentType,
          actorId: auditActorId,
          actorName: auditActorName,
        },
      },
    });
  }

  const rawParentToken = generateRawParentToken();
  const parentTokenHash = sha256Hex(rawParentToken);
  const issued = await prisma.issuedReport.create({
    data: {
      schoolId,
      studentId,
      academicYear,
      term,
      assessmentType,
      reportSnapshotJson: snapshot,
      referenceCode: generateReferenceCode(),
      parentAccessToken: parentTokenHash,
      status: "ISSUED",
      expiresAt,
      issuedById,
      issuedByName,
    },
  });

  const publicShortCode = await ensureIssuedReportPublicShortCode(prisma, issued);

  await prisma.auditLog.create({
    data: {
      schoolId,
      action: "report.link_issued",
      correlationId: issued.id,
      details: {
        issuedReportId: issued.id,
        referenceCode: issued.referenceCode,
        studentId,
        academicYear,
        term,
        assessmentType,
        actorId: auditActorId,
        actorName: auditActorName,
      },
    },
  });

  return {
    issuedReportId: issued.id,
    referenceCode: issued.referenceCode,
    parentAccessToken: rawParentToken,
    publicShortCode,
    parentLink: buildParentReportPublicUrl(publicShortCode),
    issuedAt: issued.issuedAt,
    reusedExisting: false,
  };
}
