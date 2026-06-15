-- Phase 5: Critical database indexes for report query performance

-- SubjectMark: replace old index (missing assessmentType) with full composite
DROP INDEX IF EXISTS "SubjectMark_schoolId_academicYearId_termId_classId_streamId_status_idx";
CREATE INDEX "SubjectMark_schoolId_academicYearId_termId_classId_streamId_assessmentType_status_idx"
  ON "SubjectMark"("schoolId", "academicYearId", "termId", "classId", "streamId", "assessmentType", "status");

-- SubjectMark: per-student mark lookup (report card per student)
CREATE INDEX "SubjectMark_schoolId_studentId_academicYearId_termId_assessmentType_idx"
  ON "SubjectMark"("schoolId", "studentId", "academicYearId", "termId", "assessmentType");

-- SubjectMark: per-subject aggregate queries
CREATE INDEX "SubjectMark_schoolId_subjectId_academicYearId_termId_assessmentType_idx"
  ON "SubjectMark"("schoolId", "subjectId", "academicYearId", "termId", "assessmentType");

-- AuditLog: action-type queries with time ordering
CREATE INDEX "AuditLog_schoolId_action_createdAt_idx"
  ON "AuditLog"("schoolId", "action", "createdAt");
