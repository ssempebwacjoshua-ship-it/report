# Shared UI Components

This folder is intentionally the future home for SSAMENJ reusable UI primitives.
It is currently empty in the Report Lab codebase, so the reusable UI pieces live
in feature folders and the app shell folders instead.

## Components already reusable today

- [`src/components/layout/AppShell.tsx`](C:/Users/ssemp/school-connect-reports-lab/src/components/layout/AppShell.tsx)
  - Owns the authenticated shell, sidebar persistence, settings gate, and support/install overlays.
  - Reuse in future SSAMENJ apps when you need a protected app shell with a sidebar and topbar.

- [`src/components/layout/Sidebar.tsx`](C:/Users/ssemp/school-connect-reports-lab/src/components/layout/Sidebar.tsx)
  - Renders the product-aware navigation tree and role-filtered nav rows.
  - Reuse for any admin workspace that needs product switching and permission-filtered navigation.

- [`src/components/layout/Topbar.tsx`](C:/Users/ssemp/school-connect-reports-lab/src/components/layout/Topbar.tsx)
  - Renders the product switcher, connectivity badge, profile block, and sign-out action.
  - Reuse as the default topbar pattern for SSAMENJ operator dashboards.

- [`src/components/layout/Icon.tsx`](C:/Users/ssemp/school-connect-reports-lab/src/components/layout/Icon.tsx)
  - Shared inline SVG icon wrapper with the repo icon set.
  - Reuse anywhere consistent 24x24 icon sizing is needed.

- [`src/components/dashboard/StatCard.tsx`](C:/Users/ssemp/school-connect-reports-lab/src/components/dashboard/StatCard.tsx)
  - KPI card pattern with tone variants, icon badge, trend badge, and workflow link.
  - Reuse for dashboard summary tiles across products.

- [`src/components/dashboard/ReportsOverviewCard.tsx`](C:/Users/ssemp/school-connect-reports-lab/src/components/dashboard/ReportsOverviewCard.tsx)
  - Progress-style status card with bars and status rows.
  - Reuse for any workflow overview that needs a compact progress summary.

- [`src/components/dashboard/ActivityCard.tsx`](C:/Users/ssemp/school-connect-reports-lab/src/components/dashboard/ActivityCard.tsx)
  - Activity feed card with relative time formatting.
  - Reuse for audit/activity timelines.

- [`src/components/reports/ReportFilters.tsx`](C:/Users/ssemp/school-connect-reports-lab/src/components/reports/ReportFilters.tsx)
  - Standard report filter bar with class, stream, year, term, exam type, and search controls.
  - Reuse whenever a report list needs the same filter semantics.

- [`src/components/reports/EmptyReportState.tsx`](C:/Users/ssemp/school-connect-reports-lab/src/components/reports/EmptyReportState.tsx)
  - Shared empty state wrapper for report lists.
  - Reuse for any page that needs a plain, safe empty-state message.

- [`src/components/reports/PrintableReport.tsx`](C:/Users/ssemp/school-connect-reports-lab/src/components/reports/PrintableReport.tsx)
  - Print-specific report renderer.
  - Reuse for report download and export workflows.

- [`src/components/students/PassportPhotoAvatar.tsx`](C:/Users/ssemp/school-connect-reports-lab/src/components/students/PassportPhotoAvatar.tsx)
  - Safe passport photo renderer with image loading and fallback initials.
  - Reuse for any student/avatar/photo preview surface.

## Page-level UI that should become reusable later

- Dashboard hero, tabs, and workflow cards in [`src/pages/DashboardPage.tsx`](C:/Users/ssemp/school-connect-reports-lab/src/pages/DashboardPage.tsx)
- Add/edit forms, import panels, and student detail cards in [`src/pages/StudentsPage.tsx`](C:/Users/ssemp/school-connect-reports-lab/src/pages/StudentsPage.tsx)
- Document workspace cards, assistants, and editor panels in [`src/pages/smart-pages/DocumentEditorPage.tsx`](C:/Users/ssemp/school-connect-reports-lab/src/pages/smart-pages/DocumentEditorPage.tsx)
- Lawyer workspace cards and editors in [`src/pages/lawyers/LawyerDashboardPage.tsx`](C:/Users/ssemp/school-connect-reports-lab/src/pages/lawyers/LawyerDashboardPage.tsx)
- Table shells, filter bars, and empty states repeated across report pages

## Reuse rule

If a future SSAMENJ project needs a second instance of a card, filter bar, shell, or empty state, extract it into a shared component before building a page-specific clone.
