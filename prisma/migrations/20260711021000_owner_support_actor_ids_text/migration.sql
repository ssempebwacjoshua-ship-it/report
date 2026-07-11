ALTER TABLE "PlatformSupportSession"
ALTER COLUMN "ownerUserId" TYPE TEXT USING "ownerUserId"::TEXT;

ALTER TABLE "SchoolFeatureFlag"
ALTER COLUMN "updatedByUserId" TYPE TEXT USING "updatedByUserId"::TEXT;
