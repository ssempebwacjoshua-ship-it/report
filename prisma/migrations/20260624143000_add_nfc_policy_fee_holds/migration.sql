-- NFC fee-defaulter blocking and attendance cut-off controls.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'FeeDefaulterBlockScope') THEN
    CREATE TYPE "FeeDefaulterBlockScope" AS ENUM ('DAY_SCHOLARS_ONLY', 'ALL_STUDENTS');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AttendanceLateAction') THEN
    CREATE TYPE "AttendanceLateAction" AS ENUM ('BLOCK_AND_MARK_ABSENT', 'ALLOW_BUT_MARK_LATE');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'StudentFeeHoldStatus') THEN
    CREATE TYPE "StudentFeeHoldStatus" AS ENUM ('ACTIVE', 'CLEARED', 'CANCELLED');
  END IF;
END $$;

ALTER TYPE "AttendanceScanStatus" ADD VALUE IF NOT EXISTS 'LATE';

CREATE TABLE IF NOT EXISTS "SchoolNfcPolicy" (
  "id" UUID NOT NULL,
  "schoolId" UUID NOT NULL,
  "feeDefaulterBlockingEnabled" BOOLEAN NOT NULL DEFAULT false,
  "feeDefaulterBlockScope" "FeeDefaulterBlockScope" NOT NULL DEFAULT 'DAY_SCHOLARS_ONLY',
  "attendanceTapInCutoffEnabled" BOOLEAN NOT NULL DEFAULT false,
  "tapInCutoffTime" TEXT,
  "cutoffLateAction" "AttendanceLateAction" NOT NULL DEFAULT 'BLOCK_AND_MARK_ABSENT',
  "timezone" TEXT NOT NULL DEFAULT 'Africa/Kampala',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "updatedByUserId" UUID,

  CONSTRAINT "SchoolNfcPolicy_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SchoolNfcPolicy_schoolId_key" ON "SchoolNfcPolicy"("schoolId");
CREATE INDEX IF NOT EXISTS "SchoolNfcPolicy_schoolId_idx" ON "SchoolNfcPolicy"("schoolId");

CREATE TABLE IF NOT EXISTS "StudentFeeHold" (
  "id" UUID NOT NULL,
  "schoolId" UUID NOT NULL,
  "studentId" UUID NOT NULL,
  "status" "StudentFeeHoldStatus" NOT NULL DEFAULT 'ACTIVE',
  "reason" TEXT,
  "balanceDueCents" INTEGER,
  "effectiveFrom" TIMESTAMP(3),
  "clearedAt" TIMESTAMP(3),
  "createdByUserId" UUID,
  "clearedByUserId" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "StudentFeeHold_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "StudentFeeHold_schoolId_studentId_status_idx" ON "StudentFeeHold"("schoolId", "studentId", "status");
CREATE INDEX IF NOT EXISTS "StudentFeeHold_schoolId_status_createdAt_idx" ON "StudentFeeHold"("schoolId", "status", "createdAt");

ALTER TABLE "SchoolNfcPolicy"
  ADD CONSTRAINT "SchoolNfcPolicy_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SchoolNfcPolicy"
  ADD CONSTRAINT "SchoolNfcPolicy_updatedByUserId_fkey"
  FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "StudentFeeHold"
  ADD CONSTRAINT "StudentFeeHold_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StudentFeeHold"
  ADD CONSTRAINT "StudentFeeHold_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StudentFeeHold"
  ADD CONSTRAINT "StudentFeeHold_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "StudentFeeHold"
  ADD CONSTRAINT "StudentFeeHold_clearedByUserId_fkey"
  FOREIGN KEY ("clearedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
