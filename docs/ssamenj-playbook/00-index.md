# SSAMENJ Engineering Playbook

This playbook is the source of truth for all future SSAMENJ projects.

Before implementing anything new, read this index first, then the relevant module page. Use the playbook to decide structure, security, UI measurements, API shape, database rules, and launch criteria before writing code.

## What each file controls

- [`01-product-principles.md`](./01-product-principles.md) - product behavior, UX posture, and operating rules.
- [`02-tech-stack.md`](./02-tech-stack.md) - default stack, code organization, scripts, and language rules.
- [`03-ui-source-of-truth.md`](./03-ui-source-of-truth.md) - exact visual measurements, design tokens, and component sizing.
- [`04-security-baseline.md`](./04-security-baseline.md) - route protection, safe CORS, headers, logging, and upload security.
- [`05-auth-rbac-tenancy.md`](./05-auth-rbac-tenancy.md) - roles, permissions, tenant isolation, and platform-owner boundaries.
- [`06-api-standard.md`](./06-api-standard.md) - response envelopes, status codes, validation, pagination, and request IDs.
- [`07-database-standard.md`](./07-database-standard.md) - Prisma patterns, timestamps, tenant-owned tables, migrations, and audit models.
- [`08-file-upload-import-standard.md`](./08-file-upload-import-standard.md) - upload safety, import flow, previews, dry-runs, and commit rules.
- [`09-testing-standard.md`](./09-testing-standard.md) - unit, API, UI, security, tenant-isolation, upload, and build verification.
- [`10-logging-audit-errors.md`](./10-logging-audit-errors.md) - request logs, audit events, safe errors, and production error behavior.
- [`11-deployment-standard.md`](./11-deployment-standard.md) - Vercel, Railway, PostgreSQL, env vars, migrations, and rollback notes.
- [`12-pwa-mobile-standard.md`](./12-pwa-mobile-standard.md) - mobile-first behavior, PWA shell, offline behavior, and device testing.
- [`13-module-template.md`](./13-module-template.md) - the default shape for new modules and pages.
- [`14-launch-checklist.md`](./14-launch-checklist.md) - pre-launch checks for UI, security, data, and deploy readiness.
- [`15-codex-workflow.md`](./15-codex-workflow.md) - how Codex should work in SSAMENJ repos.
- [`16-security-threat-model.md`](./16-security-threat-model.md) - mandatory human, web, tenant, upload, import, infra, and fraud threat model.
- [`17-ai-security-and-poisoning-baseline.md`](./17-ai-security-and-poisoning-baseline.md) - mandatory AI, RAG, prompt-injection, poisoning, and agent abuse baseline.
- [`18-security-controls-from-day-one.md`](./18-security-controls-from-day-one.md) - reusable backend, AI, and shared controls every project starts with.
- [`19-threat-register.md`](./19-threat-register.md) - reusable threat register with required controls, tests, and implementation status.
- [`20-security-test-checklist.md`](./20-security-test-checklist.md) - production security test checklist for auth, authorization, tenancy, uploads, APIs, AI, and infrastructure.
- [`21-enterprise-security-architecture.md`](./21-enterprise-security-architecture.md) - mandatory enterprise defense-in-depth architecture for human, infrastructure, AI, RAG, and data-destruction threats.
- [`22-ai-agent-sandboxing.md`](./22-ai-agent-sandboxing.md) - least-privilege AI agent execution, tool guards, egress rules, circuit breakers, and tool-call audit requirements.
- [`23-rag-data-provenance.md`](./23-rag-data-provenance.md) - secure RAG ingestion, hashing, metadata, approval status, tenant-separated indexes, poisoning detection, and reindex/removal rules.
- [`24-identity-access-hardening.md`](./24-identity-access-hardening.md) - zero standing privilege, just-in-time access, dual authorization, hardware MFA, and break-glass governance.
- [`25-continuous-red-teaming.md`](./25-continuous-red-teaming.md) - continuous web, dependency, upload, tenant, AI, RAG, agent, canary, and cost-DoS security testing.
- [`26-roadmap-decisions.md`](./26-roadmap-decisions.md) - durable SSAMENJ product and engineering decisions that future Codex tasks must respect.
- [27-pending-implementation-events.md](./27-pending-implementation-events.md) - upcoming implementation phases, follow-ups, and known planned changes.
- [`28-feature-template.md`](./28-feature-template.md) - reusable feature planning template for business goal, scope, routes, UI, tests, risk, and definition of done.
- [`29-module-scaffold-checklist.md`](./29-module-scaffold-checklist.md) - checklist for new modules, pages, routes, services, tests, and launch readiness.
- [`30-api-route-template.md`](./30-api-route-template.md) - required contract for API routes, auth, permissions, validation, rate limits, audit, responses, and tests.
- [`31-database-model-template.md`](./31-database-model-template.md) - database ownership, timestamps, indexes, migrations, audit, demo data, and production safety rules.
- [`32-permission-naming-standard.md`](./32-permission-naming-standard.md) - `module.action` permission naming and examples across SSAMENJ modules.
- [`33-audit-event-standard.md`](./33-audit-event-standard.md) - `entity.action` audit naming, required fields, and sensitive-action audit rules.
- [`34-ui-page-template.md`](./34-ui-page-template.md) - reusable page structure, dashboard checklist, states, mobile behavior, and measurement expectations.
- [`35-form-standard.md`](./35-form-standard.md) - frontend/backend validation, safe errors, submit behavior, mobile layout, and audit rules for forms.
- [`36-import-export-template.md`](./36-import-export-template.md) - safe import/export flow, dry-run, preview, row errors, audit, permissions, and CSV formula protection.
- [`37-env-standard.md`](./37-env-standard.md) - environment variable documentation, `.env.example`, secret/public boundaries, and failure behavior.
- [`38-git-branch-commit-standard.md`](./38-git-branch-commit-standard.md) - branch, commit, staging, dirty-worktree, and commit-prefix rules; read this before staging, committing, or pushing.
- [`39-review-checklist.md`](./39-review-checklist.md) - review questions Codex must answer before handoff or commit.
- [`40-ci-standard.md`](./40-ci-standard.md) - expected CI checks and repo-specific command documentation.
- [`41-demo-data-standard.md`](./41-demo-data-standard.md) - fake realistic demo data, tenant separation, repeatable seeds, and production wipe protection.
- [`42-notification-whatsapp-standard.md`](./42-notification-whatsapp-standard.md) - WhatsApp/messaging safety, approved numbers, public-link privacy, and audit requirements.
- [`43-smart-device-automation-standard.md`](./43-smart-device-automation-standard.md) - smart-device automation, checkout grace periods, manual override, audit, and guest safety.
- [`44-pricing-billing-standard.md`](./44-pricing-billing-standard.md) - centralized pricing, offers, explicit currency, discounts, invoices, payments, and audit rules.
- [`45-definition-of-done.md`](./45-definition-of-done.md) - SSAMENJ completion checklist for UI, mobile, backend, permissions, tenant isolation, tests, build, docs, and envs.
- [`46-database-data-protection-standard.md`](./46-database-data-protection-standard.md) - environment separation, least-privilege DB URLs, private data classification, logging, exports, and tenant data protection.
- [`47-production-migration-safety.md`](./47-production-migration-safety.md) - production migration commands, destructive-change review, expand-contract pattern, and migration checklists.
- [`48-backup-restore-pitr-standard.md`](./48-backup-restore-pitr-standard.md) - scheduled backups, PITR, backup monitoring, restore drills, retention, and restore safety.
- [`49-data-retention-delete-archive-standard.md`](./49-data-retention-delete-archive-standard.md) - soft delete/archive defaults, retention fields, immutable records, ledger/reversal rules, and cascade safety.
- [`50-client-data-incident-response.md`](./50-client-data-incident-response.md) - response steps for data loss, corruption, cross-tenant exposure, bad migrations/imports, and secret leaks.

## Mandatory security rule

Files `16` through `25` are mandatory for all SSAMENJ projects. Before adding a route, upload, import, public token, privileged operation, AI workflow, RAG index, ingestion pipeline, or agent tool, confirm the relevant threat category, required controls, approval model, sandboxing/provenance requirements, and tests from these pages.

Codex must also check `26-roadmap-decisions.md` and `27-pending-implementation-events.md` before implementing future modules, unclear product decisions, or follow-up phases.

## Extended task routing

- New feature/module work: read `28-feature-template.md`, `29-module-scaffold-checklist.md`, `30-api-route-template.md`, `31-database-model-template.md`, `39-review-checklist.md`, and `45-definition-of-done.md`.
- Forms: read `35-form-standard.md`.
- Imports/exports: read `36-import-export-template.md`.
- Env vars: read `37-env-standard.md`.
- Git/commits: read `38-git-branch-commit-standard.md`.
- CI: read `40-ci-standard.md`.
- Demo/seed data: read `41-demo-data-standard.md`.
- WhatsApp/notifications: read `42-notification-whatsapp-standard.md`.
- Smart device or rentals automation: read `43-smart-device-automation-standard.md`.
- Pricing/billing: read `44-pricing-billing-standard.md`.
- Database, migration, seed, import/export, backup/restore, production-data, retention/delete/archive, or data incident work: read `46-database-data-protection-standard.md`, `47-production-migration-safety.md`, `48-backup-restore-pitr-standard.md`, `49-data-retention-delete-archive-standard.md`, and `50-client-data-incident-response.md`.

## How to use it

1. Read this index.
2. Read the module page that matches the work.
3. Keep the diff small and scoped to the requested module.
4. Preserve tenant isolation, auth, permissions, audit logs, upload safety, and safe errors.
5. Reuse shared tokens and components when they already exist.
6. Check the security threat model and AI poisoning baseline for the changed area.
7. Check enterprise sandboxing, data provenance, identity hardening, and red-team requirements for sensitive, AI, RAG, ingestion, or privileged changes.
8. Run the targeted tests for the changed module, then run the build before handing off larger changes.

## Current Report Lab audit coverage

This playbook was extracted from the Report Lab codebase by auditing the dashboard first, then the next main navigation page (`Students`), plus shared layout, styles, server routes, middleware, Prisma schema, upload/import code, tests, and build/deploy files.
