-- Fix: StudentAttendanceEvent.source column missing in environments where the
-- table was created before the NFC operations migration ran (CREATE TABLE IF NOT
-- EXISTS was a no-op, so the column was never added to the existing table).

-- Ensure the enum type exists first
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AttendanceScanSource') THEN
    CREATE TYPE "AttendanceScanSource" AS ENUM ('NFC_WRISTBAND', 'QR_FALLBACK');
  END IF;
END $$;

-- Add the column; safe no-op if it already exists
ALTER TABLE "StudentAttendanceEvent"
  ADD COLUMN IF NOT EXISTS "source" "AttendanceScanSource" NOT NULL DEFAULT 'NFC_WRISTBAND';
