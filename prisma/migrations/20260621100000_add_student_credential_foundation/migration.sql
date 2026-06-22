-- Generic school-scoped student credential foundation.
-- First supported type: NFC_WRISTBAND.

CREATE TYPE "CredentialType" AS ENUM ('NFC_WRISTBAND');
CREATE TYPE "CredentialStatus" AS ENUM ('ACTIVE', 'DEACTIVATED');

CREATE TABLE "StudentCredential" (
    "id" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "type" "CredentialType" NOT NULL,
    "credentialUID" TEXT NOT NULL,
    "status" "CredentialStatus" NOT NULL DEFAULT 'ACTIVE',
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deactivatedAt" TIMESTAMP(3),
    "deactivatedReason" TEXT,
    "issuedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentCredential_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StudentCredential_schoolId_type_credentialUID_key"
    ON "StudentCredential"("schoolId", "type", "credentialUID");

CREATE INDEX "StudentCredential_schoolId_idx" ON "StudentCredential"("schoolId");
CREATE INDEX "StudentCredential_studentId_idx" ON "StudentCredential"("studentId");
CREATE INDEX "StudentCredential_schoolId_status_idx" ON "StudentCredential"("schoolId", "status");
CREATE INDEX "StudentCredential_schoolId_type_status_idx" ON "StudentCredential"("schoolId", "type", "status");

ALTER TABLE "StudentCredential"
    ADD CONSTRAINT "StudentCredential_schoolId_fkey"
    FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StudentCredential"
    ADD CONSTRAINT "StudentCredential_studentId_fkey"
    FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StudentCredential"
    ADD CONSTRAINT "StudentCredential_issuedById_fkey"
    FOREIGN KEY ("issuedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
