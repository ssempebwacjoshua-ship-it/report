---
name: release-link-message-safety
description: Use when fixing ReleaseCenterPage, report release flow, parent report links, secure report tokens, SMS/WhatsApp report messages, or reportReleaseMessage helpers.
---

# Release Link Message Safety Skill

Strict rules:
- Parent-facing messages must be professional.
- Internal enums like TERM_SUMMARY must never appear.
- Do not include marks/grades inside SMS or WhatsApp messages.
- Link must open the correct student report.
- Public parent link must render one page.
- Released reports must respect approval status.

Preferred message:
Dear Parent, [Student Name] Term [Term Name] school report from [School Name] is ready.
Please open the secure link below to view, print, or download the report:
[secure report link]

Likely files:
- src/pages/ReleaseCenterPage.tsx
- src/pages/ReportsPage.tsx
- src/shared/reportReleaseMessage.ts
- src/tests/shared/*

Validation:
- npm test -- reportReleaseMessage
- npm run build
