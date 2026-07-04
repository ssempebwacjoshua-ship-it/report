# School Connect NFC / Kids Wallet School Onboarding Guide

## Purpose

This guide helps a school get NFC wristbands, wallet, gate, attendance, and canteen flows ready for live use.

## Before You Start

Make sure you have:

- A school account.
- The correct admin or operator permissions.
- NFC wristbands or tags.
- A compatible NFC reader where required.
- A device for gate or canteen scanning.
- A reliable school internet connection for initial setup.

## Recommended Setup Order

1. Confirm school roles and permissions.
2. Confirm the NFC product area is visible in the app.
3. Set the public NFC URL if you use printed tags or deep links.
4. Configure wallet, gate, attendance, and canteen policy.
5. Register wristbands.
6. Allocate wristbands to students.
7. Test attendance, gate, and canteen scans.
8. Enable offline mode only after online scanning works.

## Permissions To Assign

Useful permissions include:

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

## Platform Integration

If your school uses the platform integration layer:

- Enable the integration only after the platform URL and service token are ready.
- Make sure the NFC module entitlement is active for the school.
- Test the protected routes while integration is enabled.
- Confirm the system falls back safely when integration is disabled.

## Public NFC Link Setup

If your school uses printed tags or deep links, set the public NFC URL so generated links point to the correct place.

Use one of:

- `NFC_PUBLIC_APP_URL`
- `PUBLIC_APP_URL`
- `APP_BASE_URL`

Do not put secrets in these values. They are public URLs only.

## Wallet Setup

Before live use:

- Decide who can top up wallets.
- Decide whether wallet PINs are required.
- Decide when wallet balances should block canteen charging.
- Confirm how reversals will be approved.

## Attendance Setup

Before live use:

- Confirm the attendance register route works for the school.
- Test a few wristbands on the live reader.
- Decide whether late cut-off rules apply.

## Gate Setup

Before live use:

- Confirm the gate dashboard loads for the gate security role.
- Test allow and block outcomes.
- Confirm the school policy for fee-hold blocking.
- Test offline gate mode if the device will use it.

## Canteen Setup

Before live use:

- Confirm the canteen charge route works.
- Confirm the canteen PIN flow.
- Set offline limits if offline charging is allowed.
- Test transaction reversal and reconciliation access.

## Offline Setup

Offline mode should be enabled only after the live routes are working.

Steps:

1. Register the device.
2. Download the school snapshot.
3. Confirm the snapshot contains students, tags, and wallets.
4. Confirm the snapshot is current and matches the school.
5. Test one gate or canteen scan in offline mode.

## Go-Live Checklist

- Wristbands register correctly.
- Wristbands allocate correctly.
- Gate scans work online.
- Attendance scans work online.
- Wallet top-up works.
- Canteen charge works.
- Fee holds behave as expected.
- Offline snapshot loads.
- Offline sync returns to the server.

## Common Onboarding Risks

- Wrong school context on the operator account.
- Missing entitlement for the NFC module.
- Public NFC URL pointing at the wrong domain.
- Scanner device not registered.
- Offline snapshot not downloaded before use.

## Handover Notes

Make sure the school knows:

- Who can issue or allocate wristbands.
- Who can top up wallets.
- Who can reverse charges.
- Who can close canteen reconciliation.
- Who is responsible for offline sync errors.
