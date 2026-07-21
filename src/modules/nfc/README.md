# NFC Module

## Purpose

Owns wristbands/tags, wallet and canteen flows, gate operations, attendance, offline kiosk sync, and reader gateway/device activation.

## Owned Public Routes

- Public NFC tap/token flows and reader-facing endpoints must remain stable
- Public/intake paths to preserve during migration:
  - Reader and kiosk sync/bootstrap endpoints under `/api/readers/*`
  - Public NFC tap/token flows
- Route registration file: `src/server/modules/registerNfcRoutes.ts`

## Owned Frontend Routes/Pages

- Browser: `/report-lab/nfc/*`, student wallet pages, public NFC tap/token flows
- Current legacy files:
  - `src/pages/Nfc*.tsx`
  - `src/pages/StudentCredentialsPage.tsx`
  - `src/pages/StudentWalletPage.tsx`
  - `src/pages/StudentWalletTopUpPage.tsx`

## Owned Server Routes

- API: `/api/nfc/*`, `/api/student-credentials*`, `/api/staff-users*`, `/api/readers/*`
- Current route files still outside the module:
  - `src/server/routes/nfcOfflineRoutes.ts`
  - `src/server/routes/nfcOperationsRoutes.ts`
  - `src/server/routes/nfcTagsRoutes.ts`
  - `src/server/routes/readerGatewayRoutes.ts`
  - `src/server/routes/studentCredentialRoutes.ts`
  - `src/server/routes/staffUsersRoutes.ts`

## Owned Services

- Wallet, canteen, attendance, gate, visitor, pass-out, reader, and offline services
- Current legacy files still outside the module:
  - `src/server/services/nfcCanteenReconciliationService.ts`
  - `src/server/services/nfcCredentialResolver.ts`
  - `src/server/services/nfcOfflineService.ts`
  - `src/server/services/nfcOperationsService.ts`
  - `src/server/services/nfcPassOutNotificationService.ts`
  - `src/server/services/nfcPassOutService.ts`
  - `src/server/services/nfcPolicyService.ts`
  - `src/server/services/nfcTagBatchService.ts`
  - `src/server/services/nfcTagsService.ts`
  - `src/server/services/nfcVisitorService.ts`
  - `src/server/services/readerAttendanceService.ts`
  - `src/server/services/readerCredentialLinkService.ts`
  - `src/server/services/readerDeviceCommandService.ts`
  - `src/server/services/readerGatewayRegistrationService.ts`
  - `src/server/services/studentCredentialService.ts`

## Owned Repositories

- None isolated yet

## Owned Client API Files

- Current legacy files:
  - `src/client/nfcOfflineClient.ts`
  - `src/client/nfcTagsClient.ts`
  - `src/client/studentCredentialsClient.ts`

## Owned Tests

- Current legacy tests still outside the module:
  - `src/tests/nfc/*`
  - `src/tests/offline/*`
  - `src/tests/routes/nfc*`
  - `src/tests/routes/readerGatewayRoutes.test.ts`
  - `src/tests/services/nfc*`
  - `src/tests/services/readerAttendanceService.test.ts`
  - `src/tests/services/readerCredentialLinkService.test.ts`
  - `src/tests/ui/Nfc*.test.tsx`
  - `src/tests/ui/StudentCredentialsPage.test.tsx`

## Owned Prisma Models, If Any

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

## Owned Permissions

- NFC operations, canteen, attendance, gate, wallet, and device-management permissions
- Exact permission names must be mapped during module migration

## Owned Audit Events

- Scan, wallet, canteen, tag, pass-out, visitor, and device-management audit events
- Exact event names must be mapped during module migration

## Shared Dependencies

- Shared student, class, school, and auth context
- Owner device-management integration points

## External Providers/Integrations

- Reader gateway devices
- Offline kiosk/device sync flows

## Background Jobs/Workers

- Reader/device commands and notification side effects where applicable
- Worker startup remains centralized in `src/server/modules/registerWorkers.ts`

## High-Risk Flows

- Wallet/canteen money logic
- Attendance and gate scans
- Offline mode
- Reader gateway/device activation
- Pass-outs and visitors

## Migration Status

- Skeleton only
- Ownership contract defined
- Runtime files not moved yet

## Known Legacy Files Still Outside The Module

- `src/pages/Nfc*.tsx`
- `src/pages/StudentCredentialsPage.tsx`
- `src/pages/StudentWalletPage.tsx`
- `src/pages/StudentWalletTopUpPage.tsx`
- `src/components/nfc/*`
- `src/hooks/useNfcScanner.ts`
- `src/offline/*`
- `src/server/routes/nfcOfflineRoutes.ts`
- `src/server/routes/nfcOperationsRoutes.ts`
- `src/server/routes/nfcTagsRoutes.ts`
- `src/server/routes/readerGatewayRoutes.ts`
