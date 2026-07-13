-- Store a separate hashed setup code alongside the secure setup link token.
ALTER TABLE "AuthToken"
ADD COLUMN "setupCodeHash" TEXT;
