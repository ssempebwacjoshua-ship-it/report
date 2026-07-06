# Route Rules

- Routes should stay thin.
- Business rules should go into services or helpers where practical.
- Every protected route must check auth and permission.
- Every tenant resource must be scoped by token-derived `schoolId`, `tenantId`, or `companyId`.
- Upload/import routes must follow `docs/ssamenj-playbook/08-file-upload-import-standard.md`.
- New routes need tests for unauthenticated, unauthorized, validation, tenant isolation, and success paths where practical.
