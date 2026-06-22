-- ─── NfcTagBatch: create table if not exists ─────────────────────────────────

CREATE TABLE IF NOT EXISTS "NfcTagBatch" (
  "id"          UUID         NOT NULL DEFAULT gen_random_uuid(),
  "schoolId"    UUID         NOT NULL,
  "name"        TEXT         NOT NULL,
  "tagMode"     TEXT         NOT NULL,
  "quantity"    INTEGER      NOT NULL DEFAULT 0,
  "status"      TEXT         NOT NULL DEFAULT 'ACTIVE',
  "createdById" UUID,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "NfcTagBatch_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "NfcTagBatch_schoolId_idx"
  ON "NfcTagBatch" ("schoolId");

CREATE INDEX IF NOT EXISTS "NfcTagBatch_schoolId_tagMode_idx"
  ON "NfcTagBatch" ("schoolId", "tagMode");

-- FK: NfcTagBatch.schoolId → School.id
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'NfcTagBatch_schoolId_fkey'
      AND table_name = 'NfcTagBatch'
  ) THEN
    ALTER TABLE "NfcTagBatch"
      ADD CONSTRAINT "NfcTagBatch_schoolId_fkey"
      FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- ─── NfcTag: add new columns if not exists ───────────────────────────────────

ALTER TABLE "NfcTag" ADD COLUMN IF NOT EXISTS "batchId"     UUID;
ALTER TABLE "NfcTag" ADD COLUMN IF NOT EXISTS "physicalUid" TEXT;
ALTER TABLE "NfcTag" ADD COLUMN IF NOT EXISTS "tagMode"     TEXT NOT NULL DEFAULT 'URL';
ALTER TABLE "NfcTag" ADD COLUMN IF NOT EXISTS "purpose"     TEXT NOT NULL DEFAULT 'STUDENT';
ALTER TABLE "NfcTag" ADD COLUMN IF NOT EXISTS "issuedAt"    TIMESTAMP(3);
ALTER TABLE "NfcTag" ADD COLUMN IF NOT EXISTS "writtenAt"   TIMESTAMP(3);
ALTER TABLE "NfcTag" ADD COLUMN IF NOT EXISTS "verifiedAt"  TIMESTAMP(3);
ALTER TABLE "NfcTag" ADD COLUMN IF NOT EXISTS "createdById" UUID;

-- FK: NfcTag.batchId → NfcTagBatch.id
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'NfcTag_batchId_fkey'
      AND table_name = 'NfcTag'
  ) THEN
    ALTER TABLE "NfcTag"
      ADD CONSTRAINT "NfcTag_batchId_fkey"
      FOREIGN KEY ("batchId") REFERENCES "NfcTagBatch"("id") ON DELETE SET NULL;
  END IF;
END $$;

-- New indexes on NfcTag
CREATE INDEX IF NOT EXISTS "NfcTag_schoolId_batchId_idx"
  ON "NfcTag" ("schoolId", "batchId");

CREATE INDEX IF NOT EXISTS "NfcTag_schoolId_tagMode_status_idx"
  ON "NfcTag" ("schoolId", "tagMode", "status");

-- Partial unique index: one physicalUid per school (ignoring NULLs)
CREATE UNIQUE INDEX IF NOT EXISTS "NfcTag_schoolId_physicalUid_key"
  ON "NfcTag" ("schoolId", "physicalUid")
  WHERE "physicalUid" IS NOT NULL;
