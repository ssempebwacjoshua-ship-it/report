# Auth Module

## Module Purpose

Owns login, password reset/setup, token lifecycle, session validation, creator auth entry points, and permission/role enforcement foundations.

## Owned Routes

- Browser: `/report-lab/login`, `/report-lab/forgot-password`, `/report-lab/reset-password`, `/report-lab/account/setup`, `/report-lab/logout`
- API: `/api/auth/*`, `/api/creator/*`

## Owned DB Models

- `User`
- `AuthToken`
- auth-related access fields on `School`, `User`, and creator records

## Owned Frontend Pages And Components

- `src/pages/LoginPage.tsx`
- `src/pages/ForgotPasswordPage.tsx`
- `src/pages/TokenPasswordPage.tsx`
- `src/pages/LogoutPage.tsx`
- `src/contexts/AuthContext.tsx`
- `src/components/PermissionGuard.tsx`

## Known Integration Points

- Every protected school route depends on school auth and role checks.
- Owner console and platform admin flows add separate auth/authorization layers.
- Smart Pages creator routes use a parallel creator-auth path.
- Email delivery, support tooling, and public token flows rely on auth services and token safety.
