-- Add REVERSAL enum value, reversalOfId reference, and balanceAfterCents to StudentWalletTransaction

-- Add REVERSAL to the enum (idempotent: only adds if not already present)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'REVERSAL'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'WalletTransactionType')
  ) THEN
    ALTER TYPE "WalletTransactionType" ADD VALUE 'REVERSAL';
  END IF;
END $$;

-- Add balanceAfterCents: snapshot of wallet balance immediately after this transaction
ALTER TABLE "StudentWalletTransaction" ADD COLUMN IF NOT EXISTS "balanceAfterCents" INTEGER;

-- Add reversalOfId: points to the original transaction being reversed (no FK to keep migration simple)
ALTER TABLE "StudentWalletTransaction" ADD COLUMN IF NOT EXISTS "reversalOfId" UUID;

-- Index for "has this transaction been reversed?" lookup
CREATE INDEX IF NOT EXISTS "StudentWalletTransaction_schoolId_reversalOfId_idx"
  ON "StudentWalletTransaction"("schoolId", "reversalOfId");
