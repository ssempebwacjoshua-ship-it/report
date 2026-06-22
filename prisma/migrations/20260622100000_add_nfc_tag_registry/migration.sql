-- NFC Tag Registry — adds NfcTag and NfcTapEvent tables
-- Uses defensive IF NOT EXISTS / DO-block patterns so it is safe to re-run.

-- ── NfcTag ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "NfcTag" (
    "id"          UUID         NOT NULL DEFAULT gen_random_uuid(),
    "schoolId"    UUID         NOT NULL,
    "publicCode"  TEXT         NOT NULL,
    "label"       TEXT,
    "type"        TEXT         NOT NULL DEFAULT 'STUDENT',
    "status"      TEXT         NOT NULL DEFAULT 'UNASSIGNED',
    "studentId"   UUID,
    "writtenUrl"  TEXT,
    "assignedAt"  TIMESTAMP(3),
    "lastSeenAt"  TIMESTAMP(3),
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NfcTag_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "NfcTag_publicCode_key"        ON "NfcTag"("publicCode");
CREATE        INDEX IF NOT EXISTS "NfcTag_schoolId_idx"           ON "NfcTag"("schoolId");
CREATE        INDEX IF NOT EXISTS "NfcTag_schoolId_status_idx"    ON "NfcTag"("schoolId", "status");
CREATE        INDEX IF NOT EXISTS "NfcTag_schoolId_studentId_idx" ON "NfcTag"("schoolId", "studentId");

-- ── NfcTapEvent ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "NfcTapEvent" (
    "id"         UUID         NOT NULL DEFAULT gen_random_uuid(),
    "schoolId"   UUID,
    "tagId"      UUID,
    "studentId"  UUID,
    "publicCode" TEXT         NOT NULL,
    "result"     TEXT         NOT NULL,
    "userAgent"  TEXT,
    "ipHash"     TEXT,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NfcTapEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "NfcTapEvent_publicCode_idx"        ON "NfcTapEvent"("publicCode");
CREATE INDEX IF NOT EXISTS "NfcTapEvent_tagId_createdAt_idx"   ON "NfcTapEvent"("tagId", "createdAt");

-- ── Foreign keys (defensive) ─────────────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'NfcTag_schoolId_fkey' AND table_name = 'NfcTag'
  ) THEN
    ALTER TABLE "NfcTag"
      ADD CONSTRAINT "NfcTag_schoolId_fkey"
      FOREIGN KEY ("schoolId") REFERENCES "School"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'NfcTag_studentId_fkey' AND table_name = 'NfcTag'
  ) THEN
    ALTER TABLE "NfcTag"
      ADD CONSTRAINT "NfcTag_studentId_fkey"
      FOREIGN KEY ("studentId") REFERENCES "Student"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'NfcTapEvent_tagId_fkey' AND table_name = 'NfcTapEvent'
  ) THEN
    ALTER TABLE "NfcTapEvent"
      ADD CONSTRAINT "NfcTapEvent_tagId_fkey"
      FOREIGN KEY ("tagId") REFERENCES "NfcTag"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
