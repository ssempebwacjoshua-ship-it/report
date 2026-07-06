# Module Template

Every new SSAMENJ module should follow the same shape unless there is a strong reason not to.

## Suggested folder shape

```txt
src/
  components/
    <module>/
      <shared cards and controls>.tsx
  pages/
    <Module>Page.tsx
  server/
    routes/
      <module>Routes.ts
    services/
      <module>Service.ts
    repositories/
      <module>Repository.ts
  shared/
    types/
      <module>.ts
    utils/
      <module>.ts
```

## Minimum module pieces

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

## Module rules

- Reuse shared shell and card patterns first.
- Do not create one-off UI if the module can use an existing token or primitive.
- Put stateful business logic in services, not in JSX.
- Keep route handlers thin and testable.

