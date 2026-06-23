-- NFC offline device registry
CREATE TABLE "NfcOfflineDevice" (
  "id"         UUID NOT NULL DEFAULT gen_random_uuid(),
  "schoolId"   UUID NOT NULL,
  "name"       TEXT NOT NULL,
  "deviceKey"  TEXT NOT NULL,
  "roleScope"  TEXT NOT NULL,
  "isActive"   BOOLEAN NOT NULL DEFAULT true,
  "lastSyncAt" TIMESTAMP(3),
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "NfcOfflineDevice_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "NfcOfflineDevice_schoolId_isActive_idx" ON "NfcOfflineDevice"("schoolId", "isActive");

ALTER TABLE "NfcOfflineDevice"
  ADD CONSTRAINT "NfcOfflineDevice_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- NFC offline sync batch audit trail
CREATE TABLE "NfcOfflineSyncBatch" (
  "id"          UUID NOT NULL DEFAULT gen_random_uuid(),
  "schoolId"    UUID NOT NULL,
  "deviceId"    UUID NOT NULL,
  "status"      TEXT NOT NULL DEFAULT 'COMPLETED',
  "totalItems"  INTEGER NOT NULL DEFAULT 0,
  "syncedItems" INTEGER NOT NULL DEFAULT 0,
  "failedItems" INTEGER NOT NULL DEFAULT 0,
  "errorJson"   JSONB,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "NfcOfflineSyncBatch_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "NfcOfflineSyncBatch_schoolId_deviceId_createdAt_idx"
  ON "NfcOfflineSyncBatch"("schoolId", "deviceId", "createdAt");

ALTER TABLE "NfcOfflineSyncBatch"
  ADD CONSTRAINT "NfcOfflineSyncBatch_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
