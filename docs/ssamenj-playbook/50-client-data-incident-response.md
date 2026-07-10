# Client Data Incident Response

Use this standard when data loss, corruption, cross-tenant exposure, bad migration, bad import, unauthorized export, suspicious database access, or secret leakage is suspected.

## Immediate Response

- Stop writes if needed.
- Preserve logs.
- Identify the time window.
- Identify affected tenants.
- Check audit logs.
- Check recent deployments, migrations, imports, exports, admin actions, and background jobs.
- Restrict access to responders who need it.
- Avoid destructive cleanup before evidence is preserved.

## Investigation Steps

- Capture request IDs, actor IDs, tenant IDs, job IDs, migration IDs, import batch IDs, and deployment SHAs.
- Compare expected row counts with current row counts.
- Check tenant filters on affected reads/writes.
- Review recent schema changes and migration SQL.
- Review import dry-run/commit records and row errors.
- Review backup/PITR availability for the incident window.
- Restore to a temporary database if needed.
- Compare data between production and temporary restore.

## Recovery Steps

- Recover safely from a clean source, backup, PITR restore, import history, audit trail, or manual correction plan.
- Prefer targeted recovery over full production overwrite where practical.
- Verify tenant isolation after recovery.
- Verify critical flows after recovery.
- Record all recovery actions and approvals.
- Destroy temporary restore databases safely after the incident.

## Secret Leak Steps

If secrets may have leaked:

- Rotate affected secrets.
- Revoke exposed tokens.
- Review logs and access history.
- Confirm frontend bundles do not contain server secrets.
- Update `.env.example` or docs if naming caused the leak.
- Add regression checks where practical.

## Communication

- Notify owner/stakeholders as appropriate.
- Identify affected tenants and impact.
- Avoid speculation; communicate confirmed facts, mitigation, and next update time.
- Preserve a timeline of decisions and actions.

## Root Cause and Prevention

After containment and recovery:

- Document root cause.
- Document affected data and tenants.
- Document recovery method.
- Add a regression test.
- Add or update a playbook rule.
- Add monitoring or alerting if missing.
- Review whether permission, tenant scope, migration, backup, import, or logging controls failed.

## Incident Closure Checklist

- Writes resumed safely if they were stopped.
- Affected records verified.
- Tenant isolation verified.
- Secrets rotated if needed.
- Stakeholders updated.
- Regression test added.
- Playbook/roadmap follow-up recorded.
- Owner approves closure.
