-- CreateEnum
CREATE TYPE "EnrollmentStatus" AS ENUM ('ACTIVE', 'TRANSFERRED', 'COMPLETED', 'INACTIVE');

-- CreateEnum
CREATE TYPE "PreferredContactMethod" AS ENUM ('PHONE', 'SMS', 'EMAIL', 'WHATSAPP');

-- AlterEnum
ALTER TYPE "AssessmentType" ADD VALUE 'MOT';

-- DropIndex
DROP INDEX "ClassEnrollment_academicYearId_termId_classId_streamId_isAc_idx";

-- AlterTable
ALTER TABLE "ClassEnrollment" ADD COLUMN     "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "leftAt" TIMESTAMP(3),
ADD COLUMN     "status" "EnrollmentStatus" NOT NULL DEFAULT 'ACTIVE';

-- CreateTable
CREATE TABLE "GuardianContact" (
    "id" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "guardianName" TEXT NOT NULL,
    "relationship" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "preferredContactMethod" "PreferredContactMethod" NOT NULL DEFAULT 'PHONE',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "canReceiveReports" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuardianContact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GuardianContact_schoolId_studentId_isPrimary_idx" ON "GuardianContact"("schoolId", "studentId", "isPrimary");

-- CreateIndex
CREATE INDEX "GuardianContact_studentId_canReceiveReports_idx" ON "GuardianContact"("studentId", "canReceiveReports");

-- CreateIndex
CREATE UNIQUE INDEX "GuardianContact_studentId_guardianName_relationship_key" ON "GuardianContact"("studentId", "guardianName", "relationship");

-- CreateIndex
CREATE INDEX "ClassEnrollment_academicYearId_termId_classId_streamId_isAc_idx" ON "ClassEnrollment"("academicYearId", "termId", "classId", "streamId", "isActive", "status");

-- AddForeignKey
ALTER TABLE "GuardianContact" ADD CONSTRAINT "GuardianContact_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuardianContact" ADD CONSTRAINT "GuardianContact_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
