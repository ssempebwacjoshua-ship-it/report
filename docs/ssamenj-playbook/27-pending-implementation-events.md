# Pending Implementation Events

This file tracks upcoming implementation work, follow-up phases, and known planned changes. Future Codex tasks should check this file before coding follow-up phases or unclear product/module work.

## Next Safe Implementation Steps

- Keep runtime hardening small and verify critical smoke tests after each phase.
- Prefer shared middleware, helpers, and tokens over broad route or UI rewrites.

## Security Follow-Ups

- Define missing `--sc-primary-hover` and `--sc-primary-active` CSS variables.
- Standardize the blue shadow family.
- Add security headers middleware.
- Harden production CORS.
- Add focused rate limiting for auth, uploads, imports, OCR/scan, and public verification/token endpoints.
- Improve safe production error handling.
- Standardize validation error envelope.
- Add security-event logging for rate-limit denials and suspicious public-token probing in a later phase.

## UI/Token Follow-Ups

- Keep documenting exact values when UI measurements are reused across modules.
- Do not normalize print margin differences until report and marksheet print flows are verified together.

## AI/RAG Future Follow-Ups

- Later implement AI/RAG sandboxing and provenance only when AI/RAG runtime features expand.
- Define AI tool allowlists, confirmation rules, egress controls, source provenance, and red-team tests before adding new AI agent abilities.

## Deployment Follow-Ups

- Review production platform/WAF rate limits to complement in-process application rate limits.
- Confirm production environment validation matches deployment provider settings before release.

## Completed Items

- SSAMENJ engineering playbook created.
- Initial runtime security controls drafted for headers, CORS, focused rate limiting, safe production errors, and validation error envelope.
