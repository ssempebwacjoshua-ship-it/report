-- Add single-use authentication email tokens for account setup and password reset.
-- Additive migration only: no existing data is rewritten or deleted.

CREATE TYPE "AuthTokenType" AS ENUM ('ACCOUNT_SETUP', 'PASSWORD_RESET', 'EMAIL_VERIFICATION');

CREATE TABLE "AuthToken" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "schoolId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "type" "AuthTokenType" NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "requestedIp" TEXT,
  "requestedUserAgent" TEXT,
  "resendMessageId" TEXT,
  "deliveryStatus" TEXT NOT NULL DEFAULT 'PENDING',
  "deliveryErrorCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AuthToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AuthToken_tokenHash_key" ON "AuthToken"("tokenHash");
CREATE INDEX "AuthToken_schoolId_userId_type_expiresAt_idx" ON "AuthToken"("schoolId", "userId", "type", "expiresAt");
CREATE INDEX "AuthToken_type_expiresAt_idx" ON "AuthToken"("type", "expiresAt");
CREATE INDEX "AuthToken_schoolId_deliveryStatus_createdAt_idx" ON "AuthToken"("schoolId", "deliveryStatus", "createdAt");

ALTER TABLE "AuthToken"
  ADD CONSTRAINT "AuthToken_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AuthToken"
  ADD CONSTRAINT "AuthToken_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
