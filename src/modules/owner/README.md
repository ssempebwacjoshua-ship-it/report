# Owner Module

## Purpose

Owns platform owner dashboards, school provisioning/management, subscription controls, reader fleet management, support sessions, and platform-level diagnostics.

## Owned Public Routes

- None intended
- Route registration file: `src/server/modules/registerOwnerRoutes.ts`

## Owned Frontend Routes/Pages

- Browser: `/report-lab/owner/*`
- Current legacy files:
  - `src/pages/owner/*`

## Owned Server Routes

- API: `/api/owner/*`, `/api/platform/*`
- Current route files still outside the module:
  - `src/server/routes/platformOwnerRoutes.ts`
  - `src/server/routes/platformAdminRoutes.ts`
  - `src/server/routes/subscriptionRoutes.ts`

## Owned Services

- School provisioning, structure provisioning, support, billing, and reader management coordination
- Current legacy files still outside the module:
  - `src/server/services/schoolProvisioningService.ts`
  - `src/server/services/schoolStructureProvisioningService.ts`
  - `src/server/services/subscriptionEntitlementService.ts`
  - `src/server/services/staffUsersService.ts`

## Owned Repositories

- None isolated yet

## Owned Client API Files

- Current legacy files:
  - `src/client/ownerClient.ts`
  - `src/client/subscriptionClient.ts`

## Owned Tests

- Current legacy tests still outside the module:
  - `src/tests/routes/ownerSchoolCreation.test.ts`
  - `src/tests/routes/platformAdminRoutes.test.ts`
  - `src/tests/routes/platformOwnerRoutes.test.ts`
  - `src/tests/routes/subscriptionRoutes.test.ts`
  - `src/tests/security/subscriptionEntitlementService.test.ts`
  - `src/tests/ui/OwnerConsolePages.test.tsx`
  - `src/tests/ui/OwnerSchoolsPage.test.tsx`

## Owned Prisma Models, If Any

- `PlatformSupportSession`
- `SchoolFeatureFlag`
- Owner/subscription reads and writes against `School`, `User`, `ReportLabSubscription`, `ReportLabInvoice`, `SmartPagePaymentRequest`, `NfcOfflineDevice`, `ReaderDeviceCommand`

## Owned Permissions

- Platform-owner/platform-admin permissions
- School provisioning and subscription-management permissions

## Owned Audit Events

- School create/update, owner support, subscription, and device-management audit events
- Exact event names must be mapped during module migration

## Shared Dependencies

- Shared auth and tenant/platform boundary enforcement
- Cross-module reporting, NFC, smart-pages, and communications operational data

## External Providers/Integrations

- Billing/subscription integrations where applicable
- Reader fleet/device activation flows

## Background Jobs/Workers

- None isolated yet

## High-Risk Flows

- Platform-owner access
- School provisioning
- Subscription/billing changes
- Reader fleet operations

## Migration Status

- Skeleton only
- Ownership contract defined
- Runtime files not moved yet

## Known Legacy Files Still Outside The Module

- `src/pages/owner/*`
- `src/components/layout/OwnerShell.tsx`
- `src/client/ownerClient.ts`
- `src/client/subscriptionClient.ts`
- `src/server/routes/platformOwnerRoutes.ts`
- `src/server/routes/platformAdminRoutes.ts`
- `src/server/routes/subscriptionRoutes.ts`
