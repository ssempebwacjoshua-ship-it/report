-- ─── NfcTagBatch: create table if not exists ─────────────────────────────────

CREATE TABLE IF NOT EXISTS "nfc_tag_batch" (
  "id"           UUID         NOT NULL DEFAULT gen_random_uuid(),
  "school_id"    UUID         NOT NULL,
  "name"         TEXT         NOT NULL,
  "tag_mode"     TEXT         NOT NULL,
  "quantity"     INTEGER      NOT NULL DEFAULT 0,
  "status"       TEXT         NOT NULL DEFAULT 'ACTIVE',
  "created_by_id" UUID,
  "created_at"   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  "updated_at"   TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT "nfc_tag_batch_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "nfc_tag_batch_school_id_fkey"
    FOREIGN KEY ("school_id") REFERENCES "school" ("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "nfc_tag_batch_school_id_idx"
  ON "nfc_tag_batch" ("school_id");

CREATE INDEX IF NOT EXISTS "nfc_tag_batch_school_id_tag_mode_idx"
  ON "nfc_tag_batch" ("school_id", "tag_mode");

-- ─── NfcTag: add new columns if not exists ───────────────────────────────────

ALTER TABLE "nfc_tag" ADD COLUMN IF NOT EXISTS "batch_id"      UUID;
ALTER TABLE "nfc_tag" ADD COLUMN IF NOT EXISTS "physical_uid"  TEXT;
ALTER TABLE "nfc_tag" ADD COLUMN IF NOT EXISTS "tag_mode"      TEXT NOT NULL DEFAULT 'URL';
ALTER TABLE "nfc_tag" ADD COLUMN IF NOT EXISTS "purpose"       TEXT NOT NULL DEFAULT 'STUDENT';
ALTER TABLE "nfc_tag" ADD COLUMN IF NOT EXISTS "issued_at"     TIMESTAMPTZ;
ALTER TABLE "nfc_tag" ADD COLUMN IF NOT EXISTS "written_at"    TIMESTAMPTZ;
ALTER TABLE "nfc_tag" ADD COLUMN IF NOT EXISTS "verified_at"   TIMESTAMPTZ;
ALTER TABLE "nfc_tag" ADD COLUMN IF NOT EXISTS "created_by_id" UUID;

-- FK from nfc_tag.batch_id → nfc_tag_batch.id (add if not exists via DO block)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'nfc_tag_batch_id_fkey'
      AND table_name = 'nfc_tag'
  ) THEN
    ALTER TABLE "nfc_tag"
      ADD CONSTRAINT "nfc_tag_batch_id_fkey"
      FOREIGN KEY ("batch_id") REFERENCES "nfc_tag_batch" ("id") ON DELETE SET NULL;
  END IF;
END $$;

-- New indexes on nfc_tag
CREATE INDEX IF NOT EXISTS "nfc_tag_school_id_batch_id_idx"
  ON "nfc_tag" ("school_id", "batch_id");

CREATE INDEX IF NOT EXISTS "nfc_tag_school_id_tag_mode_status_idx"
  ON "nfc_tag" ("school_id", "tag_mode", "status");

-- Partial unique index: no two non-null physicalUids in the same school
CREATE UNIQUE INDEX IF NOT EXISTS "nfc_tag_school_physical_uid_unique_idx"
  ON "nfc_tag" ("school_id", "physical_uid")
  WHERE "physical_uid" IS NOT NULL;
