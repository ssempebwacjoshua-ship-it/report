# UI Source of Truth

This document captures the exact measurements and reusable values currently used in the Report Lab codebase.

## Current design tokens

```ts
colors.primary = "#007FFF" // var(--sc-primary)
colors.primarySoft = "#EFF6FF" // var(--sc-primary-soft)
colors.heroBorder = "rgba(255, 255, 255, 0.18)"
colors.heroShadow = "rgba(15, 23, 42, 0.18)"
colors.primaryShadow = "rgba(0, 127, 255, 0.22)"
colors.primaryShadowStrong = "rgba(0, 127, 255, 0.28)"
colors.borderSlate = "rgb(226 232 240)"
colors.borderBlue = "rgb(191 219 254)"
colors.neutral950 = "#0F172A"
colors.neutral500 = "#64748B"
colors.neutral400 = "#94A3B8"
```

```ts
spacing.appPagePadding = "1rem"
spacing.appPagePaddingMobile = "0.75rem"
spacing.appSectionGap = "0.75rem"
spacing.appSectionGapMobile = "0.625rem"
spacing.cardPadding = "0.8125rem"
spacing.cardPaddingMobile = "0.75rem"
spacing.heroPadding = "1rem"
spacing.tabTrayPadding = "0.25rem"
spacing.tabGap = "0.25rem"
spacing.buttonPadding = "0.45rem 0.85rem"
spacing.badgePadding = "0.25rem 0.625rem"
```

```ts
layout.sidebarWidthDefault = "232px"
layout.sidebarWidthCompact = "220px"
layout.sidebarWidthWide = "240px"
layout.sidebarCollapsedWidth = "72px"
layout.topbarHeight = "2.75rem"
layout.pageContainerWidth = "1540px"
layout.buttonHeight = "2.125rem"
layout.controlHeight = "2.25rem"
```

```ts
radius.card = "0.75rem"
radius.button = "0.625rem"
radius.input = "0.625rem"
radius.tab = "1rem"
radius.pill = "9999px"
```

```ts
typography.fontFamilyBody =
  'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
typography.bodySize = "14px"
typography.pageTitleSize = "1.25rem"
typography.sectionTitleSize = "1rem"
typography.kpiValueSize = "1.25rem"
typography.dashboardHeroTitleSize = "1.125rem"
typography.dashboardHeroTitleSizeSm = "1.25rem"
typography.letterSpacingWide = "0.18em"
typography.letterSpacingUppercase = "0.14em"
```

```ts
shadows.hero = "0 12px 32px rgba(15, 23, 42, 0.18)"
shadows.card = "0 1px 2px rgba(15, 23, 42, 0.04), 0 10px 28px rgba(15, 23, 42, 0.06)"
shadows.hoverCard = "0 2px 4px rgba(15, 23, 42, 0.05), 0 16px 36px rgba(37, 99, 235, 0.12)"
shadows.button = "0 10px 20px rgba(0, 127, 255, 0.22)"
shadows.buttonStrong = "0 14px 26px rgba(0, 127, 255, 0.28)"
shadows.iconBlue = "0 10px 20px rgba(0, 127, 255, 0.22)"
```

## Exact utility classes found

### Dashboard

- Hero section: `overflow-hidden rounded-2xl border p-4 text-white shadow-[0_12px_32px_rgba(15,23,42,0.18)]`
- Hero action button: `btn w-full bg-white text-[color:var(--sc-primary)] shadow-[0_14px_26px_rgba(0,127,255,0.22)] hover:bg-[color:var(--sc-primary-soft)] sm:w-auto`
- Secondary hero button: `btn w-full border border-white/25 bg-white/10 text-white shadow-[0_14px_26px_rgba(0,127,255,0.18)] hover:bg-white/15 sm:w-auto`
- KPI grid: `grid grid-cols-2 gap-3 sm:grid-cols-2 md:gap-4 xl:grid-cols-4`
- Workflow grid: `grid grid-cols-2 gap-2 sm:grid-cols-2 md:grid-cols-5`
- Workflow card: `relative rounded-xl border border-slate-100 bg-white p-3 shadow-sm transition hover:border-blue-200 hover:bg-blue-50/40`
- Workflow step badge: `grid h-7 w-7 place-items-center rounded-lg text-sm font-bold shadow-md`

### Sidebar and topbar

- Sidebar width is controlled by `--sidebar-width`, with `232px` default, `220px` compact, `240px` wide.
- Sidebar row height: `h-10`
- Sidebar row padding: `px-2.5`
- Sidebar collapsed width: `72px`
- Topbar height: `2.75rem`
- Topbar icon buttons: `h-9 w-9`
- Topbar avatar: `h-8 w-8`

### Forms and controls

- Global input class: `padding: 0.5rem 0.75rem`, radius `0.625rem`, border `1.5px solid rgb(203 213 225)`, font size `14px`
- Mobile input override: `font-size: 1rem` under `max-width: 767px`
- `.premium-control` focus ring: `0 0 0 4px color-mix(in srgb, var(--sc-primary) 14%, transparent), 0 1px 2px rgba(15, 23, 42, 0.05)`
- `.btn` min height: `2.125rem`
- `.btn` compact mode min height: `2.25rem`

### Tables, cards, and badges

- `.premium-card` border: `1px solid rgb(226 232 240)`
- `.premium-card` background: `linear-gradient(180deg, #ffffff 0%, #fbfdff 100%)`
- `.premium-card` shadow: `0 1px 2px rgba(15, 23, 42, 0.04), 0 10px 28px rgba(15, 23, 42, 0.06)`
- Badge pill padding in dashboard cards: `px-2 py-0.5`
- Report overview card item bar height: `h-1.5`

### Mobile and layout behavior

- App shell root uses `min-h-screen` and `overflow-x-hidden`
- Page container max width: `max-w-[1540px]`
- Safe area top padding: `padding-top: env(safe-area-inset-top)`
- Safe area bottom padding: `padding-bottom: calc(var(--app-page-padding) + env(safe-area-inset-bottom))`
- Mobile width hardening occurs at `max-width: 767px`
- Horizontal overflow protection is enforced on `html`, `body`, `#root`, and app containers

## Print and export measurements

- Generic print `@page`: `size: A4 portrait; margin: 8mm`
- Later print override: `size: A4; margin: 14mm`
- Marksheet header box: `border: 2px solid #0f172a; padding: 9px 12px 7px`
- Marksheet continuation header: `border: 2px solid #0f172a; border-left: 4px solid #1d4ed8`
- Marksheet table cell height: `26px`
- Marksheet split inner height: `26px`
- Parent report header padding under print override: `26px`

## Exact inconsistencies and gaps

1. Resolved in Phase 2: `--sc-primary-active` is now defined as `#005FCC` in `src/index.css`.
2. Resolved in Phase 2: `--sc-primary-hover` is now defined as `#006FE6` in `src/index.css`.
3. Resolved in Phase 2: primary-blue shadows now use the `rgba(0, 127, 255, ...)` family for dashboard primary elevations.
4. Print margins remain intentionally separate between `8mm` and `14mm`.

## Safe normalization later

- Safe later: yes for repeating button, badge, card, and spacing values.
- Safe later: yes for the blue shadow family after deciding one canonical blue.
- Safe later: no for print margins until the report print flows are verified.
