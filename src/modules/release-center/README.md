# Release Center Module

## Module Purpose

Owns report-link issuance, bulk release operations, revoke/sent tracking, and parent-facing report delivery flows.

## Owned Routes

- Browser: `/report-lab/reports/release`, parent/public report access flows
- API: `/api/reports/release-*`, `/api/reports/issue-*`, `/api/p/:token`, `/api/p/:token/downloaded`

## Owned DB Models

- `IssuedReport`

## Owned Frontend Pages And Components

- `src/pages/ReleaseCenterPage.tsx`
- `src/pages/ParentReportPage.tsx`
- `src/shared/reportReleaseMessage.ts`

## Known Integration Points

- Reports provides report content and issuance-ready data.
- Communications uses release message formatting and recipient delivery flows.
- Auth and public token handling protect staff and parent access separately.
- Shared routing must preserve current parent/public URLs.
