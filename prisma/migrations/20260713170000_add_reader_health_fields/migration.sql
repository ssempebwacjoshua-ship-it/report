-- Add reader health and OTA state fields for the owner console.
ALTER TABLE "NfcOfflineDevice"
  ADD COLUMN IF NOT EXISTS "lastHeartbeatAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "uptimeMs" INTEGER,
  ADD COLUMN IF NOT EXISTS "freeHeap" INTEGER,
  ADD COLUMN IF NOT EXISTS "rebootReason" TEXT,
  ADD COLUMN IF NOT EXISTS "otaStatus" TEXT,
  ADD COLUMN IF NOT EXISTS "otaMessage" TEXT;
