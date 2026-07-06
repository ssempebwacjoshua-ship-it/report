# Permission Naming Standard

Permissions use `module.action`. Roles group permissions, but routes check permissions.

## Naming Rules

- Use lowercase module names.
- Use clear verbs for actions.
- Prefer stable permission names over UI labels.
- Do not check role names in routes when a permission check is available.

## Examples

- `students.read`
- `students.create`
- `students.update`
- `reports.generate`
- `reports.issue`
- `imports.dry_run`
- `imports.commit`
- `settings.update`
- `users.invite`
- `users.disable`
- `audit.read`
- `bookings.read`
- `bookings.create`
- `bookings.check_out`
- `payments.record`
- `payments.refund`
- `maintenance.manage`
- `devices.control`
- `devices.override`
- `documents.issue`
- `branding.update`

## Rule

Frontend visibility is not authorization. Backend routes and tool calls must enforce permissions.
