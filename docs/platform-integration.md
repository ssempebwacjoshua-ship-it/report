# Platform Integration

School Connect Reports Lab can call the SSAMENJ parent platform to check module entitlements and record product usage.

## Environment Variables

- `SSAMENJ_PLATFORM_INTEGRATION_ENABLED=false`
- `SSAMENJ_PLATFORM_URL=http://localhost:4400`
- `SSAMENJ_PLATFORM_SERVICE_TOKEN=`
- `SSAMENJ_PLATFORM_PRODUCT_CODE=school_connect_suite`
- `SSAMENJ_PLATFORM_TIMEOUT_MS=5000`

## Mode

- Disabled mode is the default for local development.
- When disabled, entitlement checks allow requests and usage recording is a no-op.
- When enabled in production, the server fails to start if the platform URL or service token is missing.

## Module Codes

- `report_lab.core`
- `report_lab.marks_import`
- `report_lab.report_generation`
- `report_lab.verification`
- `smart_pages.core`
- `smart_pages.upload`
- `smart_pages.document_generation`
- `smart_pages.templates`
- `nfc.core`
- `nfc.tags`
- `nfc.wallet`
- `nfc.canteen`
- `nfc.attendance`

## Route Mapping

- Dashboard and report context: `report_lab.core`
- Report generation: `report_lab.report_generation`
- Marks import and scan upload: `report_lab.marks_import`
- Smart Pages document list and document metadata: `smart_pages.core`
- Smart Pages upload/extraction: `smart_pages.upload`
- Smart Pages generation/edit/regeneration: `smart_pages.document_generation`
- Smart Pages template management: `smart_pages.templates`
- NFC dashboard, policy, fee holds, and gate overview: `nfc.core`
- NFC tag issuance/allocation: `nfc.tags`
- NFC wallet actions: `nfc.wallet`
- NFC canteen charges and reconciliation: `nfc.canteen`
- NFC attendance and gate taps: `nfc.attendance`

## Usage Events

- Marks import: `marks_import`
- Report generation: `report_generation`
- Smart Pages upload: `smart_pages_upload`
- Smart Pages generation: `smart_pages_generation`
- NFC tag issue: `nfc_tag_issue`
- NFC wallet transaction: `nfc_wallet_transaction`
- NFC canteen payment: `nfc_canteen_payment`
- NFC attendance tap: `nfc_attendance_tap`

## Service Token Safety

- The service token is only read by backend code in `src/server`.
- Do not copy `SSAMENJ_PLATFORM_SERVICE_TOKEN` into any client-side `VITE_` variable.
- No frontend payload should return the token.

## Testing With The Parent Platform

1. Start the parent platform on `http://localhost:4400`.
2. Create the `school_connect_suite` product modules in the parent catalog.
3. Set `SSAMENJ_PLATFORM_INTEGRATION_ENABLED=true` in this app.
4. Add a valid `SSAMENJ_PLATFORM_SERVICE_TOKEN`.
5. Run a protected workflow such as marks import, report generation, Smart Pages upload, or an NFC action.
