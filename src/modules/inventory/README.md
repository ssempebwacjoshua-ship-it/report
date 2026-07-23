# Inventory Module

## Scope

Module-owned runtime for school inventory tracking, stock movement logging, reporting-day requirement intake, and simple reconciliation.

## Owned runtime

- `src/modules/inventory/client/inventoryClient.ts`
- `src/modules/inventory/pages/InventoryPage.tsx`
- `src/modules/inventory/pages/InventoryItemsPage.tsx`
- `src/modules/inventory/pages/InventoryReportingPage.tsx`
- `src/modules/inventory/pages/InventoryReconciliationPage.tsx`
- `src/modules/inventory/server/routes/inventoryRoutes.ts`
- `src/modules/inventory/server/services/inventoryService.ts`
- `src/modules/inventory/server/repositories/inventoryRepository.ts`
- `src/modules/inventory/shared/types.ts`

## Frontend routes

- `/inventory`
- `/inventory/items`
- `/inventory/reporting`
- `/inventory/reconciliation`

## Backend routes

- `GET /api/inventory/overview`
- `GET /api/inventory/items`
- `POST /api/inventory/items`
- `PATCH /api/inventory/items/:id`
- `POST /api/inventory/items/:id/archive`
- `POST /api/inventory/movements/receive`
- `POST /api/inventory/movements/issue`
- `POST /api/inventory/movements/adjust`
- `GET /api/inventory/reporting/context`
- `POST /api/inventory/reporting/requirements`
- `POST /api/inventory/reporting/records`
- `GET /api/inventory/reconciliation`

## Permissions

- `inventory.view`
- `inventory.items.manage`
- `inventory.stock.receive`
- `inventory.stock.issue`
- `inventory.reconcile`
- `inventory.reporting.register`

Current admin access stays aligned with the existing `app.admin` frontend pattern and centralized role permission registry.

## Audit events

- `inventory.item_created`
- `inventory.item_updated`
- `inventory.item_archived`
- `inventory.stock_received`
- `inventory.stock_issued`
- `inventory.stock_adjusted`
- `inventory.student_brought_recorded`
- `inventory.reporting_requirement_saved`
- `inventory.student_reporting_record_saved`

## Data ownership

All inventory reads and writes are school-scoped. Student reporting-day records attach to existing school-owned students; NFC wristbands are not treated as stock in this MVP.

## MVP status

Implemented:

- Item create/list/archive workflow
- Stock receive/issue/adjust movement logging
- Reporting-day requirement setup
- Student reporting-day intake with expected vs brought status
- Simple reconciliation issue summary
- Dashboard inventory row

Deferred:

- NFC scan integration
- Supplier/procurement flows
- Parent/teacher submissions
- Asset management
