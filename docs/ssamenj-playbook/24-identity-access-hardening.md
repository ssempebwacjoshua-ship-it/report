# Identity and Access Hardening

Enterprise-sensitive SSAMENJ systems must minimize standing privilege and make privileged actions explicit, time-bound, approved, and auditable.

## Required Controls

- Zero Standing Privileges for production, cloud, database, and admin access.
- Just-In-Time access for sensitive operations.
- Time-bound admin elevation.
- Hardware-bound MFA using FIDO2/WebAuthn for platform owners and privileged operators.
- Separate platform-owner routes from tenant-admin routes.
- No shared admin accounts.
- No permanent production database access for normal developers.
- Privileged access must be logged.
- Break-glass access must be time-bound, audited, and reviewed.

## Dual Authorization

Dual authorization or four-eyes approval is required for:

- Production deployments.
- Database migrations.
- Schema changes.
- Prompt template changes.
- Model/provider changes.
- Billing/payment changes.
- Wallet/payment reconciliation overrides.
- Audit-log access.
- Production data exports.
- Break-glass elevation.
- Destructive bulk operations.

## Privileged Access Workflow

1. User requests a specific privileged action.
2. System records requested scope, tenant, reason, expiry, and risk category.
3. Independent approver reviews the request.
4. Temporary elevation is granted only for the approved scope.
5. Action is executed through audited tooling.
6. Elevation automatically expires.
7. Access and action are reviewed after completion.

## Platform Owner vs Tenant Admin

- Platform-owner routes must remain separate from tenant-admin routes.
- Tenant admins must not inherit platform-owner abilities.
- Platform owners should not bypass tenant audit requirements.
- Platform-owner actions affecting a tenant must record tenant, actor, reason, and approval status.

## Break-Glass Rules

- Break-glass access is for incident response only.
- It must be time-bound.
- It must be audited.
- It must notify an owner/security reviewer.
- It must be reviewed after use.
- It must never become routine production access.

## Required Tests and Reviews

- Privileged route rejects non-privileged users.
- Expired elevation cannot access protected operation.
- Dual-authorization-required action fails without approval.
- Break-glass access creates audit event.
- Shared admin account usage is not allowed by policy.
- Platform-owner route cannot be accessed through tenant-admin route.

