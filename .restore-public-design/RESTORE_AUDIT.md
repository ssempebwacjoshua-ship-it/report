# Public Site Restore Audit

Baseline commit: `4b4d4139855fe58b4a04106bb9557c451030adf2`

Target: `apps/public-site/src/**`

---

## File Audit Table

| Old path (historical commit) | Current path (apps/public-site) | Status | Notes |
|---|---|---|---|
| `src/components/marketing/FloatingWhatsAppButton.tsx` | `apps/public-site/src/components/marketing/FloatingWhatsAppButton.tsx` | PORTED_WITH_IMPORT_FIXES | Updated to use SSAMENJ branding and import WhatsApp icon from centralized Icons.tsx |
| `src/components/marketing/MarketingFeatureCard.tsx` | `apps/public-site/src/components/marketing/MarketingFeatureCard.tsx` | RESTORED_EXACT | No private deps; ported cleanly |
| `src/components/marketing/MarketingFooter.tsx` | `apps/public-site/src/components/marketing/MarketingFooter.tsx` | PORTED_WITH_IMPORT_FIXES | Updated: all 9 products in 2-col grid, dual WhatsApp contacts (Dubai global + Uganda PM) |
| `src/components/marketing/MarketingHeader.tsx` | `apps/public-site/src/components/marketing/MarketingHeader.tsx` | PORTED_WITH_IMPORT_FIXES | Updated: SSAMENJ branding, auto-hide on scroll, responsive mobile menu |
| `src/components/marketing/PublicLayout.tsx` | `apps/public-site/src/components/marketing/PublicLayout.tsx` | RESTORED_EXACT | HashScroller + paddingTop:48px for fixed header |
| `src/components/marketing/TestimonialsSection.tsx` | `apps/public-site/src/components/marketing/TestimonialsSection.tsx` | RESTORED_EXACT | No private deps; ported cleanly |
| `src/config/contact.ts` | `apps/public-site/src/config/contact.ts` | PORTED_WITH_IMPORT_FIXES | Dubai (+971 56 370 4103) as global default; Uganda PM (+256 774 549 869) as secondary export; old number (256790685650) removed |
| `src/pages/ContactPage.tsx` | `apps/public-site/src/pages/ContactPage.tsx` | PORTED_WITH_IMPORT_FIXES | Private header/nav removed; WhatsApp form submission wired to Dubai number; Uganda PM sidebar card added; no mailto/private routes |
| `src/pages/DemoPage.tsx` | `apps/public-site/src/pages/DemoPage.tsx` | PORTED_WITH_IMPORT_FIXES | Redirects to /demos (content lives at /demos); acceptable per restore spec |
| `src/pages/FeaturesDemoPage.tsx` | `apps/public-site/src/pages/FeaturesDemoPage.tsx` | PORTED_WITH_IMPORT_FIXES | **Restored** interactive YouTube video player (Report Lab: jZrp-jOhjwo, Smart Pages: F2kWYFQujK4); DemoCard switcher; adapted for PublicLayout (no internal header); uses Link not navigate |
| `src/pages/PricingPage.tsx` | `apps/public-site/src/pages/PricingPage.tsx` | PORTED_WITH_IMPORT_FIXES | Private header/nav removed; UGX pricing (Starter 350K, Standard 750K, Pro 1.5M, Enterprise custom); First Term Free launch offer; Smart Pages credit packs (Trial free/20cr, Starter 100cr/50K, Standard 500cr/225K, School Pro 1000cr/400K); setup fee UGX 250K; no private routes |

---

## Additional Files (not in historical commit — ported from feature branch)

| File | Current path | Status | Notes |
|---|---|---|---|
| SSAMENJHomePage (new) | `apps/public-site/src/pages/SSAMENJHomePage.tsx` | PORTED_WITH_IMPORT_FIXES | **Fixed:** SUITE_ITEMS updated from 7→9 items; PearlMart (BookIcon, demo) and Wideh Cash (SparklesIcon, demo) added |
| AboutPage (new) | `apps/public-site/src/pages/AboutPage.tsx` | PORTED_WITH_IMPORT_FIXES | **Fully rebuilt** as rich dark-hero version: dark navy gradient hero, glass HeroSuiteVisual (8 products), "Who We Are" / "Our Product Family" / "Why We Build" sections, BUILD_CARDS grid (all 9 products), Final CTA |
| DemosPage (new) | `apps/public-site/src/pages/DemosPage.tsx` | RESTORED_EXACT | Both Report Lab and Smart Pages demo sections with feature cards; video thumbnail with WhatsApp link; /demos#report-lab and /demos#smart-pages anchors |
| ProductsPage (new) | `apps/public-site/src/pages/ProductsPage.tsx` | PORTED_WITH_IMPORT_FIXES | All 9 products present (Report Lab, Smart Pages, School Connect, Legal Smart Pages, Kids Wallet, NFC Bands, PearlMart, Wideh Cash, Custom Digital); **Fixed:** id anchors added to each product card wrapper for hash-scroll links |
| Icons.tsx (new) | `apps/public-site/src/components/marketing/Icons.tsx` | RESTORED_EXACT | Centralized icon registry; all icons used across pages exported |
| App.tsx (new) | `apps/public-site/src/App.tsx` | RESTORED_EXACT | Clean public-only routes; no /login, /dashboard, /app references |

---

## Security Scan Result

Command run:
```
Select-String -Path apps/public-site/src/**/*.tsx,apps/public-site/src/**/*.ts -Pattern "useAuth|AuthContext|/dashboard|/login|/app|256790685650" -SimpleMatch
```

**Result: No matches. All clear.**

---

## WhatsApp Numbers

| Purpose | Number | Source |
|---|---|---|
| Global / Default | +971 56 370 4103 | `contact.ts` → `WHATSAPP_NUMBER = "971563704103"` |
| Uganda Product Manager | +256 774 549 869 | `contact.ts` → `WHATSAPP_UG_NUMBER = "256774549869"` |
| Old number (removed) | ~~+256 790 685 650~~ | Removed from all public-site files |

---

## Build Results

| Build | Result |
|---|---|
| `apps/public-site` (`npm run build`) | ✅ Pass — 714ms, 40 modules |
| Root project (`npm run build`) | ✅ Pass — 2.63s + server bundle |

---

## Files NOT restored and why

| File | Reason |
|---|---|
| `src/pages/DashboardPage.tsx` | Private system page — NOT_APPLICABLE_PRIVATE_DEPENDENCY |
| `src/pages/LoginPage.tsx` | Private system page — NOT_APPLICABLE_PRIVATE_DEPENDENCY |
| `src/pages/LogoutPage.tsx` | Private system page — NOT_APPLICABLE_PRIVATE_DEPENDENCY |
| `src/pages/MarksheetsPage.tsx` | Private system page — NOT_APPLICABLE_PRIVATE_DEPENDENCY |
| `src/pages/MarksImportPage.tsx` | Private system page — NOT_APPLICABLE_PRIVATE_DEPENDENCY |
| `src/pages/ParentReportPage.tsx` | Private system page — NOT_APPLICABLE_PRIVATE_DEPENDENCY |
| `src/pages/ReportsPage.tsx` | Private system page — NOT_APPLICABLE_PRIVATE_DEPENDENCY |
| `src/pages/StudentsPage.tsx` | Private system page — NOT_APPLICABLE_PRIVATE_DEPENDENCY |
| `src/pages/SettingsPage.tsx` | Private system page — NOT_APPLICABLE_PRIVATE_DEPENDENCY |
| `src/pages/PromotionWorkspacePage.tsx` | Private system page — NOT_APPLICABLE_PRIVATE_DEPENDENCY |
| `src/pages/ReleaseCenterPage.tsx` | Private system page — NOT_APPLICABLE_PRIVATE_DEPENDENCY |
| `src/pages/RouteErrorPage.tsx` | Private system page — NOT_APPLICABLE_PRIVATE_DEPENDENCY |
| `src/pages/VerifyPage.tsx` | Private system page — NOT_APPLICABLE_PRIVATE_DEPENDENCY |
| `src/pages/lawyers/**` | Private system pages — NOT_APPLICABLE_PRIVATE_DEPENDENCY |
| `src/pages/owner/**` | Private system pages — NOT_APPLICABLE_PRIVATE_DEPENDENCY |
| `src/pages/smart-pages/**` | Private system pages — NOT_APPLICABLE_PRIVATE_DEPENDENCY |
