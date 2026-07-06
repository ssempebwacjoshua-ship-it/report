# Environment Variable Standard

Every environment variable must be documented before a feature is complete.

## Required Documentation

- Name.
- Purpose.
- Required in dev.
- Required in production.
- Example value.
- Secret or public.
- Owner service.
- Failure behavior if missing.

## Rules

- No feature is complete until `.env.example` is updated where needed.
- Public frontend variables must not contain secrets.
- Production startup should fail safely when required server secrets are missing.
- Health/debug endpoints must never reveal secret values.
