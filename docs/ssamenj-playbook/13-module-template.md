# Module Template

Every new SSAMENJ module should follow the same shape unless there is a strong reason not to.

## Target architecture

The ownership boundary for new and migrated work is:

```txt
src/modules/<module>/
```

Legacy structure may still exist during migration, but it is no longer the target architecture:

- `src/pages`
- `src/components`
- `src/client`
- `src/server/routes`
- `src/server/services`
- `src/server/repositories`
- `src/tests`

New module work must prefer `src/modules/<module>` unless the task explicitly says it is maintaining legacy structure.

## Suggested folder shape

```txt
src/modules/<module>/
  README.md
  client/
  components/
  pages/
  server/
    routes/
    services/
    repositories/
    validators/
    jobs/
  shared/
    types/
    constants/
    utils/
  tests/
    routes/
    services/
    client/
    ui/
    security/
```

## Minimum module pieces

- Module README with ownership contract
- Dashboard card or summary entry point
- List page
- Detail page or detail panel
- Create/edit form
- Filters and search
- Empty/loading/error states
- Permission states
- API routes
- Service layer
- Database model
- Audit events
- Tests
- Mobile behavior

## Module README ownership contract

Every module README must declare:

- Purpose
- Owned public routes
- Owned frontend routes/pages
- Owned server routes
- Owned services
- Owned repositories
- Owned client API files
- Owned tests
- Owned Prisma models, if any
- Owned permissions
- Owned audit events
- Shared dependencies
- External providers/integrations
- Background jobs/workers
- High-risk flows
- Migration status
- Known legacy files still outside the module

If a module owns a public API route, the README must list the public path and the route registration file that mounts it.

## Module rules

- Reuse shared shell and card patterns first.
- Do not create one-off UI if the module can use an existing token or primitive.
- Put stateful business logic in services, not in JSX.
- Keep route handlers thin and testable.
- New features must be created inside the owning module.
- If at least two modules truly need the same logic, move it to `src/modules/shared` with tests.
- Keep shared code small, stable, and product-neutral. Do not turn `src/modules/shared` into a dumping ground.
