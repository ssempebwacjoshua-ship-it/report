-- NFC operations foundation: neutral tag token, attendance, wallets, canteen charges, and gate scans.
-- This migration is defensive because some NFC enum/table pieces may already exist from earlier/failed migration attempts.

ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'TEACHER';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'CASHIER';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'CANTEEN';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'SECURITY';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'GATE_SECURITY';

DO $$
BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'StudentWalletStatus') THEN
CREATE TYPE "StudentWalletStatus" AS ENUM ('ACTIVE', 'FROZEN');
END IF;
END $$;

DO $$
BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'WalletTransactionType') THEN
CREATE TYPE "WalletTransactionType" AS ENUM ('TOP_UP', 'CHARGE', 'ADJUSTMENT');
END IF;
END $$;

DO $$
BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AttendanceDirection') THEN
CREATE TYPE "AttendanceDirection" AS ENUM ('TAP_IN', 'TAP_OUT');
END IF;
END $$;

DO $$
BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AttendanceScanSource') THEN
CREATE TYPE "AttendanceScanSource" AS ENUM ('NFC_WRISTBAND', 'QR_FALLBACK');
END IF;
END $$;

DO $$
BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AttendanceScanStatus') THEN
CREATE TYPE "AttendanceScanStatus" AS ENUM ('VALID', 'BLOCKED', 'DUPLICATE');
END IF;
END $$;

DO $$
BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'GateScanResult') THEN
CREATE TYPE "GateScanResult" AS ENUM ('ALLOWED', 'BLOCKED');
END IF;
END $$;

ALTER TABLE "StudentCredential"
ADD COLUMN IF NOT EXISTS "scanToken" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "StudentCredential_scanToken_key"
ON "StudentCredential"("scanToken");

CREATE TABLE IF NOT EXISTS "StudentWallet" (
"id" UUID NOT NULL,
"schoolId" UUID NOT NULL,
"studentId" UUID NOT NULL,
"balanceCents" INTEGER NOT NULL DEFAULT 0,
"status" "StudentWalletStatus" NOT NULL DEFAULT 'ACTIVE',
"frozenReason" TEXT,
"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
"updatedAt" TIMESTAMP(3) NOT NULL,

CONSTRAINT "StudentWallet_pkey" PRIMARY KEY ("id")

);

CREATE TABLE IF NOT EXISTS "StudentWalletTransaction" (
"id" UUID NOT NULL,
"schoolId" UUID NOT NULL,
"studentId" UUID NOT NULL,
"walletId" UUID NOT NULL,
"credentialId" UUID,
"cashierUserId" UUID,
"type" "WalletTransactionType" NOT NULL,
"amountCents" INTEGER NOT NULL,
"description" TEXT,
"idempotencyKey" TEXT,
"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

CONSTRAINT "StudentWalletTransaction_pkey" PRIMARY KEY ("id")

);

CREATE TABLE IF NOT EXISTS "StudentAttendanceEvent" (
"id" UUID NOT NULL,
"schoolId" UUID NOT NULL,
"studentId" UUID NOT NULL,
"credentialId" UUID,
"direction" "AttendanceDirection" NOT NULL,
"source" "AttendanceScanSource" NOT NULL DEFAULT 'NFC_WRISTBAND',
"status" "AttendanceScanStatus" NOT NULL DEFAULT 'VALID',
"reason" TEXT,
"scannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

CONSTRAINT "StudentAttendanceEvent_pkey" PRIMARY KEY ("id")

);

CREATE TABLE IF NOT EXISTS "NfcGateScan" (
"id" UUID NOT NULL,
"schoolId" UUID NOT NULL,
"studentId" UUID,
"credentialId" UUID,
"scannedByUserId" UUID,
"result" "GateScanResult" NOT NULL,
"reason" TEXT,
"scannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

CONSTRAINT "NfcGateScan_pkey" PRIMARY KEY ("id")

);

CREATE UNIQUE INDEX IF NOT EXISTS "StudentWallet_studentId_key"
ON "StudentWallet"("studentId");

CREATE INDEX IF NOT EXISTS "StudentWallet_schoolId_status_idx"
ON "StudentWallet"("schoolId", "status");

CREATE INDEX IF NOT EXISTS "StudentWallet_schoolId_studentId_idx"
ON "StudentWallet"("schoolId", "studentId");

CREATE UNIQUE INDEX IF NOT EXISTS "StudentWalletTransaction_schoolId_idempotencyKey_key"
ON "StudentWalletTransaction"("schoolId", "idempotencyKey");

CREATE INDEX IF NOT EXISTS "StudentWalletTransaction_schoolId_createdAt_idx"
ON "StudentWalletTransaction"("schoolId", "createdAt");

CREATE INDEX IF NOT EXISTS "StudentWalletTransaction_schoolId_studentId_createdAt_idx"
ON "StudentWalletTransaction"("schoolId", "studentId", "createdAt");

CREATE INDEX IF NOT EXISTS "StudentWalletTransaction_schoolId_walletId_createdAt_idx"
ON "StudentWalletTransaction"("schoolId", "walletId", "createdAt");

CREATE INDEX IF NOT EXISTS "StudentAttendanceEvent_schoolId_scannedAt_idx"
ON "StudentAttendanceEvent"("schoolId", "scannedAt");

CREATE INDEX IF NOT EXISTS "StudentAttendanceEvent_schoolId_studentId_scannedAt_idx"
ON "StudentAttendanceEvent"("schoolId", "studentId", "scannedAt");

CREATE INDEX IF NOT EXISTS "StudentAttendanceEvent_schoolId_credentialId_scannedAt_idx"
ON "StudentAttendanceEvent"("schoolId", "credentialId", "scannedAt");

CREATE INDEX IF NOT EXISTS "NfcGateScan_schoolId_scannedAt_idx"
ON "NfcGateScan"("schoolId", "scannedAt");

CREATE INDEX IF NOT EXISTS "NfcGateScan_schoolId_studentId_scannedAt_idx"
ON "NfcGateScan"("schoolId", "studentId", "scannedAt");

CREATE INDEX IF NOT EXISTS "NfcGateScan_schoolId_credentialId_scannedAt_idx"
ON "NfcGateScan"("schoolId", "credentialId", "scannedAt");

DO $$
BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StudentWallet_schoolId_fkey') THEN
ALTER TABLE "StudentWallet"
ADD CONSTRAINT "StudentWallet_schoolId_fkey"
FOREIGN KEY ("schoolId") REFERENCES "School"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
END IF;
END $$;

DO $$
BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StudentWallet_studentId_fkey') THEN
ALTER TABLE "StudentWallet"
ADD CONSTRAINT "StudentWallet_studentId_fkey"
FOREIGN KEY ("studentId") REFERENCES "Student"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
END IF;
END $$;

DO $$
BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StudentWalletTransaction_schoolId_fkey') THEN
ALTER TABLE "StudentWalletTransaction"
ADD CONSTRAINT "StudentWalletTransaction_schoolId_fkey"
FOREIGN KEY ("schoolId") REFERENCES "School"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
END IF;
END $$;

DO $$
BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StudentWalletTransaction_studentId_fkey') THEN
ALTER TABLE "StudentWalletTransaction"
ADD CONSTRAINT "StudentWalletTransaction_studentId_fkey"
FOREIGN KEY ("studentId") REFERENCES "Student"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
END IF;
END $$;

DO $$
BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StudentWalletTransaction_walletId_fkey') THEN
ALTER TABLE "StudentWalletTransaction"
ADD CONSTRAINT "StudentWalletTransaction_walletId_fkey"
FOREIGN KEY ("walletId") REFERENCES "StudentWallet"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
END IF;
END $$;

DO $$
BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StudentWalletTransaction_credentialId_fkey') THEN
ALTER TABLE "StudentWalletTransaction"
ADD CONSTRAINT "StudentWalletTransaction_credentialId_fkey"
FOREIGN KEY ("credentialId") REFERENCES "StudentCredential"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
END IF;
END $$;

DO $$
BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StudentWalletTransaction_cashierUserId_fkey') THEN
ALTER TABLE "StudentWalletTransaction"
ADD CONSTRAINT "StudentWalletTransaction_cashierUserId_fkey"
FOREIGN KEY ("cashierUserId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
END IF;
END $$;

DO $$
BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StudentAttendanceEvent_schoolId_fkey') THEN
ALTER TABLE "StudentAttendanceEvent"
ADD CONSTRAINT "StudentAttendanceEvent_schoolId_fkey"
FOREIGN KEY ("schoolId") REFERENCES "School"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
END IF;
END $$;

DO $$
BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StudentAttendanceEvent_studentId_fkey') THEN
ALTER TABLE "StudentAttendanceEvent"
ADD CONSTRAINT "StudentAttendanceEvent_studentId_fkey"
FOREIGN KEY ("studentId") REFERENCES "Student"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
END IF;
END $$;

DO $$
BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StudentAttendanceEvent_credentialId_fkey') THEN
ALTER TABLE "StudentAttendanceEvent"
ADD CONSTRAINT "StudentAttendanceEvent_credentialId_fkey"
FOREIGN KEY ("credentialId") REFERENCES "StudentCredential"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
END IF;
END $$;

DO $$
BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'NfcGateScan_schoolId_fkey') THEN
ALTER TABLE "NfcGateScan"
ADD CONSTRAINT "NfcGateScan_schoolId_fkey"
FOREIGN KEY ("schoolId") REFERENCES "School"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
END IF;
END $$;

DO $$
BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'NfcGateScan_studentId_fkey') THEN
ALTER TABLE "NfcGateScan"
ADD CONSTRAINT "NfcGateScan_studentId_fkey"
FOREIGN KEY ("studentId") REFERENCES "Student"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
END IF;
END $$;

DO $$
BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'NfcGateScan_credentialId_fkey') THEN
ALTER TABLE "NfcGateScan"
ADD CONSTRAINT "NfcGateScan_credentialId_fkey"
FOREIGN KEY ("credentialId") REFERENCES "StudentCredential"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
END IF;
END $$;

DO $$
BEGIN
IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'NfcGateScan_scannedByUserId_fkey') THEN
ALTER TABLE "NfcGateScan"
ADD CONSTRAINT "NfcGateScan_scannedByUserId_fkey"
FOREIGN KEY ("scannedByUserId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
END IF;
END $$;
