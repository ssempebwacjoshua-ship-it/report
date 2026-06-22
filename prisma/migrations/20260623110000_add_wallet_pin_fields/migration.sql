-- Add wallet PIN protection fields to StudentWallet.
-- PIN is stored as a salted pbkdf2 hash — the plain PIN is never persisted.

ALTER TABLE "StudentWallet"
  ADD COLUMN IF NOT EXISTS "pinHash"           TEXT,
  ADD COLUMN IF NOT EXISTS "pinSetAt"          TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "pinFailedAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "pinLockedUntil"    TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "pinLastVerifiedAt" TIMESTAMP(3);
