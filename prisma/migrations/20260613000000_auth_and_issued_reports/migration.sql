-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN_OPERATOR');

-- CreateEnum
CREATE TYPE "IssuedReportStatus" AS ENUM ('ISSUED', 'REVOKED', 'SUPERSEDED');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'ADMIN_OPERATOR',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IssuedReport" (
    "id" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "academicYear" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "assessmentType" TEXT NOT NULL,
    "reportSnapshotJson" JSONB NOT NULL,
    "referenceCode" TEXT NOT NULL,
    "parentAccessToken" TEXT NOT NULL,
    "status" "IssuedReportStatus" NOT NULL DEFAULT 'ISSUED',
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "issuedById" UUID,
    "issuedByName" TEXT,
    "viewedAt" TIMESTAMP(3),
    "downloadedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IssuedReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_schoolId_email_key" ON "User"("schoolId", "email");

-- CreateIndex
CREATE INDEX "User_schoolId_role_idx" ON "User"("schoolId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "IssuedReport_referenceCode_key" ON "IssuedReport"("referenceCode");

-- CreateIndex
CREATE UNIQUE INDEX "IssuedReport_parentAccessToken_key" ON "IssuedReport"("parentAccessToken");

-- CreateIndex
CREATE INDEX "IssuedReport_parentAccessToken_idx" ON "IssuedReport"("parentAccessToken");

-- CreateIndex
CREATE INDEX "IssuedReport_referenceCode_idx" ON "IssuedReport"("referenceCode");

-- CreateIndex
CREATE INDEX "IssuedReport_schoolId_status_idx" ON "IssuedReport"("schoolId", "status");

-- CreateIndex
CREATE INDEX "IssuedReport_studentId_status_idx" ON "IssuedReport"("studentId", "status");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IssuedReport" ADD CONSTRAINT "IssuedReport_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IssuedReport" ADD CONSTRAINT "IssuedReport_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IssuedReport" ADD CONSTRAINT "IssuedReport_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
