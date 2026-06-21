-- Add promotion batch/action tables used by Reports and Promotions.

CREATE TYPE "PromotionBatchStatus" AS ENUM ('APPLIED', 'REVERSED');
CREATE TYPE "PromotionDecision" AS ENUM ('PROMOTE', 'REPEAT', 'GRADUATE');
CREATE TYPE "PromotionActionStatus" AS ENUM ('APPLIED', 'REVERSED');

CREATE TABLE "PromotionBatch" (
    "id" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "academicYearId" UUID NOT NULL,
    "termId" UUID NOT NULL,
    "assessmentType" TEXT NOT NULL,
    "classId" UUID,
    "streamId" UUID,
    "scoreThreshold" DOUBLE PRECISION NOT NULL DEFAULT 40,
    "status" "PromotionBatchStatus" NOT NULL DEFAULT 'APPLIED',
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "appliedByName" TEXT,
    "reversedAt" TIMESTAMP(3),
    "reversedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromotionBatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PromotionAction" (
    "id" UUID NOT NULL,
    "batchId" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "studentName" TEXT NOT NULL,
    "fromEnrollmentId" UUID NOT NULL,
    "toEnrollmentId" UUID,
    "fromClassName" TEXT NOT NULL,
    "fromStreamName" TEXT NOT NULL,
    "toClassName" TEXT,
    "toStreamName" TEXT,
    "averageScore" DOUBLE PRECISION,
    "decision" "PromotionDecision" NOT NULL,
    "status" "PromotionActionStatus" NOT NULL DEFAULT 'APPLIED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromotionAction_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PromotionBatch_schoolId_status_createdAt_idx" ON "PromotionBatch"("schoolId", "status", "createdAt");
CREATE INDEX "PromotionBatch_schoolId_academicYearId_termId_idx" ON "PromotionBatch"("schoolId", "academicYearId", "termId");

CREATE INDEX "PromotionAction_batchId_idx" ON "PromotionAction"("batchId");
CREATE INDEX "PromotionAction_schoolId_studentId_status_idx" ON "PromotionAction"("schoolId", "studentId", "status");

ALTER TABLE "PromotionBatch"
    ADD CONSTRAINT "PromotionBatch_schoolId_fkey"
    FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PromotionAction"
    ADD CONSTRAINT "PromotionAction_batchId_fkey"
    FOREIGN KEY ("batchId") REFERENCES "PromotionBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PromotionAction"
    ADD CONSTRAINT "PromotionAction_schoolId_fkey"
    FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PromotionAction"
    ADD CONSTRAINT "PromotionAction_studentId_fkey"
    FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
