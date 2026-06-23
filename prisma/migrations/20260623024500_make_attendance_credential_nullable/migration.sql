-- Repair live DB drift: attendance scans from NfcTag can have no StudentCredential.
ALTER TABLE "StudentAttendanceEvent"
ALTER COLUMN "credentialId" DROP NOT NULL;