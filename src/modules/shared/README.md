# Shared Module

## Module Purpose

Owns cross-cutting platform concerns that are intentionally reused across modules: app shell/layout, shared clients and types, school context, health/runtime middleware, common utilities, and shared tenancy records.

## Owned Routes

- Browser: `/report-lab/dashboard`, `/report-lab/settings`, shared redirects/error boundaries
- API: `/health`, `/api/health*`, `/api/dashboard/*`, `/api/settings/*`, `/api/subscription`, shared/internal diagnostic routes

## Owned DB Models

- `School`
- `AcademicYear`
- `Term`
- `SchoolClass`
- `Stream`
- `Student`
- `ClassEnrollment`
- `GuardianContact`
- `AuditLog`
- `AppSetting`

## Owned Frontend Pages And Components

- `src/components/layout/*`
- `src/pages/DashboardPage.tsx`
- `src/pages/SettingsPage.tsx`
- `src/pages/RouteErrorPage.tsx`
- shared clients under `src/client/*`
- shared types/utilities under `src/shared/*`

## Known Integration Points

- Every business module depends on school, student, class, and permission context from shared code.
- Server bootstrap, middleware, and route registration are still centralized outside module folders.
- Shared layout/navigation currently surfaces links across reports, communications, NFC, smart pages, and owner views.
- Future module moves should leave shared tenancy and utility code here unless a clearer owner emerges.
