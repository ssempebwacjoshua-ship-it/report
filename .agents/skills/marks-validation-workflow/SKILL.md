---
name: marks-validation-workflow
description: Use when reviewing marks import, missing marks, subject totals, grading, class/stream/term matching, report readiness, or operator validation before report generation.
---

# Marks Validation Workflow Skill

Validate:
- correct class
- correct stream
- correct term
- correct subject
- correct student match
- valid mark range
- missing marks
- duplicate student rows
- duplicate subject marks
- grading boundaries
- total/average calculations
- teacher/operator validation status

Rules:
- Do not generate final reports from unvalidated OCR guesses.
- Low-confidence OCR marks require operator validation.
- Missing marks must be visible before report generation.
- Report readiness must be based on real validated marks.
- Do not silently skip students.
