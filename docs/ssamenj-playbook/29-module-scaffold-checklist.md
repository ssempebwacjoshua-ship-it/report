# Module Scaffold Checklist

Use this checklist before adding a new module or expanding an existing one.

## Module ownership boundary

New modules and migrated modules should target:

```txt
src/modules/<module>/
```

## Required Pieces

- Module README with ownership contract.
- Dashboard card.
- List page.
- Detail page or detail panel.
- Create/edit form.
- Filters/search.
- Empty, loading, and error states.
- Permission denied state.
- API routes.
- Service layer.
- Database model.
- Audit events.
- Tests.
- Mobile behavior.
- Launch checklist.

## Module README ownership contract

Every module README must declare:

- Purpose.
- Owned public routes.
- Owned frontend routes/pages.
- Owned server routes.
- Owned services.
- Owned repositories.
- Owned client API files.
- Owned tests.
- Owned Prisma models, if any.
- Owned permissions.
- Owned audit events.
- Shared dependencies.
- External providers/integrations.
- Background jobs/workers.
- High-risk flows.
- Migration status.
- Known legacy files still outside the module.

If a module owns a public API route, the README must list the public path and the route registration file that mounts it.

## Rules

- Do not ship a page without server-side permission and tenant checks.
- Keep routes thin and put business rules in services/helpers where practical.
- Add safe error handling and stable response envelopes before wiring UI flows.
- Keep demo/seed data fake, realistic, and tenant-separated.
- New feature work must prefer the owning module instead of adding new legacy files under `src/pages`, `src/client`, `src/server/routes`, `src/server/services`, `src/server/repositories`, or `src/tests`.
