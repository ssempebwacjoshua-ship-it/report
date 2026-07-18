-- CreateEnum
CREATE TYPE "StudentPassOutStatus" AS ENUM ('APPROVED', 'CHECKED_OUT', 'RETURNED', 'CANCELLED', 'EXPIRED');

-- CreateTable
CREATE TABLE "StudentPassOut" (
    "id" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "status" "StudentPassOutStatus" NOT NULL DEFAULT 'APPROVED',
    "reason" TEXT NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "activeFrom" TIMESTAMP(3) NOT NULL,
    "activeUntil" TIMESTAMP(3) NOT NULL,
    "checkedOutAt" TIMESTAMP(3),
    "checkedInAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancellationReason" TEXT,
    "createdByUserId" UUID,
    "approvedByUserId" UUID,
    "cancelledByUserId" UUID,
    "checkoutMovementEventId" TEXT,
    "checkinMovementEventId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentPassOut_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudentPassOut_schoolId_studentId_status_activeFrom_activeU_idx" ON "StudentPassOut"("schoolId", "studentId", "status", "activeFrom", "activeUntil");

-- CreateIndex
CREATE INDEX "StudentPassOut_schoolId_status_activeFrom_activeUntil_idx" ON "StudentPassOut"("schoolId", "status", "activeFrom", "activeUntil");

-- CreateIndex
CREATE INDEX "StudentPassOut_schoolId_createdAt_idx" ON "StudentPassOut"("schoolId", "createdAt");

-- AddForeignKey
ALTER TABLE "StudentPassOut" ADD CONSTRAINT "StudentPassOut_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentPassOut" ADD CONSTRAINT "StudentPassOut_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentPassOut" ADD CONSTRAINT "StudentPassOut_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentPassOut" ADD CONSTRAINT "StudentPassOut_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentPassOut" ADD CONSTRAINT "StudentPassOut_cancelledByUserId_fkey" FOREIGN KEY ("cancelledByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
