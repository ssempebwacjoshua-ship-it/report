# Roadmap Decisions

This file records durable SSAMENJ product and engineering decisions that future Codex tasks must respect before implementation.

Temporary ideas should not be added here unless they affect future implementation, architecture, safety, product scope, or reusable project direction.

## UI/Brand Decisions

- Use the measured SSAMENJ/School Connect design system in `03-ui-source-of-truth.md` before inventing new visual values.
- Preserve exact reusable tokens for colors, spacing, typography, radius, shadows, layout, and print/export measurements.

## Security Decisions

- Security is part of every task, not a final hardening phase.
- Never weaken auth, permissions, tenant isolation, upload safety, safe errors, audit logs, AI/RAG safety, or production secret handling.
- New routes must define auth, permission, tenant scope, validation, audit need, rate-limit need, safe error behavior, and tests before implementation.

## AI/RAG Decisions

- AI never decides authorization and cannot bypass backend permissions.
- Uploaded files, OCR text, retrieved documents, tool results, and model outputs are untrusted data.
- RAG content must have provenance, tenant separation, removal/reindex behavior, and poisoning tests before production use.
- Runtime AI/RAG sandboxing should be implemented only when AI/RAG runtime features expand.

## Deployment Decisions

- Production must validate required environment variables before startup.
- Production CORS must use an explicit allowlist and must not silently allow all browser origins.
- Production error handling must hide stack traces and raw provider/internal errors.

## Product/Module Decisions

- Keep completed flows protected: Admin login, Gate Security login and scan, Student list, passport photo upload, Smart Pages extraction/public/PDF, report preview, and build.
- Business logic changes must stay scoped to the requested module.

## Decisions Awaiting Confirmation

- Which future modules require dual authorization or just-in-time privileged access.
- Which AI/RAG features will need sandboxed runtime execution, egress allowlists, and source-provenance storage.
- Whether public token endpoints should add audit/security-event recording beyond rate limiting.
