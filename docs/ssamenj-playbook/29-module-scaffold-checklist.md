# Module Scaffold Checklist

Use this checklist before adding a new module or expanding an existing one.

## Required Pieces

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

## Rules

- Do not ship a page without server-side permission and tenant checks.
- Keep routes thin and put business rules in services/helpers where practical.
- Add safe error handling and stable response envelopes before wiring UI flows.
- Keep demo/seed data fake, realistic, and tenant-separated.
