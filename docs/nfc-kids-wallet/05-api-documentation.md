# School Connect NFC / Kids Wallet API Documentation

## Authentication Expectations

- Public token and tag resolution routes do not require school authentication.
- School NFC routes require authenticated school access and school context.
- Some routes also require platform entitlement when integration is enabled.

## Error Response Patterns

Common responses include:

- `{ error: "message" }`
- `{ ok: true, ... }`
- `{ error: "MODULE_NOT_ENABLED", moduleCode, message }`
- `{ error: "PLATFORM_INTEGRATION_UNAVAILABLE", message }`

## Route Group: Student Credentials

### `POST /api/student-credentials`

- Purpose: issue a new NFC wristband credential.
- Auth/context: school auth and school context required.
- Body:

```json
{ "studentId": "uuid", "credentialUID": "WB-123456" }
```

### `GET /api/student-credentials`

- Purpose: list NFC wristbands for the school.
- Auth/context: school auth and school context required.
- Query examples: `search`, `studentId`, `status`

### `GET /api/student-credentials/allocation`

- Purpose: view wristband allocation status by class, stream, or search.
- Auth/context: school auth and school context required.

### `POST /api/student-credentials/bulk-allocate`

- Purpose: allocate many wristbands at once.
- Auth/context: school auth and school context required.
- Body:

```json
{
  "reason": "Term 1 allocation",
  "assignments": [
    { "studentId": "uuid", "credentialUID": "WB-123456" }
  ]
}
```

### `PATCH /api/student-credentials/:id/deactivate`

- Purpose: deactivate a wristband.

### `PATCH /api/student-credentials/:id/reactivate`

- Purpose: reactivate a wristband.

### `PATCH /api/student-credentials/:id/amend`

- Purpose: amend wristband metadata or ownership.

### `POST /api/student-credentials/scan`

- Purpose: verify or scan a wristband without triggering attendance or wallet action.
- Body:

```json
{ "credentialUID": "WB-123456", "context": "VERIFY" }
```

## Route Group: NFC Tags and Inventory

### `GET /api/nfc/resolve/:publicCode`

- Purpose: resolve a public NFC tag code to minimal lookup data.
- Auth/context: public.

### `GET /api/nfc/tag-batches`

- Purpose: list tag batches.
- Auth/context: school auth and school context required.

### `POST /api/nfc/tag-batches`

- Purpose: create a tag batch.

### `GET /api/nfc/tags/inventory`

- Purpose: list tag inventory for the school.

### `POST /api/nfc/tags/generate`

- Purpose: generate new NFC tags.

### `POST /api/nfc/tags/bulk-import-uids`

- Purpose: import physical UID wristbands into inventory.

### `POST /api/nfc/tags/bulk-allocate`

- Purpose: allocate imported tags to students.

### `GET /api/nfc/tags`

- Purpose: list tags.

### `PATCH /api/nfc/tags/:id/assign`

- Purpose: assign a tag to a student.

### `PATCH /api/nfc/tags/:id/unassign`

- Purpose: unassign a tag.

### `PATCH /api/nfc/tags/:id/disable`

- Purpose: disable a tag.

### `PATCH /api/nfc/tags/:id/enable`

- Purpose: re-enable a tag.

### `PATCH /api/nfc/tags/:id/verify`

- Purpose: mark a tag as verified.

### `PATCH /api/nfc/tags/:id/amend`

- Purpose: amend tag details.

### `GET /api/nfc/tags/:id/events`

- Purpose: read tag events.

## Route Group: Attendance and Gate

### `GET /api/nfc/attendance`

- Purpose: load the attendance dashboard.
- Permission: `nfc.devices.manage`
- Platform module: `nfc.core`

### `GET /api/nfc/attendance/register`

- Purpose: load the attendance register view.

### `POST /api/nfc/attendance/scan`

- Purpose: record an attendance scan.
- Permission: `nfc.devices.manage`
- Platform module: `nfc.attendance`

### `GET /api/nfc/gate`

- Purpose: load the gate security dashboard.
- Permission: `nfc.gate.view`
- Platform module: `nfc.core`

### `POST /api/nfc/gate/scan`

- Purpose: perform a gate access scan.
- Permission: `nfc.gate.scan`
- Platform module: `nfc.attendance`

## Route Group: Wallets

### `GET /api/nfc/wallets`

- Purpose: list student wallets and summary data.
- Permission: `nfc.wallets.pin.manage`
- Platform module: `nfc.wallet`

### `POST /api/nfc/wallets/resolve-student`

- Purpose: resolve a wallet student from a token or UID.

### `POST /api/nfc/wallets/top-up`

- Purpose: add money to a wallet.
- Permission: `nfc.wallets.topup`
- Platform module: `nfc.wallet`

### `POST /api/wallet/top-up`

- Purpose: legacy alias for wallet top-up.

### `POST /api/nfc/wallet/top-up`

- Purpose: legacy alias for wallet top-up.

### `GET /api/nfc/students/:studentId/wallet`

- Purpose: fetch one student wallet summary and transactions.

### `GET /api/nfc/wallet-transactions`

- Purpose: list wallet transactions.
- Permission: `nfc.wallets.topup` or `nfc.canteen.transactions.view`

### `POST /api/nfc/wallet-transactions/:id/reverse`

- Purpose: reverse a wallet transaction.
- Permission: `nfc.wallets.topup`

### `POST /api/nfc/wallets/adjust`

- Purpose: make a manual wallet adjustment.
- Permission: `nfc.wallets.topup`

### `GET /api/nfc/wallets/student/:studentId/pin-status`

- Purpose: read a student wallet PIN status.

### `POST /api/nfc/wallets/student/:studentId/pin`

- Purpose: set a student wallet PIN.

### `GET /api/nfc/wallets/:walletId/pin-status`

- Purpose: read a wallet PIN status.

### `POST /api/nfc/wallets/:walletId/pin`

- Purpose: set or reset a wallet PIN.

### `PATCH /api/nfc/wallets/:walletId/pin`

- Purpose: update a wallet PIN.

## Route Group: Canteen

### `GET /api/nfc/canteen/daily-summary`

- Purpose: get canteen daily totals.

### `GET /api/nfc/canteen/reconciliation`

- Purpose: list reconciliation items.
- Permission: `nfc.canteen.view`

### `POST /api/nfc/canteen/reconciliation/close`

- Purpose: close a reconciliation day.
- Permission: `nfc.canteen.reconciliation.submit`

### `POST /api/nfc/canteen/reconciliation/:id/approve`

- Purpose: approve a reconciliation.

### `POST /api/nfc/canteen/reconciliation/:id/reject`

- Purpose: reject a reconciliation.

### `POST /api/nfc/canteen/charge`

- Purpose: charge a wallet for canteen spending.
- Permission: `nfc.canteen.charge`
- Platform module: `nfc.canteen`

## Route Group: Fee Holds

### `GET /api/nfc/fee-holds`

- Purpose: list fee holds.
- Permission: `nfc.fee-holds.manage`

### `GET /api/nfc/fee-holds/students`

- Purpose: search students for fee holds.

### `POST /api/nfc/fee-holds`

- Purpose: create a fee hold.

### `PATCH /api/nfc/fee-holds/:id/clear`

- Purpose: clear a fee hold.

## Route Group: Offline

### `POST /api/nfc/offline/devices/register`

- Purpose: register an offline NFC device.

### `GET /api/nfc/offline/bootstrap`

- Purpose: download a device snapshot for offline use.

### `POST /api/nfc/offline/sync`

- Purpose: sync queued offline actions.

### `GET /api/nfc/offline/sync-status`

- Purpose: inspect sync progress and queue state.

## Internal Device Routes

### `POST /internal/kiosk/devices/register`

- Purpose: kiosk/device registration for internal device flows.

### `GET /internal/kiosk/offline-snapshot`

- Purpose: fetch an internal offline snapshot.

### `POST /internal/kiosk/sync`

- Purpose: internal device sync endpoint.

## Route Group: Policy and Settings

### `GET /api/nfc/policy`

- Purpose: read the NFC policy for the school.
- Permission: `nfc.devices.manage`

### `PUT /api/nfc/policy`

- Purpose: update the NFC policy.

## Route Group: Legacy Aliases

These aliases exist to preserve older URLs:

- `/api/wallet/top-up`
- `/api/nfc/wallet/top-up`
- `/nfc/wallets`
- `/nfc/attendance`
- `/nfc/tags`
- `/nfc/gate`
- `/nfc/canteen`

## Response Safety

Protected routes should never expose another school's wallet, student, or tag data.

If a route depends on the school context, it must fail closed when the school context is missing.
