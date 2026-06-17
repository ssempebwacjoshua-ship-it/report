ALTER TABLE "DocumentSourceFile"
  ADD COLUMN "originalData" BYTEA,
  ADD COLUMN "processedData" BYTEA,
  ADD COLUMN "processedMimeType" TEXT,
  ADD COLUMN "ocrQuality" JSONB;
