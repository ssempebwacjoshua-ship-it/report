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

-- Add balance_after_cents: snapshot of wallet balance immediately after this transaction
ALTER TABLE "student_wallet_transaction" ADD COLUMN IF NOT EXISTS "balance_after_cents" INTEGER;

-- Add reversal_of_id: points to the original transaction being reversed (no FK to keep migration simple)
ALTER TABLE "student_wallet_transaction" ADD COLUMN IF NOT EXISTS "reversal_of_id" UUID;

-- Index for "has this transaction been reversed?" lookup
CREATE INDEX IF NOT EXISTS "student_wallet_transaction_school_id_reversal_of_id_idx"
  ON "student_wallet_transaction"("school_id", "reversal_of_id");
