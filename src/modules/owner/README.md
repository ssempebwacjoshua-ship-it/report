# Owner Module

## Module Purpose

Owns platform owner dashboards, school provisioning/management, subscription controls, reader fleet management, support sessions, and platform-level diagnostics.

## Owned Routes

- Browser: `/report-lab/owner/*`
- API: `/api/owner/*`, `/api/platform/*`

## Owned DB Models

- `PlatformSupportSession`
- `SchoolFeatureFlag`
- owner/subscription reads and writes against `School`, `User`, `ReportLabSubscription`, `ReportLabInvoice`, `SmartPagePaymentRequest`, `NfcOfflineDevice`, `ReaderDeviceCommand`

## Owned Frontend Pages And Components

- `src/pages/owner/*`
- `src/components/layout/OwnerShell.tsx`
- `src/client/ownerClient.ts`

## Known Integration Points

- Depends on shared auth plus platform-owner/platform-admin enforcement.
- Reads across reports, smart pages, NFC, and communications surfaces for operational support.
- Reader-management flows overlap with NFC device/runtime code.
- Subscription and billing updates affect reports and smart-pages entitlements.
