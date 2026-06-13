---
name: dashboard-live-wiring
description: Use when fixing DashboardPage, dashboard cards, workflow buttons, live stats, dashboard API routes/services, or removing fake/static dashboard data.
---

# Dashboard Live Wiring Skill

Strict rules:
- No hardcoded preview dashboard numbers.
- No fake production data.
- Every visible dashboard button/link/card action must be wired.
- No href="#".
- No empty onClick.
- If unavailable, show an honest disabled state with a reason.

Check actions:
- Generate Reports
- Import
- Overview tab
- Marks Review tab
- Report Approval tab
- Release Center tab
- KPI cards
- workflow cards
- Continue reports
- View all uploads
- sidebar buttons
- user/logout controls

Likely files:
- src/pages/DashboardPage.tsx
- src/client/dashboardClient.ts
- src/server/routes/dashboardRoutes.ts
- src/server/services/dashboardService.ts
- src/shared/types/dashboard.ts
- src/components/dashboard/*
- src/tests/ui/DashboardPage.test.tsx

Validation:
- npm test -- DashboardPage
- npm run build
