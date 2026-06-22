-- Repair migration: idempotently ensures every NFC wristband schema object exists.
-- Safe to run on a partially-migrated database: uses IF NOT EXISTS + DO-blocks.
-- Covers objects originally from:
--   20260621100000_add_student_credential_foundation
--   20260621120000_prevent_duplicate_active_student_credentials
--   20260621123000_add_nfc_operations_ui_foundation

-- ── Enums ─────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CredentialType') THEN
    CREATE TYPE "CredentialType" AS ENUM ('NFC_WRISTBAND');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CredentialStatus') THEN
    CREATE TYPE "CredentialStatus" AS ENUM ('ACTIVE', 'DEACTIVATED');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'StudentWalletStatus') THEN
    CREATE TYPE "StudentWalletStatus" AS ENUM ('ACTIVE', 'FROZEN');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'WalletTransactionType') THEN
    CREATE TYPE "WalletTransactionType" AS ENUM ('TOP_UP', 'CHARGE', 'ADJUSTMENT');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AttendanceDirection') THEN
    CREATE TYPE "AttendanceDirection" AS ENUM ('TAP_IN', 'TAP_OUT');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AttendanceScanSource') THEN
    CREATE TYPE "AttendanceScanSource" AS ENUM ('NFC_WRISTBAND', 'QR_FALLBACK');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AttendanceScanStatus') THEN
    CREATE TYPE "AttendanceScanStatus" AS ENUM ('VALID', 'BLOCKED', 'DUPLICATE');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'GateScanResult') THEN
    CREATE TYPE "GateScanResult" AS ENUM ('ALLOWED', 'BLOCKED');
  END IF;
END $$;

-- ── UserRole additions ────────────────────────────────────────────────────────

ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'TEACHER';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'CASHIER';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'CANTEEN';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'SECURITY';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'GATE_SECURITY';

-- ── StudentCredential ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "StudentCredential" (
    "id"                UUID              NOT NULL DEFAULT gen_random_uuid(),
    "schoolId"          UUID              NOT NULL,
    "studentId"         UUID              NOT NULL,
    "type"              "CredentialType"  NOT NULL,
    "credentialUID"     TEXT              NOT NULL,
    "status"            "CredentialStatus" NOT NULL DEFAULT 'ACTIVE',
    "issuedAt"          TIMESTAMP(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deactivatedAt"     TIMESTAMP(3),
    "deactivatedReason" TEXT,
    "issuedById"        UUID,
    "createdAt"         TIMESTAMP(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"         TIMESTAMP(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StudentCredential_pkey" PRIMARY KEY ("id")
);

-- scanToken: added separately in 20260621123000 — must be idempotent
ALTER TABLE "StudentCredential" ADD COLUMN IF NOT EXISTS "scanToken" TEXT;

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS "StudentCredential_schoolId_type_credentialUID_key"
    ON "StudentCredential"("schoolId", "type", "credentialUID");
CREATE UNIQUE INDEX IF NOT EXISTS "StudentCredential_scanToken_key"
    ON "StudentCredential"("scanToken");
CREATE INDEX IF NOT EXISTS "StudentCredential_schoolId_idx"
    ON "StudentCredential"("schoolId");
CREATE INDEX IF NOT EXISTS "StudentCredential_studentId_idx"
    ON "StudentCredential"("studentId");
CREATE INDEX IF NOT EXISTS "StudentCredential_schoolId_status_idx"
    ON "StudentCredential"("schoolId", "status");
CREATE INDEX IF NOT EXISTS "StudentCredential_schoolId_type_status_idx"
    ON "StudentCredential"("schoolId", "type", "status");

-- Partial unique index: one active credential per (school, student, type)
-- Preflight: if you have duplicate active credentials, resolve them manually first.
CREATE UNIQUE INDEX IF NOT EXISTS "StudentCredential_one_active_per_student_type_idx"
    ON "StudentCredential"("schoolId", "studentId", "type")
    WHERE "status" = 'ACTIVE';

-- Foreign keys
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'StudentCredential_schoolId_fkey' AND table_name = 'StudentCredential'
  ) THEN
    ALTER TABLE "StudentCredential"
      ADD CONSTRAINT "StudentCredential_schoolId_fkey"
      FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'StudentCredential_studentId_fkey' AND table_name = 'StudentCredential'
  ) THEN
    ALTER TABLE "StudentCredential"
      ADD CONSTRAINT "StudentCredential_studentId_fkey"
      FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'StudentCredential_issuedById_fkey' AND table_name = 'StudentCredential'
  ) THEN
    ALTER TABLE "StudentCredential"
      ADD CONSTRAINT "StudentCredential_issuedById_fkey"
      FOREIGN KEY ("issuedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- ── StudentWallet ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "StudentWallet" (
    "id"           UUID                  NOT NULL DEFAULT gen_random_uuid(),
    "schoolId"     UUID                  NOT NULL,
    "studentId"    UUID                  NOT NULL,
    "balanceCents" INTEGER               NOT NULL DEFAULT 0,
    "status"       "StudentWalletStatus" NOT NULL DEFAULT 'ACTIVE',
    "frozenReason" TEXT,
    "createdAt"    TIMESTAMP(3)          NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3)          NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StudentWallet_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "StudentWallet_studentId_key"
    ON "StudentWallet"("studentId");
CREATE INDEX IF NOT EXISTS "StudentWallet_schoolId_status_idx"
    ON "StudentWallet"("schoolId", "status");
CREATE INDEX IF NOT EXISTS "StudentWallet_schoolId_studentId_idx"
    ON "StudentWallet"("schoolId", "studentId");

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'StudentWallet_schoolId_fkey' AND table_name = 'StudentWallet'
  ) THEN
    ALTER TABLE "StudentWallet"
      ADD CONSTRAINT "StudentWallet_schoolId_fkey"
      FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'StudentWallet_studentId_fkey' AND table_name = 'StudentWallet'
  ) THEN
    ALTER TABLE "StudentWallet"
      ADD CONSTRAINT "StudentWallet_studentId_fkey"
      FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- ── StudentWalletTransaction ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "StudentWalletTransaction" (
    "id"             UUID                   NOT NULL DEFAULT gen_random_uuid(),
    "schoolId"       UUID                   NOT NULL,
    "studentId"      UUID                   NOT NULL,
    "walletId"       UUID                   NOT NULL,
    "credentialId"   UUID,
    "cashierUserId"  UUID,
    "type"           "WalletTransactionType" NOT NULL,
    "amountCents"    INTEGER                NOT NULL,
    "description"    TEXT,
    "idempotencyKey" TEXT,
    "createdAt"      TIMESTAMP(3)           NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StudentWalletTransaction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "StudentWalletTransaction_schoolId_idempotencyKey_key"
    ON "StudentWalletTransaction"("schoolId", "idempotencyKey");
CREATE INDEX IF NOT EXISTS "StudentWalletTransaction_schoolId_createdAt_idx"
    ON "StudentWalletTransaction"("schoolId", "createdAt");
CREATE INDEX IF NOT EXISTS "StudentWalletTransaction_schoolId_studentId_createdAt_idx"
    ON "StudentWalletTransaction"("schoolId", "studentId", "createdAt");
CREATE INDEX IF NOT EXISTS "StudentWalletTransaction_schoolId_walletId_createdAt_idx"
    ON "StudentWalletTransaction"("schoolId", "walletId", "createdAt");

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'StudentWalletTransaction_schoolId_fkey' AND table_name = 'StudentWalletTransaction'
  ) THEN
    ALTER TABLE "StudentWalletTransaction"
      ADD CONSTRAINT "StudentWalletTransaction_schoolId_fkey"
      FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'StudentWalletTransaction_studentId_fkey' AND table_name = 'StudentWalletTransaction'
  ) THEN
    ALTER TABLE "StudentWalletTransaction"
      ADD CONSTRAINT "StudentWalletTransaction_studentId_fkey"
      FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'StudentWalletTransaction_walletId_fkey' AND table_name = 'StudentWalletTransaction'
  ) THEN
    ALTER TABLE "StudentWalletTransaction"
      ADD CONSTRAINT "StudentWalletTransaction_walletId_fkey"
      FOREIGN KEY ("walletId") REFERENCES "StudentWallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'StudentWalletTransaction_credentialId_fkey' AND table_name = 'StudentWalletTransaction'
  ) THEN
    ALTER TABLE "StudentWalletTransaction"
      ADD CONSTRAINT "StudentWalletTransaction_credentialId_fkey"
      FOREIGN KEY ("credentialId") REFERENCES "StudentCredential"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'StudentWalletTransaction_cashierUserId_fkey' AND table_name = 'StudentWalletTransaction'
  ) THEN
    ALTER TABLE "StudentWalletTransaction"
      ADD CONSTRAINT "StudentWalletTransaction_cashierUserId_fkey"
      FOREIGN KEY ("cashierUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- ── StudentAttendanceEvent ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "StudentAttendanceEvent" (
    "id"           UUID                   NOT NULL DEFAULT gen_random_uuid(),
    "schoolId"     UUID                   NOT NULL,
    "studentId"    UUID                   NOT NULL,
    "credentialId" UUID,
    "direction"    "AttendanceDirection"  NOT NULL,
    "source"       "AttendanceScanSource" NOT NULL DEFAULT 'NFC_WRISTBAND',
    "status"       "AttendanceScanStatus" NOT NULL DEFAULT 'VALID',
    "reason"       TEXT,
    "scannedAt"    TIMESTAMP(3)           NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StudentAttendanceEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "StudentAttendanceEvent_schoolId_scannedAt_idx"
    ON "StudentAttendanceEvent"("schoolId", "scannedAt");
CREATE INDEX IF NOT EXISTS "StudentAttendanceEvent_schoolId_studentId_scannedAt_idx"
    ON "StudentAttendanceEvent"("schoolId", "studentId", "scannedAt");
CREATE INDEX IF NOT EXISTS "StudentAttendanceEvent_schoolId_credentialId_scannedAt_idx"
    ON "StudentAttendanceEvent"("schoolId", "credentialId", "scannedAt");

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'StudentAttendanceEvent_schoolId_fkey' AND table_name = 'StudentAttendanceEvent'
  ) THEN
    ALTER TABLE "StudentAttendanceEvent"
      ADD CONSTRAINT "StudentAttendanceEvent_schoolId_fkey"
      FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'StudentAttendanceEvent_studentId_fkey' AND table_name = 'StudentAttendanceEvent'
  ) THEN
    ALTER TABLE "StudentAttendanceEvent"
      ADD CONSTRAINT "StudentAttendanceEvent_studentId_fkey"
      FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'StudentAttendanceEvent_credentialId_fkey' AND table_name = 'StudentAttendanceEvent'
  ) THEN
    ALTER TABLE "StudentAttendanceEvent"
      ADD CONSTRAINT "StudentAttendanceEvent_credentialId_fkey"
      FOREIGN KEY ("credentialId") REFERENCES "StudentCredential"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- ── NfcGateScan ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "NfcGateScan" (
    "id"              UUID             NOT NULL DEFAULT gen_random_uuid(),
    "schoolId"        UUID             NOT NULL,
    "studentId"       UUID,
    "credentialId"    UUID,
    "scannedByUserId" UUID,
    "result"          "GateScanResult" NOT NULL,
    "reason"          TEXT,
    "scannedAt"       TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NfcGateScan_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "NfcGateScan_schoolId_scannedAt_idx"
    ON "NfcGateScan"("schoolId", "scannedAt");
CREATE INDEX IF NOT EXISTS "NfcGateScan_schoolId_studentId_scannedAt_idx"
    ON "NfcGateScan"("schoolId", "studentId", "scannedAt");
CREATE INDEX IF NOT EXISTS "NfcGateScan_schoolId_credentialId_scannedAt_idx"
    ON "NfcGateScan"("schoolId", "credentialId", "scannedAt");

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'NfcGateScan_schoolId_fkey' AND table_name = 'NfcGateScan'
  ) THEN
    ALTER TABLE "NfcGateScan"
      ADD CONSTRAINT "NfcGateScan_schoolId_fkey"
      FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'NfcGateScan_studentId_fkey' AND table_name = 'NfcGateScan'
  ) THEN
    ALTER TABLE "NfcGateScan"
      ADD CONSTRAINT "NfcGateScan_studentId_fkey"
      FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'NfcGateScan_credentialId_fkey' AND table_name = 'NfcGateScan'
  ) THEN
    ALTER TABLE "NfcGateScan"
      ADD CONSTRAINT "NfcGateScan_credentialId_fkey"
      FOREIGN KEY ("credentialId") REFERENCES "StudentCredential"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'NfcGateScan_scannedByUserId_fkey' AND table_name = 'NfcGateScan'
  ) THEN
    ALTER TABLE "NfcGateScan"
      ADD CONSTRAINT "NfcGateScan_scannedByUserId_fkey"
      FOREIGN KEY ("scannedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
