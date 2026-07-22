# Shared Module

## Purpose

Owns cross-cutting platform concerns that are intentionally reused across modules: app shell/layout, shared clients and types, school context, health/runtime middleware, common utilities, and shared tenancy records.

## Owned Public Routes

- Shared public/system paths as applicable
- Current public or system-facing paths:
  - `/health`
  - `/api/health*`
- Route registration files:
  - `src/server/modules/registerPublicRoutes.ts`
  - `src/server/modules/registerPlatformRoutes.ts`

## Owned Frontend Routes/Pages

- Browser: `/report-lab/dashboard`, `/report-lab/settings`, shared redirects/error boundaries
- Current legacy files:
  - `src/pages/DashboardPage.tsx`
  - `src/pages/SettingsPage.tsx`
  - `src/pages/RouteErrorPage.tsx`

## Owned Server Routes

- API: `/health`, `/api/health*`, `/api/dashboard/*`, `/api/settings/*`, `/api/subscription`, shared/internal diagnostic routes
- Current route files still outside the module:
  - `src/server/routes/healthRoutes.ts`
  - `src/server/routes/dashboardRoutes.ts`
  - `src/server/routes/settingsRoutes.ts`
  - `src/server/routes/subscriptionRoutes.ts`

## Owned Services

- Shared dashboard, readiness, configuration, upload, and common utility services
- Current legacy files still outside the module:
  - `src/server/services/dashboardService.ts`
  - `src/server/services/readinessService.ts`
  - `src/server/services/uploadStorageService.ts`

## Owned Repositories

- Shared repositories and tenancy data access not yet isolated

## Owned Client API Files

- Shared clients currently still outside the module:
  - `src/client/apiBase.ts`
  - `src/client/dashboardClient.ts`
  - `src/client/settingsClient.ts`
  - `src/client/runtimeDiagnostics.ts`

## Owned Tests

- Current legacy tests still outside the module:
  - `src/tests/client/apiBase.test.ts`
  - `src/tests/client/dashboardClient.test.ts`
  - `src/tests/middleware/*`
  - `src/tests/security/*`
  - `src/tests/server/*`
  - `src/tests/ui/DashboardPage.test.tsx`
  - `src/tests/ui/SettingsPage.test.tsx`
  - `src/tests/ui/RouteErrorPage.test.tsx`

## Owned Prisma Models, If Any

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

## Owned Permissions

- Shared dashboard/settings/supporting permissions
- Foundational permission utilities used by multiple modules

## Owned Audit Events

- Shared system, dashboard, settings, and diagnostic audit events
- Exact event names must be mapped during module migration

## Shared Dependencies

- This module is the intended home for small, stable, product-neutral shared contracts only
- It must not become a dumping ground for unrelated business logic

## External Providers/Integrations

- Shared platform/runtime diagnostics where applicable

## Background Jobs/Workers

- Shared worker bootstrap remains centralized in `src/server/modules/registerWorkers.ts`

## High-Risk Flows

- Tenant ownership and shared school/student data
- Shared auth and middleware boundaries

## Migration Status

- Skeleton only
- Ownership contract defined
- Runtime files not moved yet

## Known Legacy Files Still Outside The Module

- `src/components/layout/*`
- `src/pages/DashboardPage.tsx`
- `src/pages/SettingsPage.tsx`
- `src/pages/RouteErrorPage.tsx`
- `src/client/*`
- `src/shared/*`
- `src/server/routes/healthRoutes.ts`
- `src/server/routes/dashboardRoutes.ts`
- `src/server/routes/settingsRoutes.ts`
