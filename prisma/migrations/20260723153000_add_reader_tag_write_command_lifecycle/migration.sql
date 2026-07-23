ALTER TABLE "ReaderDeviceCommand"
ADD COLUMN "payloadJson" JSONB,
ADD COLUMN "targetTagId" UUID,
ADD COLUMN "targetStudentId" UUID,
ADD COLUMN "expectedPayload" TEXT,
ADD COLUMN "writtenPayload" TEXT,
ADD COLUMN "readbackPayload" TEXT,
ADD COLUMN "credentialJson" JSONB,
ADD COLUMN "credentialStatus" TEXT,
ADD COLUMN "credentialError" TEXT,
ADD COLUMN "sentAt" TIMESTAMP(3),
ADD COLUMN "writeStartedAt" TIMESTAMP(3),
ADD COLUMN "writeCompletedAt" TIMESTAMP(3),
ADD COLUMN "verifyStartedAt" TIMESTAMP(3),
ADD COLUMN "verifiedAt" TIMESTAMP(3),
ADD COLUMN "failedAt" TIMESTAMP(3),
ADD COLUMN "credentialLinkedAt" TIMESTAMP(3),
ADD COLUMN "errorMessage" TEXT;

CREATE INDEX "ReaderDeviceCommand_school_targetTag_status_idx"
ON "ReaderDeviceCommand"("schoolId", "targetTagId", "status", "requestedAt");
