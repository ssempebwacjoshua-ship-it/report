# Auth Module

## Purpose

Owns login, password reset/setup, token lifecycle, session validation, creator auth entry points, and permission/role enforcement foundations.

## Owned Public Routes

- None intended as fully public unauthenticated routes beyond auth entry points.
- Public-facing auth and token flows must be listed here as they are migrated into the module.
- Route registration file: `src/server/modules/registerAuthRoutes.ts`

## Owned Frontend Routes/Pages

- Browser: `/report-lab/login`, `/report-lab/forgot-password`, `/report-lab/reset-password`, `/report-lab/account/setup`, `/report-lab/logout`
- Current legacy files:
  - `src/pages/LoginPage.tsx`
  - `src/pages/ForgotPasswordPage.tsx`
  - `src/pages/TokenPasswordPage.tsx`
  - `src/pages/LogoutPage.tsx`

## Owned Server Routes

- API: `/api/auth/*`, `/api/creator/*`
- Current route files still outside the module:
  - `src/server/routes/authRoutes.ts`
  - `src/server/routes/creatorAuthRoutes.ts`

## Owned Services

- Auth token issuance and validation services
- Session validation and password-reset services
- Current legacy files still outside the module:
  - `src/server/services/authService.ts`
  - `src/server/services/authTokenService.ts`
  - `src/server/services/sessionValidationService.ts`
  - `src/server/services/authEmailTemplates.ts`
  - `src/server/services/authScriptSafety.ts`

## Owned Repositories

- None isolated yet.
- Repository ownership must be listed here if auth-specific repositories are introduced during migration.

## Owned Client API Files

- No dedicated auth client module folder yet.
- Auth-related client ownership must be listed here as files move into `src/modules/auth/client`.

## Owned Tests

- Current legacy tests still outside the module:
  - `src/tests/routes/authRoutes.test.ts`
  - `src/tests/services/authTokenService.test.ts`
  - `src/tests/services/authEmailTemplates.test.ts`
  - `src/tests/scripts/authSafetyScripts.test.ts`
  - `src/tests/middleware/requireCreator.test.ts`

## Owned Prisma Models, If Any

- `User`
- `AuthToken`
- Auth-related access fields on `School`, `User`, and creator records

## Owned Permissions

- Foundational auth, session, and role checks used by protected routes
- Explicit permission inventory must be mapped during module migration

## Owned Audit Events

- Auth login/logout/reset/setup audit events
- Exact event names must be listed during route and service migration

## Shared Dependencies

- `src/contexts/AuthContext.tsx`
- `src/components/PermissionGuard.tsx`
- Shared tenant, settings, and session middleware

## External Providers/Integrations

- Email delivery used for password reset and account setup flows
- Creator-auth integrations where applicable

## Background Jobs/Workers

- None isolated yet

## High-Risk Flows

- Login/session issuance
- Password reset/setup
- Permission and role enforcement
- Creator-auth boundaries

## Migration Status

- Skeleton only
- Ownership contract defined
- Runtime files not moved yet

## Known Legacy Files Still Outside The Module

- `src/pages/LoginPage.tsx`
- `src/pages/ForgotPasswordPage.tsx`
- `src/pages/TokenPasswordPage.tsx`
- `src/pages/LogoutPage.tsx`
- `src/contexts/AuthContext.tsx`
- `src/components/PermissionGuard.tsx`
- `src/server/routes/authRoutes.ts`
- `src/server/routes/creatorAuthRoutes.ts`
- `src/server/services/authService.ts`
- `src/server/services/authTokenService.ts`
- `src/server/services/sessionValidationService.ts`
