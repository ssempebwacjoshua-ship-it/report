---
name: report-lab-task-triage
description: Use before coding any School Connect Reports Lab bug or feature. Classifies the work, chooses the right agent/skill, identifies likely files/tests, and prevents broad unrelated changes.
---

# Report Lab Task Triage Skill

Use this skill before implementing any Report Lab fix or feature.

## Goal

Turn a rough user bug/request into a focused implementation brief.

## Step 1: Classify the task

Choose exactly one primary area:

- parent report layout
- marksheet OCR
- marksheet print
- dashboard live data
- release center/message
- deployment/env
- tests/regression
- unknown/mixed

If mixed, split into separate tasks.

## Step 2: Apply product rules

Always protect these rules:

- Parent report link `/parent/r/:token` is one student only.
- Parent report preview, print, and download/PDF must always be one page.
- Parent report must include marks, class teacher comment, head teacher comment, conduct/progression, and name/sign/date rows.
- Marksheet bulk printing belongs to MarksheetsPage only.
- OCR provider unavailable is only for actual OCR provider/API failure.
- Dashboard must use live data and every visible button must be wired.
- Release messages must not expose internal enums like TERM_SUMMARY.
- No broad unrelated refactors unless explicitly requested.

## Step 3: Choose specialist

Use this routing:

- parent report layout -> report-layout-guardian / one-page-parent-report
- marksheet OCR -> marksheet-ocr-agent / marksheet-ocr-debug
- marksheet print -> marksheet-ocr-agent / marksheet-bulk-print
- dashboard live data -> dashboard-live-data-agent / dashboard-live-wiring
- release center/message -> release-center-agent / release-link-message-safety
- final checks -> test-regression-agent / report-regression-check

## Step 4: Produce task brief

Return:

- Area
- Risk level
- Specialist to use
- Skill to use
- Likely files
- Tests to run
- Strict non-goals
- Implementation brief

## Step 5: Validate before completion

Before declaring done, require:

- git diff --stat
- relevant tests
- npm run build
- confirmation no unrelated areas changed

## Responsible-file scanning rule

Before any search or code change:

1. Declare responsible area.
2. Declare likely files/directories.
3. Scan only those first.
4. Avoid broad repo scans unless targeted search fails.
5. Explain why if broader scanning is required.
6. Keep fix scoped.
7. Stage only responsible files.
8. After tests/build pass, create a focused commit.
