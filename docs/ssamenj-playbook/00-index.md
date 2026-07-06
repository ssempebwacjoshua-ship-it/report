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

## Mandatory security rule

Files `16` through `25` are mandatory for all SSAMENJ projects. Before adding a route, upload, import, public token, privileged operation, AI workflow, RAG index, ingestion pipeline, or agent tool, confirm the relevant threat category, required controls, approval model, sandboxing/provenance requirements, and tests from these pages.

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
