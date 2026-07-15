-- Additive device command storage for reader firmware polling.
CREATE TABLE "ReaderDeviceCommand" (
  "id" UUID NOT NULL,
  "schoolId" UUID NOT NULL,
  "deviceId" UUID NOT NULL,
  "type" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "firmwareVersion" TEXT,
  "firmwareUrl" TEXT,
  "firmwareSha256" TEXT,
  "requestedByUserId" TEXT,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ackedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "lastStatusAt" TIMESTAMP(3),
  "lastStatusMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ReaderDeviceCommand_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ReaderDeviceCommand"
ADD CONSTRAINT "ReaderDeviceCommand_schoolId_fkey"
FOREIGN KEY ("schoolId") REFERENCES "School"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ReaderDeviceCommand"
ADD CONSTRAINT "ReaderDeviceCommand_deviceId_fkey"
FOREIGN KEY ("deviceId") REFERENCES "NfcOfflineDevice"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "ReaderDeviceCommand_school_device_type_status_requestedAt_idx"
ON "ReaderDeviceCommand"("schoolId", "deviceId", "type", "status", "requestedAt");

CREATE INDEX "ReaderDeviceCommand_device_status_requestedAt_idx"
ON "ReaderDeviceCommand"("deviceId", "status", "requestedAt");
