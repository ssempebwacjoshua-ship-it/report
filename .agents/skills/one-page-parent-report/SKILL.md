---
name: one-page-parent-report
description: Use when fixing or reviewing ParentReportPage, public parent report links, preview, print, download/PDF, and one-page report layout.
---

# One Page Parent Report Skill

Strict rules:
- Parent report link /parent/r/:token is one student only.
- Preview, print, and download/PDF must always be exactly one page.
- Do not add bulk print or student selection to ParentReportPage.
- Do not hide required sections to force one page.
- Compact layout instead.

Required sections:
- student details
- marks/grades
- class teacher comment
- head teacher comment
- conduct/progression
- name/sign/date rows

Likely files:
- src/pages/ParentReportPage.tsx
- src/components/reports/StudentReportDetail.tsx
- src/index.css
- src/tests/ui/ParentReportPage.test.tsx

Validation:
- npm test -- ParentReportPage
- npm run build
