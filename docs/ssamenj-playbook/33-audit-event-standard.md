# Audit Event Standard

Audit events use `entity.action` names. Sensitive business actions must be traceable.

## Naming Examples

- `student.created`
- `student.updated`
- `marks.import_dry_run`
- `marks.import_committed`
- `report.generated`
- `report.issued`
- `payment.recorded`
- `booking.checked_out`
- `device.manual_override`
- `settings.updated`
- `user.invited`

## Required Audit Fields

- Event name.
- Actor ID and role where available.
- Tenant/school/company/property ID where applicable.
- Target entity type and ID.
- Request ID or correlation ID.
- Timestamp.
- Outcome/status.
- Safe summary of changed fields.
- Reason or confirmation ID for sensitive/destructive actions.

## Rules

- Do not log secrets, tokens, passwords, raw files, or sensitive provider payloads.
- Audit high-risk actions even when they fail validation or permission checks where practical.
- Smart-device actions require audit records for automated and manual override paths.
