-- Add paymentMethod and reference fields to StudentWalletTransaction for wallet top-up feature
ALTER TABLE "StudentWalletTransaction" ADD COLUMN IF NOT EXISTS "paymentMethod" TEXT;
ALTER TABLE "StudentWalletTransaction" ADD COLUMN IF NOT EXISTS "reference"     TEXT;
