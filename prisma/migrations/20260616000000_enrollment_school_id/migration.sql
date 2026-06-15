-- Phase 2: Add schoolId directly to ClassEnrollment for tenant-scoped queries.
-- Step 1: Add column as nullable to allow backfill.
ALTER TABLE "ClassEnrollment" ADD COLUMN "schoolId" UUID;

-- Step 2: Backfill schoolId from the related Student record.
UPDATE "ClassEnrollment" ce
SET "schoolId" = s."schoolId"
FROM "Student" s
WHERE ce."studentId" = s.id;

-- Step 3: Enforce NOT NULL now that every row has a value.
ALTER TABLE "ClassEnrollment" ALTER COLUMN "schoolId" SET NOT NULL;

-- Step 4: Add foreign key to School.
ALTER TABLE "ClassEnrollment" ADD CONSTRAINT "ClassEnrollment_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Step 5: Add composite indexes for tenant-scoped queries.
CREATE INDEX "ClassEnrollment_schoolId_academicYearId_termId_classId_streamId_isActive_status_idx"
  ON "ClassEnrollment"("schoolId", "academicYearId", "termId", "classId", "streamId", "isActive", "status");

CREATE INDEX "ClassEnrollment_schoolId_studentId_academicYearId_termId_idx"
  ON "ClassEnrollment"("schoolId", "studentId", "academicYearId", "termId");
