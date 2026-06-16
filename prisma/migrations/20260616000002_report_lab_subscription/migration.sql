-- CreateEnum
CREATE TYPE "SubscriptionBillingCycle" AS ENUM ('YEAR');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'SUSPENDED', 'PENDING');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('UNPAID', 'PAID', 'CANCELLED');

-- CreateTable
CREATE TABLE "ReportLabSubscription" (
    "id" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "planCode" TEXT NOT NULL,
    "billingCycle" "SubscriptionBillingCycle" NOT NULL DEFAULT 'YEAR',
    "studentLimit" INTEGER,
    "currentPeriodStart" TIMESTAMP(3) NOT NULL,
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportLabSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportLabInvoice" (
    "id" UUID NOT NULL,
    "subscriptionId" UUID NOT NULL,
    "setupFeeUgx" INTEGER NOT NULL DEFAULT 0,
    "amountUgx" INTEGER NOT NULL,
    "totalUgx" INTEGER NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'UNPAID',
    "paidAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportLabInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReportLabSubscription_schoolId_key" ON "ReportLabSubscription"("schoolId");

-- CreateIndex
CREATE INDEX "ReportLabSubscription_schoolId_status_idx" ON "ReportLabSubscription"("schoolId", "status");

-- CreateIndex
CREATE INDEX "ReportLabInvoice_subscriptionId_createdAt_idx" ON "ReportLabInvoice"("subscriptionId", "createdAt");

-- AddForeignKey
ALTER TABLE "ReportLabSubscription" ADD CONSTRAINT "ReportLabSubscription_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportLabInvoice" ADD CONSTRAINT "ReportLabInvoice_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "ReportLabSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;
