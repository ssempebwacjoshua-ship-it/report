-- Preflight check before applying this migration in a populated environment:
-- SELECT "schoolId", "studentId", "type", COUNT(*)
-- FROM "StudentCredential"
-- WHERE "status" = 'ACTIVE'
-- GROUP BY "schoolId", "studentId", "type"
-- HAVING COUNT(*) > 1;
--
-- If this query returns rows, resolve the duplicate active credentials manually before applying the index.

CREATE UNIQUE INDEX "StudentCredential_one_active_per_student_type_idx"
ON "StudentCredential"("schoolId", "studentId", "type")
WHERE "status" = 'ACTIVE';
