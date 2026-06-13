# AI Task Contract

Use this file before starting any AI coding task.

## Bug / Feature

Describe the exact issue here.

## Responsible area

Choose one:
- parent report layout
- marksheet OCR
- marksheet print
- dashboard live data
- release center/message
- deployment/env
- tests/regression
- other

## Allowed files

List the only files/directories the AI may inspect or edit first.

- 

## Forbidden files

List files/areas that must not be touched.

- 

## Failing test required?

Yes/No:

If yes, the AI must create or update the failing test first, then stop before fixing.

## Required proof

Commands that must pass before completion:

- npm run verify:parent-report
- npm run build

## Commit message

Write the expected focused commit message here.

## Completion checklist

- [ ] Responsible files only
- [ ] Failing test created or updated first where applicable
- [ ] Fix is minimal
- [ ] Relevant verify command passed
- [ ] npm run build passed
- [ ] Only responsible files staged
- [ ] Focused commit created
