# School Connect NFC / Kids Wallet Product Overview

## Introduction

School Connect NFC is the operational module for school wristbands, scan-based attendance, gate security, student wallet balances, canteen purchases, fee-hold enforcement, and offline register sync.

Kids Wallet is the school-facing way to describe the wallet and scan workflows in this module. It is still the same NFC product area.

This module is for school operations, not banking. It tracks school-controlled balances and school-controlled scan events.

## What the Module Does

School Connect NFC can:

- Issue NFC wristbands to students.
- Register, verify, amend, disable, and re-enable wristbands.
- Bulk import wristband UIDs into inventory.
- Bulk allocate wristbands to students.
- Track attendance from NFC scans.
- Support gate security scanning and gate dashboards.
- Manage student wallet balances and top-ups.
- Charge canteen purchases against student wallets.
- Apply and clear fee holds for students.
- Keep offline gate and canteen registers on approved devices.
- Sync offline actions back to the server when connectivity returns.
- Show NFC policy settings for the school.

## Problems It Solves

- Reduces manual attendance marking.
- Gives gate staff a fast way to check student access.
- Lets canteen staff charge meals against a student wallet.
- Gives administrators a clear list of who has a wristband and who does not.
- Supports offline use when the network is weak or unavailable.
- Helps schools enforce fee-defaulter rules consistently.

## Target Users

- Headteachers and school owners.
- Administrators and bursars.
- Gate security staff.
- Attendance staff.
- Canteen staff.
- School ICT or operations support.

## Main Workflow

1. Register or import wristbands.
2. Allocate the wristband to a student.
3. Use scans at attendance, gate, or canteen points.
4. Top up the wallet when needed.
5. Apply fee holds where required.
6. Review offline actions and sync failures.

## Key Features Present

- Wristband issuance and inventory management.
- Student credential registry.
- Attendance register and scan processing.
- Gate security dashboard and scan processing.
- Student wallet list, balance detail, and top-up flow.
- Canteen charging, transaction history, and reversals.
- Fee hold management.
- NFC policy settings.
- Offline mode for gate, attendance, and canteen.
- Public wristband and tag deep-link resolution.

## Public and Protected Behavior

- Public deep-link pages exist for NFC token and tag lookup flows.
- School operational routes are protected by school authentication and school context.
- When platform integration is enabled, protected NFC routes also check entitlement.

## Benefits to Schools

- Faster student service points.
- Better accountability at gate and canteen.
- Less manual record keeping.
- Clearer audit trails for wallet and scan activity.
- Safer offline operation with device-bound registers.

## Limitations

- The module is not a payment gateway.
- Wallet balances are school-managed records, not external bank accounts.
- Offline mode depends on a valid device snapshot.
- Schools should still review exceptions, reversals, and conflicts manually.

## Support and Contact

- Website: https://ssamenj.vercel.app/
- Global WhatsApp/contact: +971 56 370 4103
- Uganda Product Manager/contact: +256 774 549 869

## Offer Note

First term free; setup fee applies.
