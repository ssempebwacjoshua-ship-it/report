# Continuous Red Teaming

Security testing should run continuously enough to catch regressions before production, while high-risk changes still receive human review.

## Automated Checks

- Web security checks.
- Dependency vulnerability checks.
- Secret scanning.
- Upload/import fuzzing.
- Tenant-isolation tests.
- Permission and role-route tests.
- API safe-error tests.
- CORS and security-header checks.
- Public token abuse checks.

## AI and RAG Red-Team Tests

- Direct prompt injection tests.
- Indirect prompt injection tests using malicious PDFs, emails, spreadsheets, OCR text, webpages, and images.
- RAG poisoning tests.
- Embedding/vector poisoning tests.
- AI memory poisoning tests.
- System prompt poisoning tests.
- Tool/API output poisoning tests.
- AI tool abuse tests.
- Canary data leak tests.
- Cost-bombing/model DoS tests.
- Hidden prompt extraction tests.
- Cross-tenant AI context leakage tests.

## CI and Merge Gates

Run before merge where practical:

- Critical smoke tests.
- Tenant-isolation tests for touched modules.
- Upload/import rejection tests for touched upload paths.
- Dependency and secret scans.
- AI guard tests for touched AI tools.
- Build verification.

## Manual Review Required

Manual security review is required for:

- Auth or permission changes.
- Tenant-resolution changes.
- Database migrations and schema changes.
- Public token or verification flows.
- Upload/import pipeline changes.
- Billing/payment/wallet changes.
- Prompt template changes.
- Model/provider changes.
- RAG ingestion/retrieval changes.
- AI tool additions or permission changes.
- Production deployment pipeline changes.

## Canary Data

- Add synthetic canary records to non-production AI/security tests.
- Canary data must be unique enough to detect leakage.
- Canary data must never be real personal data.
- Tests should fail when canary records appear in unauthorized tenant, export, model output, or logs.

## Regression Rule

Every new route and AI tool needs a matching security regression test. If a high-risk control is intentionally deferred, the launch checklist must show the risk, owner, mitigation, and due date.

