# NFC Module

## Module Purpose

Owns wristbands/tags, wallet and canteen flows, gate operations, attendance, offline kiosk sync, and reader gateway/device activation.

## Owned Routes

- Browser: `/report-lab/nfc/*`, student wallet pages, public NFC tap/token flows
- API: `/api/nfc/*`, `/api/student-credentials*`, `/api/staff-users*`, `/api/readers/*`, internal kiosk sync/bootstrap routes

## Owned DB Models

- `StudentCredential`
- `StudentWallet`
- `StudentWalletTransaction`
- `SchoolNfcPolicy`
- `StudentFeeHold`
- `StudentGateHold`
- `CanteenReconciliation`
- `StudentAttendanceEvent`
- `DailyAttendance`
- `CampusMovementEvent`
- `ClassroomAttendanceEvent`
- `NfcGateScan`
- `NfcOfflineDevice`
- `ReaderDeviceCommand`
- `NfcOfflineSyncBatch`
- `NfcTagBatch`
- `NfcTag`
- `NfcTapEvent`

## Owned Frontend Pages And Components

- `src/pages/Nfc*.tsx`
- `src/pages/StudentCredentialsPage.tsx`
- `src/pages/StudentWalletPage.tsx`
- `src/pages/StudentWalletTopUpPage.tsx`
- `src/components/nfc/*`
- `src/hooks/useNfcScanner.ts`
- `src/offline/*`

## Known Integration Points

- Staff and auth permissions control access to operational NFC pages.
- Owner console manages reader devices and activation support.
- Shared student, class, and school models drive attendance, wallet, and tag allocation flows.
- Public NFC URLs and reader endpoints must remain backward compatible.
