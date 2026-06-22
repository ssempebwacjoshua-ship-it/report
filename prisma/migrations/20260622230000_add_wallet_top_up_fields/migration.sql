-- Add paymentMethod and reference fields to StudentWalletTransaction for wallet top-up feature
ALTER TABLE "student_wallet_transaction" ADD COLUMN IF NOT EXISTS "payment_method" TEXT;
ALTER TABLE "student_wallet_transaction" ADD COLUMN IF NOT EXISTS "reference" TEXT;
