-- Add tokenVersion to User for token invalidation on role/password changes
ALTER TABLE "User" ADD COLUMN "tokenVersion" INTEGER NOT NULL DEFAULT 0;
