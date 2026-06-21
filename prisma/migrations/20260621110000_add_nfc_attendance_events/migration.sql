-- Add school-scoped attendance tap events for NFC wristband scans.

CREATE TYPE "AttendanceDirection" AS ENUM ('TAP_IN', 'TAP_OUT');
CREATE TYPE "AttendanceScanSource" AS ENUM ('NFC_WRISTBAND');

CREATE TABLE "StudentAttendanceEvent" (
    "id" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "credentialId" UUID NOT NULL,
    "classId" UUID,
    "streamId" UUID,
    "direction" "AttendanceDirection" NOT NULL,
    "scanSource" "AttendanceScanSource" NOT NULL DEFAULT 'NFC_WRISTBAND',
    "scannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentAttendanceEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StudentAttendanceEvent_schoolId_scannedAt_idx"
    ON "StudentAttendanceEvent"("schoolId", "scannedAt");

CREATE INDEX "StudentAttendanceEvent_schoolId_studentId_scannedAt_idx"
    ON "StudentAttendanceEvent"("schoolId", "studentId", "scannedAt");

CREATE INDEX "StudentAttendanceEvent_schoolId_credentialId_scannedAt_idx"
    ON "StudentAttendanceEvent"("schoolId", "credentialId", "scannedAt");

CREATE INDEX "StudentAttendanceEvent_schoolId_direction_scannedAt_idx"
    ON "StudentAttendanceEvent"("schoolId", "direction", "scannedAt");

ALTER TABLE "StudentAttendanceEvent"
    ADD CONSTRAINT "StudentAttendanceEvent_schoolId_fkey"
    FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StudentAttendanceEvent"
    ADD CONSTRAINT "StudentAttendanceEvent_studentId_fkey"
    FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StudentAttendanceEvent"
    ADD CONSTRAINT "StudentAttendanceEvent_credentialId_fkey"
    FOREIGN KEY ("credentialId") REFERENCES "StudentCredential"("id") ON DELETE CASCADE ON UPDATE CASCADE;
