# School Connect NFC / Kids Wallet User Manual

## How to Use This Module

This guide is for the people who work with NFC wristbands every day.

The main areas you will use are:

- `NFC > Wristbands`
- `NFC > Bulk Issuing`
- `NFC > Bulk Allocation`
- `NFC > Attendance`
- `NFC > Gate`
- `NFC > Wallets`
- `NFC > Canteen`
- `NFC > Fee Holds`
- `NFC > Offline`
- `NFC > Settings`

## Wristband Work

### Register a new wristband

Use `NFC > Wristbands` to create or verify a student wristband record.

Typical flow:

1. Search for the student.
2. Tap or type the wristband UID.
3. Save the credential.
4. Verify that the status is active.

### Bulk issue wristbands

Use `NFC > Bulk Issuing` when you are preparing many wristbands at once.

You can:

- Create URL tag batches.
- Register UID wristbands into inventory.
- Review the written payload or UID list before allocation.

### Bulk allocate wristbands

Use `NFC > Bulk Allocation` to assign many wristbands to students in one session.

Always check:

- Student name
- Admission number
- Class or stream
- Wristband UID

## Attendance

Use `NFC > Attendance` for scan-based attendance marking.

Common steps:

1. Open the attendance register.
2. Scan the wristband.
3. Confirm whether the student is in or out.
4. Watch for offline or pending sync messages.

Notes:

- Attendance scans can work offline when the school has a valid snapshot.
- If the snapshot is expired or missing, refresh it before scanning again.

## Gate Security

Use `NFC > Gate` for gate control and security checks.

Typical flow:

1. Open Gate Security.
2. Scan the wristband or token.
3. Review the allow/block result.
4. Look for fee hold or access-block reasons.

Notes:

- Gate staff should not treat a successful scan as a financial transaction.
- Gate access and attendance are separate actions, even if they use the same wristband.

## Wallets

Use `NFC > Wallets` to review balances and manage wallet PINs.

You can:

- Search for a student.
- View current balance.
- See whether the wallet PIN is set.
- Set or reset the wallet PIN.
- Move to the top-up flow.

### Top up a wallet

Use `NFC > Wallets > Top Up` when the school wants to add money to a student wallet.

Good practice:

- Confirm the student name and admission number.
- Confirm the top-up amount.
- Record the reason or receipt note.
- Review the new balance after saving.

## Canteen

Use `NFC > Canteen` to charge meals or other approved purchases against the wallet.

Typical steps:

1. Enter the charge amount.
2. Scan the wristband.
3. Confirm the student and wallet status.
4. Enter the wallet PIN if required.
5. Save the charge.

Use `NFC > Canteen > Transactions` to review charges and reversals.

Use `NFC > Canteen > Reconciliation` to review and close the canteen day when needed.

## Fee Holds

Use `NFC > Fee Holds` to mark students whose fee status should block or warn during gate and attendance workflows.

You can:

- Search for a student.
- Add a fee hold.
- Clear an existing fee hold.
- Review the blocking reason.

## Offline Mode

Use `NFC > Offline` when the school wants gate or canteen work to continue without live connectivity.

What to remember:

- Offline mode only works when the device has a valid snapshot.
- The snapshot must match the school and the device.
- Pending actions will sync later when the connection returns.
- Conflicts should be reviewed manually.

## Settings

Use `NFC > Settings` if you have admin access.

This area controls:

- Fee-defaulter blocking
- Attendance cut-off time
- Gate offline policy
- Canteen offline policy
- Offline snapshot validity
- Offline conflict behavior

## Safety Rules

- Do not share a wallet PIN with students.
- Do not guess a wristband UID.
- Do not clear a fee hold without checking the reason.
- Do not rely on an expired offline snapshot.
- Always verify the student identity before top-up or reversal actions.

## If Something Looks Wrong

- Check whether the student has an active wristband.
- Check whether the school has enabled the required permission.
- Check whether offline mode is active.
- Check whether the wallet is frozen or has a PIN lock.
- Escalate repeated scan or sync failures to support.
