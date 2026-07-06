# API Standard

## Recommended response shapes

### Success

```json
{
  "success": true,
  "data": {},
  "meta": {
    "requestId": "..."
  }
}
```

### Error

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request failed.",
    "details": []
  },
  "meta": {
    "requestId": "..."
  }
}
```

## Status code rules

- `200` for successful reads and updates.
- `201` for creates.
- `204` for successful deletes with no body.
- `400` for validation and request-shape errors.
- `401` for missing or invalid auth/tenant context.
- `403` for permission or cross-tenant failures.
- `404` for missing resources.
- `409` for uniqueness or state conflicts.
- `422` for semantically invalid but well-formed inputs when the API needs that distinction.
- `429` for rate limits.
- `500` for unexpected server failures.

## Validation rules

- Validate all request bodies with `zod` or equivalent.
- Validate query parameters too.
- Return field-level validation details when the client can act on them.
- Do not return raw Prisma, provider, or database errors.

## Pagination rules

- Use `page`, `pageSize`, `total`, and `items`.
- Keep filter and search parameters in the query string.
- Keep pagination metadata stable across lists.

## Request ID rules

- Accept `x-request-id` when the caller provides one.
- Generate one if missing.
- Return it in every error response.
- Log it with server-side requests and audits.

## Current Report Lab behavior to improve on

- Some routes return plain JSON objects.
- Some errors use `{ error: true, code, message, details }`.
- Zod errors currently expose `issues` and `fieldErrors`.
- Future SSAMENJ APIs should standardize this into one envelope and one error vocabulary.

