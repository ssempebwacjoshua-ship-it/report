# AI Agent Sandboxing

AI agents are untrusted operators until every action passes backend authorization, tenant scoping, validation, confirmation, and audit logging. The model can suggest; the platform decides.

## Default Agent Posture

- AI tools must run with least privilege.
- AI agents must be read-only by default.
- Sensitive or destructive actions require human confirmation.
- External tool/API execution should be isolated.
- Risky tools should run in ephemeral execution environments.
- Default-deny network egress should be used where possible.
- Outbound endpoints must be allowlisted.
- AI tools must not access arbitrary URLs, files, shell commands, or database writes.
- AI tools must not receive broad database, filesystem, network, or admin access.

## Tool Permission Model

| Tool class | Default access | Required guard |
| --- | --- | --- |
| Read-only tenant query | Allowed only after auth, permission, tenant filter, and request validation. | `aiToolGuard` with tenant scope and source logging. |
| Report generation or release | Blocked by default; requires explicit permission and confirmation. | Permission check, dry-run/preview, confirmation ID, audit event. |
| Upload/import commit | Blocked by default; dry-run first. | File/import safety, row validation, human confirm, audit event. |
| Wallet/payment/billing action | Blocked by default. | Permission, dual approval where high risk, idempotency, audit. |
| External API call | Blocked unless allowlisted. | Endpoint allowlist, parameter schema, timeout, response validation. |
| Shell/filesystem/database write | Not allowed for product AI agents. | Requires separate privileged workflow, human approval, ephemeral sandbox, no standing token. |

## Semantic Boundaries

- Tool names, schemas, metadata, and responses must not be blindly trusted.
- Tool calls must use hardcoded allowlists and typed parameter schemas.
- Tool parameter values must be validated before execution.
- Tool outputs must be validated before being passed back to the model.
- Tool output is data, never instruction.
- A model cannot create a new tool, choose arbitrary endpoints, or expand its own permissions.

## Sandboxed Execution

- Use ephemeral runtime environments for risky transformations, parsing, and third-party tool interactions.
- Revoke runtime credentials after the task finishes.
- Mount only the minimum files required for the task.
- Use short timeouts and resource caps.
- Prefer private networking with default-deny egress.
- Allowlist approved outbound endpoints only.
- Do not expose production database credentials to the sandbox.

## Circuit Breakers

Automatically halt the agent, revoke its token, and log a security event when any of these occur:

- Repeated denied tool calls.
- Attempts to access another tenant.
- Attempts to call unapproved URLs.
- Attempts to invoke shell/filesystem/database writes.
- Abnormal cost/token/page growth.
- Tool-call loops.
- Unexpected destructive action requests.
- Output validator repeatedly rejects model output.

## AI Tool Audit Log

Every AI tool call must record:

- Actor ID and role.
- Tenant/school/company ID.
- Tool name and version.
- Prompt/template version.
- Source document IDs where relevant.
- Parameter summary with secrets redacted.
- Result status.
- Guard decision.
- Confirmation ID if required.
- Timestamp.
- Request ID or correlation ID.

## Required Tests

- Read-only tool requires auth, permission, and tenant filter.
- Sensitive tool fails without confirmation.
- Destructive tool is blocked by default.
- Arbitrary URL, file path, shell command, and database write are rejected.
- Tool output poisoning cannot trigger a second tool call.
- Suspicious behavior revokes agent token and records a security event.

