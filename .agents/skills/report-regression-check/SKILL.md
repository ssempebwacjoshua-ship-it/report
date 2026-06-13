---
name: report-regression-check
description: Use before committing any Report Lab change. Checks tests, build, dead buttons, fake data, report layout, OCR status logic, secrets, and unrelated file drift.
---

# Report Regression Check Skill

Always check:
- git status --short
- git diff --stat
- npm run build

Run targeted tests depending on changed area:
- npm test -- ParentReportPage
- npm test -- MarksheetsPage
- npm test -- DashboardPage
- npm test -- reportReleaseMessage

Block commit if:
- tests fail
- build fails
- parent report becomes multi-page
- dashboard has fake data
- dashboard has dead buttons
- OCR success shows provider unavailable
- parent message exposes internal enums
- real secrets appear in tracked files
- unrelated files changed without reason
