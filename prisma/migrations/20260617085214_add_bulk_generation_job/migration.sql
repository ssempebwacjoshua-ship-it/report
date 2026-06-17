-- CreateEnum
CREATE TYPE "CreatorType" AS ENUM ('SCHOOL_OPERATOR', 'EXTERNAL');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CollectionType" AS ENUM ('STUDENTS', 'PATIENTS', 'CLIENTS', 'EMPLOYEES', 'CUSTOM');

-- CreateEnum
CREATE TYPE "BulkJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'PARTIAL');

-- DropIndex
DROP INDEX "School_isActive_idx";

-- DropIndex
DROP INDEX "SubjectMark_schoolId_academicYearId_termId_classId_streamId_idx";

-- AlterTable
ALTER TABLE "AppSetting" ALTER COLUMN "id" DROP DEFAULT;

-- CreateTable
CREATE TABLE "SchoolSmartPagePlan" (
    "id" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "planName" TEXT NOT NULL DEFAULT 'STANDARD',
    "includedPages" INTEGER NOT NULL DEFAULT 5000,
    "billingCycle" TEXT NOT NULL DEFAULT 'ACADEMIC_YEAR',
    "cycleStart" TIMESTAMP(3) NOT NULL,
    "cycleEnd" TIMESTAMP(3) NOT NULL,
    "usedPages" INTEGER NOT NULL DEFAULT 0,
    "topUpPages" INTEGER NOT NULL DEFAULT 0,
    "rolloverPages" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "allowHighAccuracy" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchoolSmartPagePlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmartPageLedger" (
    "id" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "jobId" TEXT NOT NULL,
    "fileHash" TEXT NOT NULL,
    "pagesCharged" INTEGER NOT NULL DEFAULT 0,
    "action" TEXT NOT NULL DEFAULT 'EXTRACT',
    "reason" TEXT NOT NULL DEFAULT '',
    "provider" TEXT NOT NULL DEFAULT '',
    "model" TEXT NOT NULL DEFAULT '',
    "extractionMode" TEXT NOT NULL DEFAULT 'balanced',
    "status" TEXT NOT NULL DEFAULT 'CHARGED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SmartPageLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentCleanerJob" (
    "id" UUID NOT NULL,
    "schoolId" UUID,
    "uploadedBy" TEXT,
    "documentType" TEXT NOT NULL DEFAULT 'table',
    "pageCount" INTEGER NOT NULL DEFAULT 1,
    "provider" TEXT NOT NULL DEFAULT '',
    "model" TEXT NOT NULL DEFAULT '',
    "extractionMode" TEXT NOT NULL DEFAULT 'balanced',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "pagesCharged" INTEGER NOT NULL DEFAULT 0,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fileHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentCleanerJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Creator" (
    "id" UUID NOT NULL,
    "type" "CreatorType" NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "schoolId" UUID,
    "passwordHash" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Creator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmartDocument" (
    "id" UUID NOT NULL,
    "creatorId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "extractedKnowledge" JSONB,
    "activeVersionId" UUID,
    "status" "DocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SmartDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentVersion" (
    "id" UUID NOT NULL,
    "documentId" UUID NOT NULL,
    "parentId" UUID,
    "instruction" TEXT,
    "schema" JSONB NOT NULL,
    "componentTree" JSONB NOT NULL,
    "renderSettings" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentSourceFile" (
    "id" UUID NOT NULL,
    "documentId" UUID NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER,
    "geminiFileUri" TEXT,
    "extractedContent" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentSourceFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublishedDocument" (
    "id" UUID NOT NULL,
    "documentId" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "passwordHash" TEXT,
    "expiresAt" TIMESTAMP(3),
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "downloadCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublishedDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Collection" (
    "id" UUID NOT NULL,
    "creatorId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "type" "CollectionType" NOT NULL DEFAULT 'CUSTOM',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Collection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollectionRecord" (
    "id" UUID NOT NULL,
    "collectionId" UUID NOT NULL,
    "data" JSONB NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CollectionRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BulkGenerationJob" (
    "id" UUID NOT NULL,
    "creatorId" UUID NOT NULL,
    "collectionId" UUID NOT NULL,
    "intent" TEXT NOT NULL,
    "templateSchema" JSONB,
    "status" "BulkJobStatus" NOT NULL DEFAULT 'PENDING',
    "totalRecords" INTEGER NOT NULL DEFAULT 0,
    "processedRecords" INTEGER NOT NULL DEFAULT 0,
    "failedRecords" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BulkGenerationJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BulkJobOutput" (
    "id" UUID NOT NULL,
    "jobId" UUID NOT NULL,
    "recordId" UUID NOT NULL,
    "documentId" UUID,
    "publishToken" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BulkJobOutput_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SchoolSmartPagePlan_schoolId_key" ON "SchoolSmartPagePlan"("schoolId");

-- CreateIndex
CREATE INDEX "SchoolSmartPagePlan_schoolId_status_idx" ON "SchoolSmartPagePlan"("schoolId", "status");

-- CreateIndex
CREATE INDEX "SmartPageLedger_schoolId_fileHash_status_idx" ON "SmartPageLedger"("schoolId", "fileHash", "status");

-- CreateIndex
CREATE INDEX "SmartPageLedger_schoolId_createdAt_idx" ON "SmartPageLedger"("schoolId", "createdAt");

-- CreateIndex
CREATE INDEX "DocumentCleanerJob_schoolId_fileHash_idx" ON "DocumentCleanerJob"("schoolId", "fileHash");

-- CreateIndex
CREATE INDEX "DocumentCleanerJob_schoolId_status_createdAt_idx" ON "DocumentCleanerJob"("schoolId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Creator_email_key" ON "Creator"("email");

-- CreateIndex
CREATE INDEX "Creator_email_idx" ON "Creator"("email");

-- CreateIndex
CREATE INDEX "Creator_schoolId_idx" ON "Creator"("schoolId");

-- CreateIndex
CREATE INDEX "Creator_type_idx" ON "Creator"("type");

-- CreateIndex
CREATE INDEX "SmartDocument_creatorId_status_createdAt_idx" ON "SmartDocument"("creatorId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "DocumentVersion_documentId_createdAt_idx" ON "DocumentVersion"("documentId", "createdAt");

-- CreateIndex
CREATE INDEX "DocumentSourceFile_documentId_idx" ON "DocumentSourceFile"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "PublishedDocument_documentId_key" ON "PublishedDocument"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "PublishedDocument_token_key" ON "PublishedDocument"("token");

-- CreateIndex
CREATE INDEX "PublishedDocument_token_idx" ON "PublishedDocument"("token");

-- CreateIndex
CREATE INDEX "Collection_creatorId_idx" ON "Collection"("creatorId");

-- CreateIndex
CREATE INDEX "CollectionRecord_collectionId_sortOrder_idx" ON "CollectionRecord"("collectionId", "sortOrder");

-- CreateIndex
CREATE INDEX "BulkGenerationJob_creatorId_status_idx" ON "BulkGenerationJob"("creatorId", "status");

-- CreateIndex
CREATE INDEX "BulkGenerationJob_status_createdAt_idx" ON "BulkGenerationJob"("status", "createdAt");

-- CreateIndex
CREATE INDEX "BulkJobOutput_jobId_status_idx" ON "BulkJobOutput"("jobId", "status");

-- CreateIndex
CREATE INDEX "BulkJobOutput_recordId_idx" ON "BulkJobOutput"("recordId");

-- AddForeignKey
ALTER TABLE "SmartDocument" ADD CONSTRAINT "SmartDocument_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "SmartDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentSourceFile" ADD CONSTRAINT "DocumentSourceFile_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "SmartDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublishedDocument" ADD CONSTRAINT "PublishedDocument_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "SmartDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Collection" ADD CONSTRAINT "Collection_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionRecord" ADD CONSTRAINT "CollectionRecord_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BulkGenerationJob" ADD CONSTRAINT "BulkGenerationJob_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BulkGenerationJob" ADD CONSTRAINT "BulkGenerationJob_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BulkJobOutput" ADD CONSTRAINT "BulkJobOutput_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "BulkGenerationJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BulkJobOutput" ADD CONSTRAINT "BulkJobOutput_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "CollectionRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "ClassEnrollment_schoolId_academicYearId_termId_classId_streamId" RENAME TO "ClassEnrollment_schoolId_academicYearId_termId_classId_stre_idx";

-- RenameIndex
ALTER INDEX "SubjectMark_schoolId_academicYearId_termId_classId_streamId_ass" RENAME TO "SubjectMark_schoolId_academicYearId_termId_classId_streamId_idx";

-- RenameIndex
ALTER INDEX "SubjectMark_schoolId_studentId_academicYearId_termId_assessment" RENAME TO "SubjectMark_schoolId_studentId_academicYearId_termId_assess_idx";

-- RenameIndex
ALTER INDEX "SubjectMark_schoolId_subjectId_academicYearId_termId_assessment" RENAME TO "SubjectMark_schoolId_subjectId_academicYearId_termId_assess_idx";
