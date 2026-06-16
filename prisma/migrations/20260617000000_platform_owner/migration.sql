-- AlterTable: add platform owner fields to User
ALTER TABLE "User" ADD COLUMN "isPlatformOwner" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "lastLoginAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "User_isPlatformOwner_idx" ON "User"("isPlatformOwner");
