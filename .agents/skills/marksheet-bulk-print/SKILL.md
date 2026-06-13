---
name: marksheet-bulk-print
description: Use when implementing or fixing class/stream/term marksheet bulk print, selected-student marksheet printing, or marksheet print CSS.
---

# Marksheet Bulk Print Skill

Strict rules:
- Marksheet bulk printing belongs to MarksheetsPage, not ParentReportPage.
- Parent report link must remain one student only.
- Class plus Stream plus Term should print all matching marksheets by default.
- If students are selected, print only selected students.
- Each marksheet must print on its own page.

Required behavior:
- show matching students/marksheets
- allow checkbox selection
- allow select all
- allow clear selection
- print all if none selected
- print selected only if selected students exist

Likely files:
- src/pages/MarksheetsPage.tsx
- src/index.css
- src/tests/ui/MarksheetsPage.test.tsx

Validation:
- npm test -- MarksheetsPage
- npm run build
