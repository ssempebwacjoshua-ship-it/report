-- Add Telegram notification tracking and admin rejection-by tracking to SmartPagePaymentRequest.

ALTER TABLE "SmartPagePaymentRequest"
  ADD COLUMN "rejectedByUserId" UUID,
  ADD COLUMN "telegramSentAt" TIMESTAMP(3),
  ADD COLUMN "telegramError" TEXT;
