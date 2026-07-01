-- Support optional subject papers/components while preserving existing simple marks.

CREATE TYPE "SubjectComponentFinalMode" AS ENUM ('AVERAGE', 'WEIGHTED', 'MANUAL');

ALTER TABLE "Subject"
  ADD COLUMN "componentFinalMode" "SubjectComponentFinalMode" NOT NULL DEFAULT 'AVERAGE';

CREATE TABLE "SubjectComponent" (
  "id" UUID NOT NULL,
  "schoolId" UUID NOT NULL,
  "subjectId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL,
  "weight" DECIMAL(5,2),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SubjectComponent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SubjectComponent_subjectId_name_key" ON "SubjectComponent"("subjectId", "name");
CREATE UNIQUE INDEX "SubjectComponent_subjectId_code_key" ON "SubjectComponent"("subjectId", "code");
CREATE INDEX "SubjectComponent_schoolId_subjectId_isActive_sortOrder_idx"
  ON "SubjectComponent"("schoolId", "subjectId", "isActive", "sortOrder");

ALTER TABLE "SubjectComponent"
  ADD CONSTRAINT "SubjectComponent_subjectId_fkey"
  FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SubjectMark"
  ADD COLUMN "componentId" UUID,
  ADD COLUMN "componentKey" TEXT NOT NULL DEFAULT '';

DROP INDEX IF EXISTS "SubjectMark_studentId_subjectId_termId_assessmentType_key";

CREATE UNIQUE INDEX "SubjectMark_studentId_subjectId_componentKey_termId_assessmentType_key"
  ON "SubjectMark"("studentId", "subjectId", "componentKey", "termId", "assessmentType");

CREATE INDEX "SubjectMark_schoolId_subjectId_componentId_academicYearId_termId_assessmentType_idx"
  ON "SubjectMark"("schoolId", "subjectId", "componentId", "academicYearId", "termId", "assessmentType");

ALTER TABLE "SubjectMark"
  ADD CONSTRAINT "SubjectMark_componentId_fkey"
  FOREIGN KEY ("componentId") REFERENCES "SubjectComponent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
