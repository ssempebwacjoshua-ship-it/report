DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CanteenReconciliationStatus') THEN
    CREATE TYPE "CanteenReconciliationStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED');
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS "CanteenReconciliation" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "schoolId" UUID NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "shiftName" TEXT,
  "cashierUserId" UUID,
  "canteenOperatorUserId" UUID,
  "openingWalletBalanceCents" INTEGER NOT NULL,
  "totalTopUpsCents" INTEGER NOT NULL,
  "totalCashTopUpsCents" INTEGER NOT NULL,
  "totalMobileMoneyTopUpsCents" INTEGER NOT NULL,
  "totalParentDepositTopUpsCents" INTEGER NOT NULL,
  "totalAdjustmentTopUpsCents" INTEGER NOT NULL,
  "totalCanteenChargesCents" INTEGER NOT NULL,
  "totalReversalsCents" INTEGER NOT NULL,
  "netCanteenPayableCents" INTEGER NOT NULL,
  "closingWalletBalanceCents" INTEGER NOT NULL,
  "declaredCashCents" INTEGER,
  "declaredMobileMoneyCents" INTEGER,
  "varianceCents" INTEGER NOT NULL,
  "status" "CanteenReconciliationStatus" NOT NULL DEFAULT 'DRAFT',
  "notes" TEXT,
  "submittedByUserId" UUID,
  "approvedByUserId" UUID,
  "submittedAt" TIMESTAMP(3),
  "approvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CanteenReconciliation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CanteenReconciliation_schoolId_date_idx" ON "CanteenReconciliation"("schoolId", "date");
CREATE INDEX IF NOT EXISTS "CanteenReconciliation_schoolId_status_idx" ON "CanteenReconciliation"("schoolId", "status");
CREATE INDEX IF NOT EXISTS "CanteenReconciliation_schoolId_cashierUserId_date_idx" ON "CanteenReconciliation"("schoolId", "cashierUserId", "date");

ALTER TABLE "CanteenReconciliation"
  ADD CONSTRAINT "CanteenReconciliation_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CanteenReconciliation"
  ADD CONSTRAINT "CanteenReconciliation_cashierUserId_fkey"
  FOREIGN KEY ("cashierUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CanteenReconciliation"
  ADD CONSTRAINT "CanteenReconciliation_canteenOperatorUserId_fkey"
  FOREIGN KEY ("canteenOperatorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CanteenReconciliation"
  ADD CONSTRAINT "CanteenReconciliation_submittedByUserId_fkey"
  FOREIGN KEY ("submittedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CanteenReconciliation"
  ADD CONSTRAINT "CanteenReconciliation_approvedByUserId_fkey"
  FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
