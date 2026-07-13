-- Track password reset OTP attempts without rewriting or removing existing auth token data.
ALTER TABLE "AuthToken"
ADD COLUMN "attemptCount" INTEGER NOT NULL DEFAULT 0;
