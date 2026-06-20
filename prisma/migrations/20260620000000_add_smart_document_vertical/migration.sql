-- CreateEnum
CREATE TYPE "SmartDocumentVertical" AS ENUM ('SCHOOL', 'LAWYER', 'GENERAL');

-- AlterTable: add vertical column with default SCHOOL (safe on existing rows)
ALTER TABLE "SmartDocument" ADD COLUMN "vertical" "SmartDocumentVertical" NOT NULL DEFAULT 'SCHOOL';

-- CreateIndex: compound indexes for vertical-scoped queries
CREATE INDEX "SmartDocument_creatorId_vertical_status_createdAt_idx" ON "SmartDocument"("creatorId", "vertical", "status", "createdAt");
CREATE INDEX "SmartDocument_creatorId_vertical_extractionStatus_updatedAt_idx" ON "SmartDocument"("creatorId", "vertical", "extractionStatus", "updatedAt");
CREATE INDEX "SmartDocument_schoolId_vertical_status_createdAt_idx" ON "SmartDocument"("schoolId", "vertical", "status", "createdAt");
CREATE INDEX "SmartDocument_schoolId_vertical_extractionStatus_updatedAt_idx" ON "SmartDocument"("schoolId", "vertical", "extractionStatus", "updatedAt");
