-- CreateEnum
CREATE TYPE "StudentType" AS ENUM ('DAY', 'BOARDING');

-- AlterTable
ALTER TABLE "Student" ADD COLUMN "studentType" "StudentType";
