ALTER TABLE "SmartDocument"
  ADD COLUMN "extractionStatus" TEXT NOT NULL DEFAULT 'IDLE',
  ADD COLUMN "extractionError" TEXT,
  ADD COLUMN "extractionStartedAt" TIMESTAMP(3),
  ADD COLUMN "extractionCompletedAt" TIMESTAMP(3);

ALTER TABLE "DocumentSourceFile"
  ADD COLUMN "status" TEXT NOT NULL DEFAULT 'UPLOADED',
  ADD COLUMN "extractionError" TEXT,
  ADD COLUMN "extractionStartedAt" TIMESTAMP(3),
  ADD COLUMN "extractionCompletedAt" TIMESTAMP(3),
  ADD COLUMN "fileHash" TEXT;

CREATE INDEX "SmartDocument_creatorId_extractionStatus_updatedAt_idx" ON "SmartDocument"("creatorId", "extractionStatus", "updatedAt");
CREATE INDEX "DocumentSourceFile_status_createdAt_idx" ON "DocumentSourceFile"("status", "createdAt");
CREATE INDEX "DocumentSourceFile_fileHash_idx" ON "DocumentSourceFile"("fileHash");
