-- Phase 6: audit hardening and production query indexes

-- Stream lookups scoped by tenant + class + code
CREATE INDEX "Stream_schoolId_classId_code_idx"
  ON "Stream"("schoolId", "classId", "code");

-- Student lookups by tenant + admission number + active status
CREATE INDEX "Student_schoolId_admissionNumber_isActive_idx"
  ON "Student"("schoolId", "admissionNumber", "isActive");

-- SubjectMark lookups for tenant-scoped student/subject report queries
CREATE INDEX "SubjectMark_school_student_subject_term_type_idx"
  ON "SubjectMark"("schoolId", "studentId", "subjectId", "termId", "assessmentType");

-- AuditLog lookups by tenant and time window
CREATE INDEX "AuditLog_schoolId_createdAt_idx"
  ON "AuditLog"("schoolId", "createdAt");

-- StudentCredential lookups by tenant and credential UID
CREATE INDEX "StudentCredential_schoolId_credentialUID_idx"
  ON "StudentCredential"("schoolId", "credentialUID");

-- IssuedReport lookups for tenant-scoped release/report history queries
CREATE INDEX "IssuedReport_school_student_year_term_type_status_idx"
  ON "IssuedReport"("schoolId", "studentId", "academicYear", "term", "assessmentType", "status");

-- DocumentSourceFile lookups for document-scoped extraction history
CREATE INDEX "DocumentSourceFile_document_status_createdAt_idx"
  ON "DocumentSourceFile"("documentId", "status", "createdAt");

-- NFC tag/device query support
CREATE INDEX "NfcTag_schoolId_physicalUid_idx"
  ON "NfcTag"("schoolId", "physicalUid");

CREATE INDEX "NfcTapEvent_school_publicCode_createdAt_idx"
  ON "NfcTapEvent"("schoolId", "publicCode", "createdAt");
