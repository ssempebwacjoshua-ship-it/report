-- Additive pending-reader activation fields for one-time setup.
ALTER TABLE "NfcOfflineDevice"
ADD COLUMN "provisioningStatus" TEXT NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN "activationCodeHash" TEXT,
ADD COLUMN "activationCodeExpiresAt" TIMESTAMP(3),
ADD COLUMN "activationCodeUsedAt" TIMESTAMP(3),
ADD COLUMN "activationBoundHardwareId" TEXT,
ADD COLUMN "activationFailedAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "activationLastFailedAt" TIMESTAMP(3),
ADD COLUMN "activationLastError" TEXT;

CREATE INDEX "NfcOfflineDevice_provisioningStatus_activationCodeExpiresAt_idx"
ON "NfcOfflineDevice"("provisioningStatus", "activationCodeExpiresAt");

CREATE INDEX "NfcOfflineDevice_activationCodeHash_idx"
ON "NfcOfflineDevice"("activationCodeHash");
