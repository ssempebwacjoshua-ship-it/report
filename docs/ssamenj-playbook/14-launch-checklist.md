# Launch Checklist

Use this before any SSAMENJ release.

## UI and product

- Dashboard loads.
- Main navigation matches the product scope.
- Empty, loading, error, and permission states exist for the new module.
- No horizontal overflow on mobile.
- Buttons are touch-safe.
- Tables behave safely on phones.
- Print and PDF layouts still work.

## Security

- Auth-protected routes are protected.
- Tenant isolation is verified.
- Roles and permissions are enforced.
- Upload safety is verified.
- Safe errors are returned.
- Audit logs are written for sensitive actions.

## Critical Report Lab smoke flows

- Admin login works.
- Gate Security login redirects to `/nfc/gate`.
- Gate Security can access `GET /api/nfc/gate`.
- Gate Security can scan using `POST /api/nfc/gate/scan`.
- Gate Security cannot access `/api/settings`.
- Student list loads.
- Student passport photo upload uses school auth.
- Smart Pages upload starts extraction.
- Smart Pages public page loads.
- Smart Pages PDF download works.
- Report preview loads.
- Build passes.

## Data and deploy

- Required env vars are present.
- Migrations are applied.
- Seed/demo data is isolated.
- Production URLs are correct.
- PWA icons and manifest are present.
- WhatsApp or contact links work where relevant.

