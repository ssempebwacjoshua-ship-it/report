-- Persist NFC reader credential capture sessions so taps survive restarts and multi-instance deploys.
CREATE TABLE "ReaderCredentialCaptureSession" (
  "id" UUID NOT NULL,
  "schoolId" UUID NOT NULL,
  "tagId" UUID NOT NULL,
  "studentId" UUID NOT NULL,
  "deviceId" UUID,
  "deviceLabel" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "activeSchoolId" UUID,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "capturedAt" TIMESTAMP(3),
  "confirmedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "expiredAt" TIMESTAMP(3),
  "capturedReaderId" TEXT,
  "capturedReaderName" TEXT,
  "capturedCredentialJson" JSONB,

  CONSTRAINT "ReaderCredentialCaptureSession_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ReaderCredentialCaptureSession"
ADD CONSTRAINT "ReaderCredentialCaptureSession_schoolId_fkey"
FOREIGN KEY ("schoolId") REFERENCES "School"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ReaderCredentialCaptureSession"
ADD CONSTRAINT "ReaderCredentialCaptureSession_activeSchoolId_key"
UNIQUE ("activeSchoolId");

CREATE INDEX "ReaderCredentialCaptureSession_school_status_expiresAt_idx"
ON "ReaderCredentialCaptureSession"("schoolId", "status", "expiresAt");

CREATE INDEX "ReaderCredentialCaptureSession_school_tag_idx"
ON "ReaderCredentialCaptureSession"("schoolId", "tagId");

CREATE INDEX "ReaderCredentialCaptureSession_school_student_idx"
ON "ReaderCredentialCaptureSession"("schoolId", "studentId");

CREATE INDEX "ReaderCredentialCaptureSession_school_device_status_idx"
ON "ReaderCredentialCaptureSession"("schoolId", "deviceId", "status");
