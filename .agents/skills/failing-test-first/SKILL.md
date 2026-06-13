---
name: failing-test-first
description: Use before fixing any bug where behavior can be tested. Creates or updates the failing test first, stops for confirmation, then fixes only the tested behavior.
---

# Failing Test First Skill

Use this skill before implementing bug fixes.

## Rule

Do not fix first when a failing test can be written.

First:

1. Identify the responsible area.
2. Identify allowed files.
3. Create or update the failing test that proves the bug.
4. Run the test and confirm it fails for the expected reason.
5. Stop and report the failing test.

Second:

Only after the failing test exists, make the smallest fix so it passes.

## Do not

- Do not scan unrelated files.
- Do not refactor broadly.
- Do not fix multiple bugs at once.
- Do not stage unrelated files.
- Do not commit if tests/build fail.

## Required output

- responsible area
- files inspected
- failing test added/updated
- failure output
- fix files
- tests run
- commit created
