-- Add neutral secure token for NFC wristband URLs.
-- NFC tags should store /nfc/t/:token, not action-specific URLs.

ALTER TABLE "StudentCredential"
    ADD COLUMN "scanToken" TEXT;

CREATE UNIQUE INDEX "StudentCredential_scanToken_key"
    ON "StudentCredential"("scanToken");
