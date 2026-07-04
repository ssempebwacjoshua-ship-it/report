# School Connect NFC / Kids Wallet Troubleshooting Guide

## What This Guide Covers

Use this guide when wristbands, gate scans, attendance, wallets, canteen charging, or offline sync do not behave as expected.

## Fast Checks

1. Confirm the user has the right role and permission.
2. Confirm the school context loaded correctly.
3. Confirm the wristband is active.
4. Confirm the device is on the right school snapshot if offline.
5. Confirm platform integration is configured if entitlements are enabled.

## Problem: Gate Security Cannot Open

Possible causes:

- Missing `nfc.gate.view` permission.
- Missing school context.
- Platform entitlement not enabled.
- User signed in with the wrong account.

What to do:

- Re-login.
- Check the role.
- Check the school assignment.
- Confirm the module is enabled for the school.

## Problem: Attendance Scan Fails

Possible causes:

- Wristband is not registered.
- Wristband is disabled or lost.
- The attendance snapshot is missing or expired.
- Offline attendance is disabled by policy.

What to do:

- Re-register or verify the wristband.
- Refresh the attendance register.
- Check offline policy settings.
- Check the queue for pending sync.

## Problem: Canteen Charge Is Blocked

Possible causes:

- Wallet balance is too low.
- Wallet is frozen.
- Wallet PIN is missing or locked.
- Fee hold is active.
- Offline limit has been exceeded.

What to do:

- Top up the wallet if appropriate.
- Reset the wallet PIN if required.
- Review fee hold status.
- Confirm the transaction is inside offline limits.

## Problem: Wallet Top-Up Does Not Save

Possible causes:

- The user lacks `nfc.wallets.topup`.
- The school context is missing.
- Platform entitlement is disabled.
- The backend returned an integration error.

What to do:

- Confirm the operator role.
- Confirm the school is selected.
- Confirm platform integration settings.
- Retry after confirming the backend is reachable.

## Problem: Wristband Was Not Found

Possible causes:

- The UID was typed incorrectly.
- The public code is wrong.
- The wristband is not linked to the school.
- The credential is inactive.

What to do:

- Re-scan instead of typing if possible.
- Search by student record.
- Check the credential status.

## Problem: Offline Mode Does Not Start

Possible causes:

- Device snapshot has not been downloaded.
- Snapshot belongs to another school.
- Snapshot belongs to another device.
- Offline use is disabled by policy.

What to do:

- Refresh the offline register.
- Check the device registration.
- Confirm the policy settings.

## Problem: Offline Sync Stays Pending

Possible causes:

- Network is still unavailable.
- The device is not registered.
- Queue items are waiting for background sync.
- The server rejected an action because the state changed.

What to do:

- Reconnect the device.
- Retry sync from the offline page.
- Review any conflict details.

## Problem: Platform Entitlement Error

Possible causes:

- `SSAMENJ_PLATFORM_INTEGRATION_ENABLED=true` but the school module is not entitled.
- The platform URL or service token is missing.
- The platform service is unreachable.

What to do:

- Verify the integration environment values.
- Verify the school entitlement.
- Retry after the platform service recovers.

## Problem: Public Tag Link Does Not Load

Possible causes:

- The public NFC URL is misconfigured.
- The tag public code is invalid.
- The tag record is missing.

What to do:

- Check `NFC_PUBLIC_APP_URL`, `PUBLIC_APP_URL`, or `APP_BASE_URL`.
- Verify the tag code.
- Confirm the tag exists in the school inventory.

## Problem: School Data Appears in the Wrong Place

Possible causes:

- The user is on the wrong school account.
- The browser cached an old session.
- The device snapshot belongs to another school.

What to do:

- Sign out and sign back in.
- Check the selected school.
- Refresh or re-download the device snapshot.

## When To Escalate

Escalate to support if:

- A protected route is accessible without the correct role.
- A different school's student data appears.
- Offline sync keeps failing after reconnection.
- Wallet or canteen balances look incorrect after a successful save.
- The platform entitlement state does not match the school contract.
