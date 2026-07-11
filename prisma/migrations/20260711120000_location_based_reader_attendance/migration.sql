-- Additive location-based attendance foundation for reader gateway devices.

ALTER TABLE "SchoolNfcPolicy"
ADD COLUMN IF NOT EXISTS "duplicateWindowSeconds" INTEGER NOT NULL DEFAULT 60,
ADD COLUMN IF NOT EXISTS "gateArrivalStart" TEXT NOT NULL DEFAULT '05:30',
ADD COLUMN IF NOT EXISTS "gateArrivalLateAfter" TEXT NOT NULL DEFAULT '08:00',
ADD COLUMN IF NOT EXISTS "gateArrivalEnd" TEXT NOT NULL DEFAULT '10:00',
ADD COLUMN IF NOT EXISTS "morningClassroomStart" TEXT NOT NULL DEFAULT '06:30',
ADD COLUMN IF NOT EXISTS "morningClassroomEnd" TEXT NOT NULL DEFAULT '10:00',
ADD COLUMN IF NOT EXISTS "gateDepartureStart" TEXT NOT NULL DEFAULT '14:00',
ADD COLUMN IF NOT EXISTS "gateDepartureEnd" TEXT NOT NULL DEFAULT '19:00',
ADD COLUMN IF NOT EXISTS "nightPrepStart" TEXT NOT NULL DEFAULT '18:30',
ADD COLUMN IF NOT EXISTS "nightPrepEnd" TEXT NOT NULL DEFAULT '22:30',
ADD COLUMN IF NOT EXISTS "nightPrepBoardingOnly" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS "allowAutomaticCheckout" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "recordUnclassifiedScans" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS "feeGatePolicyEnabled" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "NfcOfflineDevice"
ADD COLUMN IF NOT EXISTS "locationType" TEXT,
ADD COLUMN IF NOT EXISTS "locationName" TEXT,
ADD COLUMN IF NOT EXISTS "attendanceMode" TEXT,
ADD COLUMN IF NOT EXISTS "studentScope" TEXT,
ADD COLUMN IF NOT EXISTS "classId" UUID,
ADD COLUMN IF NOT EXISTS "streamId" UUID;

CREATE TABLE IF NOT EXISTS "StudentGateHold" (
  "id" UUID NOT NULL,
  "schoolId" UUID NOT NULL,
  "studentId" UUID NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'REQUESTED',
  "reason" TEXT,
  "requestedByUserId" UUID,
  "approvedByUserId" UUID,
  "activeFrom" TIMESTAMP(3),
  "activeUntil" TIMESTAMP(3),
  "overrideUntil" TIMESTAMP(3),
  "overrideReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StudentGateHold_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "StudentGateHold_schoolId_studentId_status_idx"
ON "StudentGateHold"("schoolId", "studentId", "status");

CREATE INDEX IF NOT EXISTS "StudentGateHold_schoolId_status_activeFrom_activeUntil_idx"
ON "StudentGateHold"("schoolId", "status", "activeFrom", "activeUntil");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'StudentGateHold_schoolId_fkey'
      AND table_name = 'StudentGateHold'
  ) THEN
    ALTER TABLE "StudentGateHold"
    ADD CONSTRAINT "StudentGateHold_schoolId_fkey"
    FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'StudentGateHold_studentId_fkey'
      AND table_name = 'StudentGateHold'
  ) THEN
    ALTER TABLE "StudentGateHold"
    ADD CONSTRAINT "StudentGateHold_studentId_fkey"
    FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "DailyAttendance" (
  "id" UUID NOT NULL,
  "schoolId" UUID NOT NULL,
  "studentId" UUID NOT NULL,
  "attendanceDate" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL,
  "firstRecordedAt" TIMESTAMP(3) NOT NULL,
  "source" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DailyAttendance_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DailyAttendance_schoolId_studentId_attendanceDate_key"
ON "DailyAttendance"("schoolId", "studentId", "attendanceDate");

CREATE INDEX IF NOT EXISTS "DailyAttendance_schoolId_attendanceDate_status_idx"
ON "DailyAttendance"("schoolId", "attendanceDate", "status");

CREATE INDEX IF NOT EXISTS "DailyAttendance_schoolId_studentId_attendanceDate_idx"
ON "DailyAttendance"("schoolId", "studentId", "attendanceDate");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'DailyAttendance_schoolId_fkey'
      AND table_name = 'DailyAttendance'
  ) THEN
    ALTER TABLE "DailyAttendance"
    ADD CONSTRAINT "DailyAttendance_schoolId_fkey"
    FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'DailyAttendance_studentId_fkey'
      AND table_name = 'DailyAttendance'
  ) THEN
    ALTER TABLE "DailyAttendance"
    ADD CONSTRAINT "DailyAttendance_studentId_fkey"
    FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "CampusMovementEvent" (
  "id" UUID NOT NULL,
  "eventId" TEXT NOT NULL,
  "schoolId" UUID NOT NULL,
  "studentId" UUID NOT NULL,
  "readerId" UUID NOT NULL,
  "type" TEXT NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "deviceTime" TIMESTAMP(3) NOT NULL,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "offlineSynced" BOOLEAN NOT NULL DEFAULT false,
  "metadata" JSONB,
  CONSTRAINT "CampusMovementEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CampusMovementEvent_schoolId_eventId_key"
ON "CampusMovementEvent"("schoolId", "eventId");

CREATE INDEX IF NOT EXISTS "CampusMovementEvent_schoolId_studentId_occurredAt_idx"
ON "CampusMovementEvent"("schoolId", "studentId", "occurredAt");

CREATE INDEX IF NOT EXISTS "CampusMovementEvent_schoolId_readerId_occurredAt_idx"
ON "CampusMovementEvent"("schoolId", "readerId", "occurredAt");

CREATE INDEX IF NOT EXISTS "CampusMovementEvent_schoolId_type_occurredAt_idx"
ON "CampusMovementEvent"("schoolId", "type", "occurredAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'CampusMovementEvent_schoolId_fkey'
      AND table_name = 'CampusMovementEvent'
  ) THEN
    ALTER TABLE "CampusMovementEvent"
    ADD CONSTRAINT "CampusMovementEvent_schoolId_fkey"
    FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'CampusMovementEvent_studentId_fkey'
      AND table_name = 'CampusMovementEvent'
  ) THEN
    ALTER TABLE "CampusMovementEvent"
    ADD CONSTRAINT "CampusMovementEvent_studentId_fkey"
    FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "ClassroomAttendanceEvent" (
  "id" UUID NOT NULL,
  "eventId" TEXT NOT NULL,
  "schoolId" UUID NOT NULL,
  "studentId" UUID NOT NULL,
  "readerId" UUID NOT NULL,
  "classId" UUID,
  "streamId" UUID,
  "sessionDate" TIMESTAMP(3) NOT NULL,
  "sessionType" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "deviceTime" TIMESTAMP(3) NOT NULL,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "metadata" JSONB,
  CONSTRAINT "ClassroomAttendanceEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ClassroomAttendanceEvent_schoolId_eventId_key"
ON "ClassroomAttendanceEvent"("schoolId", "eventId");

CREATE INDEX IF NOT EXISTS "ClassroomAttendanceEvent_schoolId_studentId_sessionDate_sessionType_idx"
ON "ClassroomAttendanceEvent"("schoolId", "studentId", "sessionDate", "sessionType");

CREATE INDEX IF NOT EXISTS "ClassroomAttendanceEvent_schoolId_classId_streamId_sessionDate_sessionType_idx"
ON "ClassroomAttendanceEvent"("schoolId", "classId", "streamId", "sessionDate", "sessionType");

CREATE INDEX IF NOT EXISTS "ClassroomAttendanceEvent_schoolId_readerId_occurredAt_idx"
ON "ClassroomAttendanceEvent"("schoolId", "readerId", "occurredAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'ClassroomAttendanceEvent_schoolId_fkey'
      AND table_name = 'ClassroomAttendanceEvent'
  ) THEN
    ALTER TABLE "ClassroomAttendanceEvent"
    ADD CONSTRAINT "ClassroomAttendanceEvent_schoolId_fkey"
    FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'ClassroomAttendanceEvent_studentId_fkey'
      AND table_name = 'ClassroomAttendanceEvent'
  ) THEN
    ALTER TABLE "ClassroomAttendanceEvent"
    ADD CONSTRAINT "ClassroomAttendanceEvent_studentId_fkey"
    FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
