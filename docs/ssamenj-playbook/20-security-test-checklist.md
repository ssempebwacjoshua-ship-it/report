# Security Test Checklist

Every SSAMENJ project should have these tests before production. Treat this as a release gate, not a nice-to-have list.

## Authentication

- [ ] Unauthenticated user is blocked.
- [ ] Expired token is blocked.
- [ ] Invalid token is blocked.
- [ ] Deactivated user is blocked.
- [ ] Token version mismatch is blocked.
- [ ] Login route has rate limit coverage.
- [ ] Reset route has rate limit coverage where reset exists.

## Authorization

- [ ] Wrong role is blocked.
- [ ] Wrong permission is blocked.
- [ ] Hidden frontend button is not relied on for security.
- [ ] Server route enforces the same or stronger rule than UI navigation.
- [ ] Sensitive action requires confirmation or reason where appropriate.

## Tenant Isolation

- [ ] Tenant A cannot access Tenant B list data.
- [ ] Tenant A cannot access Tenant B detail data.
- [ ] Tenant A cannot update Tenant B data.
- [ ] Tenant A cannot delete Tenant B data.
- [ ] Request body `tenantId` or `schoolId` cannot override token tenant.
- [ ] Query-string tenant hints cannot override token tenant.
- [ ] Missing tenant context in production returns `401`.
- [ ] Cross-tenant mismatch returns `403`.
- [ ] AI/RAG context is tenant-filtered.
- [ ] Cache lookups include tenant ownership.

## Uploads and Imports

- [ ] Zero-byte upload is rejected.
- [ ] Invalid MIME type is rejected.
- [ ] Invalid extension is rejected.
- [ ] Oversized upload is rejected.
- [ ] Multiple files are rejected when route expects one file.
- [ ] Unsafe filename/path traversal is rejected.
- [ ] PDF signature is checked where applicable.
- [ ] XLSX signature is checked where applicable.
- [ ] Image decode/signature is checked where applicable.
- [ ] CSV formula injection is blocked or escaped.
- [ ] Spreadsheet row limit is enforced.
- [ ] Spreadsheet column limit is enforced.
- [ ] Spreadsheet cell length limit is enforced.
- [ ] Dry-run does not commit data.
- [ ] Commit creates audit log.
- [ ] Failed commit records safe failure and does not partially write unexpected rows.

## API and Error Handling

- [ ] Raw Prisma errors are not exposed.
- [ ] Raw provider errors are not exposed.
- [ ] Stack traces are not exposed in production responses.
- [ ] Duplicate conflict returns safe `409`.
- [ ] Validation returns safe `400`.
- [ ] Permission failure returns safe `403`.
- [ ] Missing auth returns safe `401`.
- [ ] Request ID is attached to errors.
- [ ] CORS allowlist is enforced.
- [ ] Security headers are present.
- [ ] Rate-limited routes return safe `429`.

## AI, RAG, and Agents

- [ ] Direct prompt injection cannot bypass permissions.
- [ ] Indirect prompt injection from an uploaded document is treated as data.
- [ ] OCR text cannot become executable instruction.
- [ ] Retrieved document text cannot override system policy.
- [ ] AI output cannot directly write the database.
- [ ] AI tool call requires auth.
- [ ] AI tool call requires permission.
- [ ] AI tool call is tenant-scoped.
- [ ] Sensitive AI action requires confirmation.
- [ ] AI context excludes other tenants.
- [ ] AI context excludes secrets.
- [ ] AI route rate limit works.
- [ ] AI cost/token/page limits work.
- [ ] Poisoned RAG document can be quarantined, removed, and reindexed.
- [ ] AI audit log records prompt version, model, actor, tenant, source documents, tool calls, and guard decisions.
- [ ] Tool output poisoning is blocked by schema and semantic validation.
- [ ] Hidden prompt extraction requests are refused or safely handled.

## Infrastructure and Supply Chain

- [ ] Health endpoint does not leak secrets.
- [ ] Internal health/env endpoint requires internal key and returns only SET/MISSING.
- [ ] Production startup fails on missing required env vars.
- [ ] Frontend bundle does not contain server-only secrets.
- [ ] Dependency changes are reviewed.
- [ ] Lockfile is present and used in builds.
- [ ] Deployment migration path is tested.
- [ ] Backups and restore procedure are documented.

