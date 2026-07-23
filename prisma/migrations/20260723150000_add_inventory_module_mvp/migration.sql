-- CreateEnum
CREATE TYPE "InventoryMovementType" AS ENUM ('RECEIVED', 'ISSUED', 'ADJUSTED', 'STUDENT_BROUGHT');

-- CreateEnum
CREATE TYPE "StudentReportingStatus" AS ENUM ('REPORTED', 'PENDING');

-- CreateEnum
CREATE TYPE "StudentReportingItemStatus" AS ENUM ('COMPLETE', 'PARTIAL', 'MISSING', 'EXTRA');

-- CreateTable
CREATE TABLE "InventoryItem" (
    "id" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "minimumStock" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryStockMovement" (
    "id" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "type" "InventoryMovementType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "studentId" UUID,
    "notes" TEXT,
    "recordedByUserId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryStockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportingRequirement" (
    "id" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "termId" UUID,
    "classId" UUID,
    "requiredQuantity" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportingRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentReportingRecord" (
    "id" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "termId" UUID,
    "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordedByUserId" UUID NOT NULL,
    "status" "StudentReportingStatus" NOT NULL DEFAULT 'REPORTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentReportingRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentReportingItem" (
    "id" UUID NOT NULL,
    "reportingRecordId" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "expectedQuantity" INTEGER NOT NULL,
    "broughtQuantity" INTEGER NOT NULL,
    "status" "StudentReportingItemStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentReportingItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InventoryItem_schoolId_name_key" ON "InventoryItem"("schoolId", "name");
CREATE INDEX "InventoryItem_schoolId_active_category_idx" ON "InventoryItem"("schoolId", "active", "category");

-- CreateIndex
CREATE INDEX "InventoryStockMovement_schoolId_createdAt_idx" ON "InventoryStockMovement"("schoolId", "createdAt");
CREATE INDEX "InventoryStockMovement_schoolId_itemId_createdAt_idx" ON "InventoryStockMovement"("schoolId", "itemId", "createdAt");
CREATE INDEX "InventoryStockMovement_schoolId_studentId_createdAt_idx" ON "InventoryStockMovement"("schoolId", "studentId", "createdAt");

-- CreateIndex
CREATE INDEX "ReportingRequirement_schoolId_active_termId_classId_idx" ON "ReportingRequirement"("schoolId", "active", "termId", "classId");
CREATE INDEX "ReportingRequirement_schoolId_itemId_active_idx" ON "ReportingRequirement"("schoolId", "itemId", "active");

-- CreateIndex
CREATE INDEX "StudentReportingRecord_schoolId_studentId_reportedAt_idx" ON "StudentReportingRecord"("schoolId", "studentId", "reportedAt");
CREATE INDEX "StudentReportingRecord_schoolId_termId_reportedAt_idx" ON "StudentReportingRecord"("schoolId", "termId", "reportedAt");

-- CreateIndex
CREATE UNIQUE INDEX "StudentReportingItem_reportingRecordId_itemId_key" ON "StudentReportingItem"("reportingRecordId", "itemId");
CREATE INDEX "StudentReportingItem_itemId_status_idx" ON "StudentReportingItem"("itemId", "status");

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryStockMovement" ADD CONSTRAINT "InventoryStockMovement_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryStockMovement" ADD CONSTRAINT "InventoryStockMovement_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryStockMovement" ADD CONSTRAINT "InventoryStockMovement_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InventoryStockMovement" ADD CONSTRAINT "InventoryStockMovement_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReportingRequirement" ADD CONSTRAINT "ReportingRequirement_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReportingRequirement" ADD CONSTRAINT "ReportingRequirement_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReportingRequirement" ADD CONSTRAINT "ReportingRequirement_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ReportingRequirement" ADD CONSTRAINT "ReportingRequirement_classId_fkey" FOREIGN KEY ("classId") REFERENCES "SchoolClass"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StudentReportingRecord" ADD CONSTRAINT "StudentReportingRecord_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudentReportingRecord" ADD CONSTRAINT "StudentReportingRecord_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudentReportingRecord" ADD CONSTRAINT "StudentReportingRecord_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StudentReportingRecord" ADD CONSTRAINT "StudentReportingRecord_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudentReportingItem" ADD CONSTRAINT "StudentReportingItem_reportingRecordId_fkey" FOREIGN KEY ("reportingRecordId") REFERENCES "StudentReportingRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudentReportingItem" ADD CONSTRAINT "StudentReportingItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
