-- Repair live DB drift for StudentAttendanceEvent.
-- Safe/idempotent: fixes missing source/status and related nullable columns.

DO $$
BEGIN
  CREATE TYPE "AttendanceScanSource" AS ENUM ('NFC_WRISTBAND', 'QR_FALLBACK');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "AttendanceScanStatus" AS ENUM ('VALID', 'BLOCKED', 'DUPLICATE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "StudentAttendanceEvent"
ADD COLUMN IF NOT EXISTS "credentialId" UUID;

ALTER TABLE "StudentAttendanceEvent"
ADD COLUMN IF NOT EXISTS "source" "AttendanceScanSource" NOT NULL DEFAULT 'NFC_WRISTBAND';

ALTER TABLE "StudentAttendanceEvent"
ADD COLUMN IF NOT EXISTS "status" "AttendanceScanStatus" NOT NULL DEFAULT 'VALID';

ALTER TABLE "StudentAttendanceEvent"
ADD COLUMN IF NOT EXISTS "reason" TEXT;

DO $$
BEGIN
  ALTER TABLE "StudentAttendanceEvent"
  ADD CONSTRAINT "StudentAttendanceEvent_credentialId_fkey"
  FOREIGN KEY ("credentialId") REFERENCES "StudentCredential"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "StudentAttendanceEvent_schoolId_scannedAt_idx"
ON "StudentAttendanceEvent"("schoolId", "scannedAt");

CREATE INDEX IF NOT EXISTS "StudentAttendanceEvent_schoolId_studentId_scannedAt_idx"
ON "StudentAttendanceEvent"("schoolId", "studentId", "scannedAt");

CREATE INDEX IF NOT EXISTS "StudentAttendanceEvent_schoolId_credentialId_scannedAt_idx"
ON "StudentAttendanceEvent"("schoolId", "credentialId", "scannedAt");
