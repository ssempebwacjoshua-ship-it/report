-- AlterTable: add optional contact and active flag to School
ALTER TABLE "School" ADD COLUMN "phone" TEXT;
ALTER TABLE "School" ADD COLUMN "address" TEXT;
ALTER TABLE "School" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex for active schools lookup
CREATE INDEX "School_isActive_idx" ON "School"("isActive");

-- AlterEnum: add TRIAL status (safe; only adds a value, never removes)
ALTER TYPE "SubscriptionStatus" ADD VALUE IF NOT EXISTS 'TRIAL';
