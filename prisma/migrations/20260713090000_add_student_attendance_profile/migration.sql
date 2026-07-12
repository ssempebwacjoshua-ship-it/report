DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'AttendanceProfile'
  ) THEN
    CREATE TYPE "AttendanceProfile" AS ENUM ('DAY_SCHOLAR', 'BOARDER');
  END IF;
END $$;

ALTER TABLE "Student"
ADD COLUMN IF NOT EXISTS "attendanceProfile" "AttendanceProfile";

UPDATE "Student"
SET "attendanceProfile" = CASE
  WHEN "studentType" = 'BOARDING' THEN 'BOARDER'::"AttendanceProfile"
  ELSE 'DAY_SCHOLAR'::"AttendanceProfile"
END
WHERE "attendanceProfile" IS NULL;

ALTER TABLE "Student"
ALTER COLUMN "attendanceProfile" SET DEFAULT 'DAY_SCHOLAR';
