# Auth, RBAC, and Tenancy

## Default roles seen in Report Lab

- `ADMIN_OPERATOR`
- `TEACHER`
- `CASHIER`
- `CANTEEN`
- `SECURITY`
- `GATE_SECURITY`

## Permission-first model

- Access should be granted by permission, not by UI presence.
- Roles map to permission sets in `src/shared/permissions.ts`.
- UI navigation should hide routes the user cannot access, but the server must still enforce the rule.

## Observed role examples

- `ADMIN_OPERATOR` has `*`.
- `GATE_SECURITY` has `nfc.gate.view` and `nfc.gate.scan`.
- `SECURITY` has the same gate permissions.
- `CANTEEN` and `CASHIER` share canteen-related permissions, with `CASHIER` also able to top up wallets and manage fee holds.
- `TEACHER` currently has no default app permissions.

## Tenant isolation rules

- The JWT tenant ID wins.
- Request body tenant ID must never override the token tenant ID.
- Query-string tenant hints are only a dev/test convenience and must never be allowed to override production auth.
- Cross-tenant access returns `403`.
- Missing tenant context in production returns `401`.
- Platform-owner routes must stay separate from school-tenant routes.

## Reusable permission examples

- `app.admin`
- `staff.manage`
- `nfc.gate.view`
- `nfc.gate.scan`
- `nfc.canteen.view`
- `nfc.canteen.charge`
- `nfc.canteen.transactions.view`
- `nfc.canteen.reconciliation.view`
- `nfc.canteen.reconciliation.submit`
- `nfc.wallets.topup`
- `nfc.wallets.pin.manage`
- `nfc.tags.manage`

## Practical rules

- Do not add tenant IDs to the browser as trusted source data.
- Do not trust hidden form fields for authorization.
- Resolve tenant from the signed session first.
- Audit any action that changes ownership, permissions, credentials, or money.

