# Middleware Rules

- Middleware must be small, composable, and security-focused.
- Do not bypass existing auth, permission, tenant, upload, or safe-error middleware.
- New middleware should include targeted tests.
- Production behavior must fail safely.
