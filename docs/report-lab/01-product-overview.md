# School Connect Report Lab Official Overview

## Introduction

School Connect Report Lab is SSAMENJ Technologies' school reporting module for turning stored marks into professional student report cards. It is built for schools that need a guided workflow from marks entry to report preview, printing, parent release, and public verification.

## What Report Lab Does

Report Lab helps a school:

- Organize students by class and stream
- Maintain school academic context such as active academic year and term
- Import marks from CSV, Excel, or scanned marksheets
- Review and approve imported marks before they are used
- Generate report cards from finalized marks
- Print or save reports as PDFs
- Issue secure parent report links
- Verify issued reports with a reference code

## Problems It Solves

Report Lab is designed to reduce common school reporting problems:

- Manual calculation mistakes
- Repetitive typing of student marks
- Delays in preparing report cards
- Inconsistent school branding on reports
- Difficulty tracking which reports have been issued or revoked
- Limited visibility into import errors and missing marks

## Target Users

| User group | Typical use |
|---|---|
| Headteachers and school owners | Approve reports, review school branding, oversee release |
| Administrators | Set up classes, streams, subjects, academic year, and term |
| Teachers and clerks | Import marks and review results |
| Support staff | Help with onboarding, setup, and troubleshooting |
| Developers and administrators | Maintain deployments, APIs, and database settings |

## Key Features

- Student record management
- Class and stream setup
- Subject setup through school structure and provisioning
- Digital marks import from CSV or Excel
- Scanned marksheet review flow with OCR/AI assistance
- Report generation from finalized marks
- Parent report links with verification codes
- School branding and report personalization
- Settings for academic year, term, grading, and approval behavior
- Tenant-aware school context protection

## Standard Workflow

1. Sign in with a school account.
2. Confirm the school structure, academic year, and term.
3. Add or review students, classes, streams, and subjects.
4. Import marks from a file or scanned marksheet.
5. Review import results and fix errors.
6. Generate reports from finalized marks.
7. Preview and print reports.
8. Issue parent links when ready.
9. Verify issued reports using the public verification page.

## Supported School Setup Concepts

Report Lab currently works with these school concepts:

- School profile
- Academic year
- Term
- Class
- Stream
- Student
- Subject
- Guardian contact
- Assessment type: BOT, MOT, EOT, and TERM_SUMMARY

## Marks Import Overview

The import flow supports:

- CSV and Excel-based marks import
- Scanned marksheet context detection
- AI-assisted extraction for reviewed scan batches
- Dry-run validation before commit

This makes it possible to catch missing data and format problems before marks are written to the database.

## Report Generation Overview

Reports are generated from:

- Active school context
- Active academic year and term
- Students enrolled in the selected class and stream
- Finalized subject marks only
- Current school settings and personalization values

If the selected filters do not match a valid school setup, the system returns an empty or blocked state rather than fabricating report data.

## Report Verification Overview

Each issued report has:

- A reference code
- A parent access token behind the public link
- A public verification lookup by code
- Revocation and superseding support

Parents can open the issued link, view the report snapshot, and print or download it. Schools can verify a report through the public verification code page.

## School Branding Overview

Report Lab supports school branding elements such as:

- School name
- Logo
- Motto
- Address
- Phone number
- Email address
- Website
- Headteacher name
- Stamp
- Headteacher signature image

Branding is applied in the report personalization settings and in the printed report layout.

## Benefits To Schools

- Faster report preparation
- Fewer manual errors
- Better control over report approval
- Professional-looking reports
- Clear record of issued and revoked reports
- Easier parent sharing and verification

## Human Approval Rule

Report Lab is designed so that a person in the school remains responsible for final review. The system can prepare the report and show the data, but the school must approve the result before issuing it to parents.

## Data Accuracy Responsibility

The system can only work with the data entered into it. The school remains responsible for:

- Correct student records
- Correct class and stream placement
- Correct subject setup
- Correct marks import review
- Correct report approval before release

Report Lab helps reduce mistakes, but it does not replace school review.

## Support And Contact

- Website: https://ssamenj.vercel.app/
- Global WhatsApp/contact: +971 56 370 4103
- Uganda product manager/contact: +256 774 549 869

## First Term Offer

First term free; setup fee applies.

