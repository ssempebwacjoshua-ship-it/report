-- Smart Pages launch pricing: credit ledger metadata and Mobile Money payment requests.

ALTER TABLE "SmartPageLedger"
  ADD COLUMN "creditsCharged" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "operation" TEXT NOT NULL DEFAULT 'EXTRACT',
  ADD COLUMN "pagesProcessed" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "priceUgx" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "tokenUsage" JSONB,
  ADD COLUMN "geminiCostEstimateUgx" INTEGER,
  ADD COLUMN "marginEstimateUgx" INTEGER;

UPDATE "SmartPageLedger"
SET
  "creditsCharged" = "pagesCharged",
  "operation" = "action",
  "pagesProcessed" = "pagesCharged",
  "priceUgx" = "pagesCharged" * 500
WHERE "creditsCharged" = 0;

CREATE TABLE "SmartPagePaymentRequest" (
  "id" UUID NOT NULL,
  "schoolId" UUID NOT NULL,
  "packageCode" TEXT NOT NULL,
  "packageName" TEXT NOT NULL,
  "credits" INTEGER NOT NULL,
  "amountUgx" INTEGER NOT NULL,
  "network" TEXT NOT NULL,
  "merchantCode" TEXT NOT NULL,
  "merchantName" TEXT NOT NULL DEFAULT '',
  "paymentReference" TEXT NOT NULL,
  "transactionId" TEXT,
  "payerPhone" TEXT,
  "proofScreenshotUrl" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "adminNotes" TEXT,
  "confirmedByUserId" UUID,
  "confirmedAt" TIMESTAMP(3),
  "rejectedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SmartPagePaymentRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SmartPagePaymentRequest_paymentReference_key" ON "SmartPagePaymentRequest"("paymentReference");
CREATE UNIQUE INDEX "SmartPagePaymentRequest_network_transactionId_key" ON "SmartPagePaymentRequest"("network", "transactionId");
CREATE INDEX "SmartPagePaymentRequest_schoolId_status_createdAt_idx" ON "SmartPagePaymentRequest"("schoolId", "status", "createdAt");
CREATE INDEX "SmartPagePaymentRequest_status_createdAt_idx" ON "SmartPagePaymentRequest"("status", "createdAt");

ALTER TABLE "SmartPagePaymentRequest"
  ADD CONSTRAINT "SmartPagePaymentRequest_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
