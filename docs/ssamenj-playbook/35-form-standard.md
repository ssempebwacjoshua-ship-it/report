# Form Standard

Forms must be safe, accessible, mobile-friendly, and backed by server validation.

## Required Behavior

- Frontend validation for user feedback.
- Backend validation for security and correctness.
- Required fields clearly marked.
- Safe errors.
- Disabled submit while saving.
- Success feedback.
- Cancel/back behavior.
- Mobile layout.
- Audit for sensitive edits.

## Rules

- Never rely on frontend validation only.
- Do not expose provider/internal validation details directly to users.
- Preserve user input after recoverable validation errors.
- Sensitive changes require permission checks and audit events.
