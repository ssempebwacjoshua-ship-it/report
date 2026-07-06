# Security Controls From Day One

Every SSAMENJ project must start with these reusable controls. A control can be a middleware, helper, service, shared schema, or documented equivalent, but each one must exist before production.

## Backend Controls

| Control | Purpose | When it must be used | Minimum behavior | Related tests |
| --- | --- | --- | --- | --- |
| `requestId` middleware | Give every request a traceable ID. | All API routes. | Accept `x-request-id` or generate one; attach to response and logs. | Error response includes request ID; logs include request ID. |
| `securityHeaders` middleware | Reduce browser and platform attack surface. | All HTTP responses. | Set safe defaults for content type, frame, referrer, and cross-origin policies. | Headers present in production-like server test. |
| CORS allowlist | Prevent arbitrary browser origins from calling private APIs. | Express server setup. | Allow configured origins only in production; allow localhost in dev. | Unknown origin rejected; configured origin accepted. |
| Rate limiters | Slow brute force, scraping, uploads, and AI cost attacks. | Login, reset, upload, import, public token, AI routes. | Per-IP and where possible per-tenant/user limits with safe 429. | Login/reset/upload/AI route rate limit tests. |
| `requireAuth` | Block unauthenticated access. | Every protected route. | Validate token/session; reject missing/expired/deactivated sessions. | Unauthenticated and expired token blocked. |
| `requirePermission` | Enforce server-side permissions. | Every sensitive action. | Check permission after auth and before business logic. | Wrong role/permission blocked. |
| `resolveTenantContext` | Bind request to the correct school/company. | Every tenant-owned route and service. | Token tenant wins; client tenant cannot override; production missing tenant returns 401. | Body override blocked; cross-tenant access returns 403. |
| `validateRequest` | Validate inputs before route logic. | Every route with params, query, or body. | Zod or equivalent validation; safe 400 on failure. | Invalid payload returns safe 400. |
| `apiResponse` helper | Standardize success and error bodies. | All new APIs. | Stable success/error envelopes and metadata. | Route tests assert response shape. |
| `safeErrors` helper | Prevent internals leaking to clients. | All route error handling. | Hide stack traces, raw Prisma/provider errors, and secrets. | Raw Prisma error not exposed; stack hidden in production. |
| `uploadSafety` helper | Validate uploaded files. | Every upload route. | Size, count, empty-file, MIME, extension, and filename checks. | Empty, invalid MIME, invalid extension, oversized rejected. |
| `fileSignature` helper | Detect spoofed files. | PDF, XLSX, image, and high-risk imports. | Verify magic bytes/signature where feasible. | Spoofed PDF/XLSX rejected. |
| `redactSecrets` helper | Protect logs and AI contexts. | Logging, error reporting, AI prompt/context building. | Redact tokens, secrets, credentials, keys, URLs with credentials. | Secret-like values absent from logs/responses. |
| `auditService` | Record sensitive business actions. | Auth changes, imports, uploads, reports, NFC/wallet/payment actions, AI tools. | Append event with actor, tenant, action, correlation ID, details. | Commit/sensitive action creates audit log. |
| `securityEventService` | Track denied, suspicious, or abusive behavior. | Auth failures, rate limits, cross-tenant attempts, AI guard rejects. | Record event type, actor/tenant if known, route, reason, request ID. | Denied security path records event. |

## AI Controls

| Control | Purpose | When it must be used | Minimum behavior | Related tests |
| --- | --- | --- | --- | --- |
| `aiSafetyPolicy` | Define AI do/don't boundaries. | Every AI feature. | Declare forbidden actions, sensitive data rules, confirmation rules. | Prompt injection cannot override policy. |
| `aiToolGuard` | Protect tool calls from agent abuse. | Every model tool call. | Check auth, permission, tenant, schema, allowlist, confirmation need. | Tool call without permission blocked. |
| `aiContextBuilder` | Build safe, tenant-scoped context. | RAG, assistants, extraction, report helpers. | Tenant filters, source limits, redaction, data/instruction separation. | Context excludes other tenants and secrets. |
| `aiOutputValidator` | Validate model output before use. | Structured output, generated messages, document schemas, tool args. | Schema validation, unsafe content rejection, no raw execution. | Malformed/unsafe output rejected. |
| `aiAuditLog` | Trace AI decisions and tool calls. | Every AI route and worker. | Actor, tenant, prompt version, sources, tool calls, guard result, cost metadata. | AI tool call and source documents logged. |
| `ragIngestionPolicy` | Prevent poisoned knowledge bases. | Any document/vector ingestion. | Provenance, hash, ownership, chunk limits, quarantine/remove/reindex path. | Poisoned document removable and reindexable. |
| `promptTemplates` | Keep prompts controlled and reviewable. | Any system/developer prompt. | Stored/versioned templates; no runtime untrusted prompt changes. | Unauthorized prompt change blocked. |
| `promptVersioning` | Make AI behavior reproducible. | Every AI call. | Log prompt/template version and model version. | AI audit includes prompt version. |

## Shared Controls

| Control | Purpose | When it must be used | Minimum behavior | Related tests |
| --- | --- | --- | --- | --- |
| `roles` | Define human role names. | Auth, UI, route tests. | Centralized role definitions. | Role labels and defaults tested. |
| `permissions` | Define what roles can do. | UI navigation, server route guards, tool guards. | Centralized permission map with server-side enforcement. | Permission route tests. |
| `errorCodes` | Stable client-safe failure vocabulary. | APIs, uploads, AI guards. | No raw provider/Prisma code exposure. | Errors use known codes. |
| `securityEventTypes` | Standard security event names. | Security event logging and alerts. | Names for auth failure, cross-tenant, rate limit, AI reject, upload reject. | Security events use known types. |
| Common validation schemas | Reuse safe validation. | Shared payloads, filters, IDs, pagination, uploads. | Zod schemas or equivalent. | Invalid payload tests for shared schemas. |

