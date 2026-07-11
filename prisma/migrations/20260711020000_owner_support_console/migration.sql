ALTER TABLE "School"
ADD COLUMN IF NOT EXISTS "email" TEXT,
ADD COLUMN IF NOT EXISTS "logoUrl" TEXT,
ADD COLUMN IF NOT EXISTS "timezone" TEXT NOT NULL DEFAULT 'Africa/Kampala',
ADD COLUMN IF NOT EXISTS "brandingMode" TEXT NOT NULL DEFAULT 'PLATFORM_DEFAULTS';

CREATE TABLE IF NOT EXISTS "PlatformSupportSession" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "schoolId" UUID NOT NULL,
  "ownerUserId" UUID NOT NULL,
  "mode" TEXT NOT NULL DEFAULT 'READ_ONLY',
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "reason" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "endedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlatformSupportSession_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PlatformSupportSession_schoolId_status_expiresAt_idx"
  ON "PlatformSupportSession"("schoolId", "status", "expiresAt");

CREATE INDEX IF NOT EXISTS "PlatformSupportSession_ownerUserId_createdAt_idx"
  ON "PlatformSupportSession"("ownerUserId", "createdAt");

CREATE TABLE IF NOT EXISTS "SchoolFeatureFlag" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "schoolId" UUID NOT NULL,
  "feature" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "updatedByUserId" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SchoolFeatureFlag_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SchoolFeatureFlag_schoolId_feature_key"
  ON "SchoolFeatureFlag"("schoolId", "feature");

CREATE INDEX IF NOT EXISTS "SchoolFeatureFlag_schoolId_enabled_idx"
  ON "SchoolFeatureFlag"("schoolId", "enabled");
