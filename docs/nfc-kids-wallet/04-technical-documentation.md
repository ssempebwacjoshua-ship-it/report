# School Connect NFC / Kids Wallet Technical Documentation

## Architecture Summary

School Connect NFC is a protected school module with a small public deep-link surface.

The app has two important route groups:

- Public NFC lookup routes mounted before school context resolution.
- Protected NFC operational routes mounted after school context resolution and role enforcement.

## Route Mounting Order

In `src/server/index.ts`:

1. Public routes are mounted first.
2. School context is resolved.
3. School role access is enforced.
4. Protected NFC routes are mounted after `req.school` is available.

That order matters because protected NFC handlers rely on school context.

## Public Surface

Public NFC routes include:

- `GET /api/nfc/t/:token`
- `GET /api/nfc/resolve/:publicCode`
- App routes such as `/nfc/t/:token` and `/t/:publicCode`

These routes are intended for public deep-link resolution and should not expose school-only operational data.

## Protected NFC Surfaces

Protected school routes include:

- Attendance and gate dashboards
- Wallet listing and top-up
- Canteen charging and reconciliation
- Fee holds
- Offline bootstrap and sync
- Wristband issuing and allocation

These routes require:

- Authentication
- School context
- The correct school permission
- Platform entitlement when integration is enabled

## Permission Model

The code uses both route permissions and platform module entitlements.

Examples:

- `nfc.tags.manage`
- `nfc.devices.manage`
- `nfc.wallets.topup`
- `nfc.wallets.pin.manage`
- `nfc.gate.view`
- `nfc.gate.scan`
- `nfc.canteen.charge`
- `nfc.canteen.transactions.view`
- `nfc.canteen.reconciliation.view`
- `nfc.canteen.reconciliation.submit`
- `nfc.fee-holds.manage`

## Platform Entitlement Model

When `SSAMENJ_PLATFORM_INTEGRATION_ENABLED=true`, protected NFC features check module entitlements before proceeding.

Module codes used by the server include:

- `nfc.core`
- `nfc.attendance`
- `nfc.wallet`
- `nfc.canteen`
- `nfc.tags`

If integration is disabled, entitlement checks are bypassed and usage recording becomes a no-op.

## Safe Failure Behavior

The platform integration layer is designed to fail safely:

- Disabled integration does not block the app.
- Missing entitlement returns a controlled module-not-enabled response.
- Platform reachability issues return a safe integration-unavailable error.
- Usage recording errors should not leak secrets or crash the request flow.

## Offline Design

Offline NFC uses device snapshots and queued actions.

Supported offline modes include:

- Gate
- Attendance
- Canteen

Offline state tracks:

- Snapshot age
- Snapshot owner school
- Snapshot device binding
- Pending queue count
- Sync status

## Offline Policy Data

The NFC policy includes controls such as:

- Attendance cut-off
- Gate offline enabled
- Canteen offline enabled
- Snapshot validity hours
- Offline spend limits
- Offline conflict handling

## Data Model Highlights

The NFC module depends on school-bound records such as:

- Student credentials / wristbands
- Student wallets
- Wallet transactions
- Attendance events
- Gate scans
- Fee holds
- Canteen reconciliations
- Offline devices
- Offline sync batches

## Public URL Resolution

When the server creates public tag URLs, it resolves the base URL from:

- `NFC_PUBLIC_APP_URL`
- `PUBLIC_APP_URL`
- `FRONTEND_APP_URL`
- `VITE_PUBLIC_APP_URL`
- Request origin or host as a fallback

For production, configure a real public URL instead of relying on the request host fallback.

## Environment Variables

Server-side NFC work may use these environment variables:

- `CLIENT_ORIGIN`
- `APP_BASE_URL`
- `PUBLIC_APP_URL`
- `NFC_PUBLIC_APP_URL`
- `SSAMENJ_PLATFORM_INTEGRATION_ENABLED`
- `SSAMENJ_PLATFORM_URL`
- `SSAMENJ_PLATFORM_SERVICE_TOKEN`
- `PLATFORM_ADMIN_KEY`
- `INTERNAL_TEST_KEY`

Security notes:

- Do not expose secrets to the frontend bundle.
- Keep platform service tokens and admin keys server-only.
- Public URL values are not secrets.

## Public Versus Protected Data

Public NFC routes should only expose the minimum data needed to resolve a deep link.

Protected routes may expose:

- Student wallet summaries
- Attendance summaries
- Gate scan outcomes
- Canteen transaction details

Those protected routes must remain under school auth and school context.

## Implementation Notes

- `src/server/routes/nfcOperationsRoutes.ts` handles attendance, gate, wallet, canteen, fee-hold, and offline-facing APIs.
- `src/server/routes/nfcTagsRoutes.ts` handles wristband and tag inventory APIs.
- `src/server/routes/nfcOfflineRoutes.ts` handles device registration and offline sync APIs.
- `src/server/routes/studentCredentialRoutes.ts` handles student wristband issuance and scanning APIs.
- `src/server/platformIntegration.ts` and `src/server/platformClient.ts` handle integration checks and usage recording.

## Testing Notes

The codebase already includes route and service coverage for NFC flows, including:

- Gate routes
- Gate authenticated flow
- Gate, attendance, wallet, and canteen services
- Offline sync and resolver logic
- NFC tag routes
- Platform client behavior

Those tests are the primary safety net for this module.
