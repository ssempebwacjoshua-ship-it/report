ALTER TABLE "SmartDocument"
ADD COLUMN IF NOT EXISTS "schoolId" UUID;

CREATE INDEX IF NOT EXISTS "SmartDocument_schoolId_status_createdAt_idx"
  ON "SmartDocument"("schoolId", "status", "createdAt");

CREATE INDEX IF NOT EXISTS "SmartDocument_schoolId_extractionStatus_updatedAt_idx"
  ON "SmartDocument"("schoolId", "extractionStatus", "updatedAt");
