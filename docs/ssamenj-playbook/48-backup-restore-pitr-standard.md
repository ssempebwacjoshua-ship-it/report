# Backup, Restore, and PITR Standard

Backups are not complete until restore has been tested. Every SSAMENJ production app must have scheduled backups, monitored recovery posture, and a repeatable restore drill.

## Required Backup Posture

- Scheduled backups are required for production.
- PITR is required for production where the provider supports it.
- Backups must be encrypted at rest and in transit where provider-supported.
- Backup access must be restricted to approved operators and break-glass workflows.
- Backup configuration must be documented per repo/provider.

## PITR Concept

Point-in-time recovery uses database write-ahead logs or archive logs to restore to a specific time window before data loss, corruption, bad migration, bad import, or attacker action.

For providers that support PITR:

- Enable PITR for production.
- Record the retention window.
- Monitor whether PITR becomes disabled.
- Know how to restore to a temporary database without overwriting production.

## Retention Policy

Minimum policy, adjusted to provider capability and client contract:

- Daily backups.
- Weekly backups.
- Monthly backups.
- PITR retention window according to provider capability.

Retention should be long enough to detect and recover from delayed corruption or accidental deletion.

## Backup Monitoring

Alert or review when:

- Backup failed.
- PITR disabled.
- Database size suddenly drops.
- Restore drill overdue.
- Backup retention changes.
- Backup access or export is unusual.

## Restore Drills

Restore drills must happen regularly enough to prove backups are usable.

Restore drill checklist:

1. Restore to temporary database.
2. Verify app connection.
3. Verify login.
4. Verify critical records.
5. Verify reports/payments/imports where relevant.
6. Record restore time.
7. Destroy temporary restore safely.

## Restore Safety Rules

- Never restore over production without explicit incident approval.
- Prefer restore to a temporary database, compare, then recover targeted data safely.
- Preserve original corrupted production state until evidence and recovery plan are clear.
- Restrict restored production data access to approved responders.
- Delete temporary restores after verification or recovery.

## Documentation

Each production app must document:

- Provider backup settings.
- PITR setting and retention.
- Restore steps.
- Who can approve restore.
- Last restore drill date.
- Known restore limitations.
