# ALL_HISTORY_SEARCH.md — Full Git History Audit for SSAMENJ Public Website
Generated: 2026-06-22

---

## 1. COMMAND RESULTS SUMMARY

### Keyword grep across all commits

| Search term | Commits found |
|---|---|
| `SSAMENJ` | 16 commits |
| `public website` | 7 commits |
| `website` | 9 commits + 1 stash |
| `Marketing` | 7 commits |
| `public-site` | 1 commit |
| `PearlMart` | 8 commits |
| `Wideh Cash` | 8 commits |
| `First Term Free` | 3 commits |
| `SSAMENJ Technologies` | 18 commits |
| `Smart Systems. Simple Work` | 8 commits |
| `Report Lab Demo` | 3 commits |
| `F2kWYFQujK4` (Smart Pages video) | 3 commits |
| `jZrp-jOhjwo` (Report Lab video) | 6 commits |

---

## 2. BRANCH MAP

```
main (HEAD: 7c80b0d5)
  └── 26b78c87  Merge pull request #39 (website-only-to-main)
        └── 4b4d4139  (origin/website-only-to-main) Merge SSAMENJ public website updates
              └── previous commits...

origin/feature/nfc-operations-ui (HEAD: bf5d291a)   ← NEVER MERGED TO MAIN
  Most recent public-site commits on this branch:
  bf5d291a  Compact footer: all 9 products, dual WhatsApp contacts, reduced height
  5702536e  Update WhatsApp numbers and add Uganda regional contact
  255acc2d  Fix Demos page and update About page to match Home style
  a532acb1  Wire ContactPage form submissions and info cards to WhatsApp
  7ff69152  Add PearlMart and Wideh Cash under Commerce & Financial Logistics
  97af297e  Full vertical spacing cleanup across all public pages
  b09acfff  Fix header height, development text, and products page layout
  356b1129  Add smooth hash-scroll from header product links to product sections
  ...

stash@{0}: On feature/nfc-operations-ui: website pricing page change  ← NEVER COMMITTED
  File: src/pages/PricingPage.tsx (major rewrite — 661 lines)
```

---

## 3. ALL WEBSITE COMMITS FOUND (chronological)

### On main / merged into main

| Commit | Message | Public files changed |
|---|---|---|
| `a34518b0` | Redesign public website as SSAMENJ Technologies company site | Many |
| `c519eb96` | Fix SSAMENJ branding: real logo, correct title, improved about page | AboutPage |
| `33fcd6f7` | Redesign homepage to premium white SaaS landing-page style | SSAMENJHomePage |
| `50410c5e` | Make SSAMENJ public header global via shared PublicLayout | PublicLayout, all pages |
| `99a3e244` | Clean up public routing and redesign homepage with dark navy hero | SSAMENJHomePage |
| `aba077b5` | Audit and harden public/private routing separation | various |
| `c0dfe8c0` | Polish public header height and hero suite visual | SSAMENJHomePage |
| `356b1129` | Add smooth hash-scroll from header product links to product sections | ProductsPage |
| `b09acfff` | Fix header height, development text, and products page layout | SSAMENJHomePage, ProductsPage |
| `97af297e` | Full vertical spacing cleanup across all public pages | all public |
| `7ff69152` | Add PearlMart and Wideh Cash under Commerce & Financial Logistics | ProductsPage |
| `a532acb1` | Wire ContactPage form submissions and info cards to WhatsApp | ContactPage |
| `255acc2d` | Fix Demos page and update About page to match Home style | DemosPage, AboutPage |
| `5702536e` | Update WhatsApp numbers and add Uganda regional contact | ContactPage, config |
| `4b4d4139` | Merge SSAMENJ public website updates | all public (merge commit) |
| `26b78c87` | Merge pull request #39 (website-only-to-main) | — |
| `4fc12ead` | Add separate SSAMENJ public website app | apps/public-site/** |
| `ca49b8aa` | Restore rich SSAMENJ public website design | apps/public-site/** |
| `3fac9087` | Complete public website restore audit | apps/public-site/**, .restore |
| `7c80b0d5` | Merge FeaturesDemoPage interactive video into DemosPage (HEAD) | apps/public-site DemosPage, FeaturesDemoPage |

### On feature/nfc-operations-ui ONLY (never merged)

| Commit | Message | Public files changed |
|---|---|---|
| `bf5d291a` | Compact footer: all 9 products, dual WhatsApp contacts, reduced height | `src/components/marketing/MarketingFooter.tsx` |
| `5702536e` | Update WhatsApp numbers and add Uganda regional contact | ContactPage, config |
| `255acc2d` | Fix Demos page and update About page to match Home style | DemosPage, AboutPage |
| `a532acb1` | Wire ContactPage form submissions and info cards to WhatsApp | ContactPage |
| `7ff69152` | Add PearlMart and Wideh Cash under Commerce & Financial Logistics | ProductsPage |

### In stash (never committed)

| Stash | Description | File |
|---|---|---|
| `stash@{0}` (`ebf1e880`) | website pricing page change (on feature/nfc-operations-ui) | `src/pages/PricingPage.tsx` |

---

## 4. FILE-BY-FILE RICHEST SOURCE COMPARISON

### MarketingFooter.tsx

| Source | Commit | Notable content |
|---|---|---|
| **nfc branch (RICHEST)** | `bf5d291a` | WhatsApp SVG icon, `/ssamenj-logo.png` image, all 9 products in 2-col sub-grid, dual WhatsApp (Dubai + Uganda PM), "For schools, businesses & institutions" CTA card, compact spacing |
| **current apps/public-site** | `7c80b0d5` | Same 9 products, dual WhatsApp — but uses `PhoneIcon` from Icons.tsx, uses "S" text placeholder instead of real logo image |

**Gap**: WhatsApp SVG icon vs PhoneIcon; real logo image vs "S" text. Minor visual difference.  
**Note**: `/ssamenj-logo.png` would need to exist in `apps/public-site/public/`. Not verified.

---

### SSAMENJHomePage.tsx

| Source | Commit | Notable content |
|---|---|---|
| **feature/nfc branch** | `97af297e` / `b09acfff` | Dark navy hero, 9 suite items including PearlMart + Wideh Cash, HeroSuiteVisual, sections |
| **current apps/public-site** | `3fac9087` | Same — verified correct from previous audit |

**Gap**: None detected. Current is correct.

---

### ProductsPage.tsx

| Source | Commit | Notable content |
|---|---|---|
| **nfc branch (RICHEST)** | `7ff69152` (`src/pages/`) | 9 products, `category` field, "Commerce & Financial Logistics" section divider pill, jump nav in hero, custom inline SVG icons (ReportIcon, PagesIcon, ScaleIcon, MarketIcon, CashIcon, WalletIcon, WristbandIcon, GearIcon), no TestimonialsSection, ctaHref for Report Lab is `/dem` (typo — should be `/demos`) |
| **current apps/public-site** | `3fac9087` | 9 products, no category divider, no jump nav, uses Icons.tsx icons, has TestimonialsSection, ctaHref uses `/demos` |

**Gap**: Missing "Commerce & Financial Logistics" section divider between institutional and commerce products. Missing jump nav in hero. Different icons (cosmetic).  
**Recommendation**: Add category divider + jump nav. Keep Icons.tsx icons (cleaner). Keep TestimonialsSection (it's good).

---

### DemosPage.tsx

| Source | Commit | Design approach |
|---|---|---|
| **nfc branch** | `255acc2d` (`src/pages/`) | Product demo showcase — 6 products (Report Lab, Smart Pages, Legal Smart Pages, School Connect Ops, Kids Wallet, NFC Wristbands) with status badges (Demo Available / In Development / Coming Soon), "Available Now" and "Coming Soon" grids, no video embeds |
| **current apps/public-site** | `7c80b0d5` | Dark navy hero + click-to-play YouTube modal + interactive video playlist (DemoCard switcher for Report Lab + Smart Pages) + product info sections + TestimonialsSection + Why School Connect |

**Assessment**: These are two fundamentally different designs. The nfc branch DemosPage is a product showcase grid. The current apps/public-site DemosPage restored from historical DemoPage is a video-focused marketing page. Both are valid. The current one preserves more marketing copy and video proofs. The nfc version is more product-centric.

**Decision needed**: The nfc branch's product demo cards (showing Legal Smart Pages, School Connect Ops, Kids Wallet, NFC Wristbands in Coming Soon) provide richer discovery for all 6 products. The current page only shows Report Lab and Smart Pages in the video section. Consider whether to:
- (A) Keep current video-focused DemosPage — or
- (B) Merge the nfc "Coming Soon" products section below the current video section

---

### AboutPage.tsx

| Source | Commit | Notable content |
|---|---|---|
| **nfc branch** | `255acc2d` (`src/pages/`) | Uses custom MarketIcon + CashIcon SVGs for PearlMart and Wideh Cash in HeroSuiteVisual and BUILD_CARDS. Hero badge: "About SSAMENJ Technologies". Headline: "We build practical digital systems for real institutions." Additional sections: WorkflowIcon, UserIcon, GlobeIcon, TrendIcon for value pillars |
| **current apps/public-site** | `3fac9087` | HeroSuiteVisual with 8 products, uses SparklesIcon/BookIcon for PearlMart/Wideh Cash (not semantically correct), same sections |

**Gap**: PearlMart icon should be MarketIcon (shopping bag), Wideh Cash icon should be CashIcon (banknote). These icons exist in nfc branch but not in apps/public-site/src/components/marketing/Icons.tsx.

---

### PricingPage.tsx

| Source | Commit | Notable content |
|---|---|---|
| **stash `ebf1e880` (RICHEST)** | stash@{0} | Launch offer banner (green bar at top), `SchoolPlanCard` component (shows price + student range + feature list), `CreditPackCard` component (cleaner than InfoCard), per-plan WhatsApp links (plan-specific message), "Setup & Onboarding" section (Standard Setup UGX 250,000 with waiver conditions), 6-item FAQ, better CTA: "Claim your first term free", GiftIcon/CreditIcon/DocumentIcon/WrenchIcon/SparkleIcon |
| **current apps/public-site** | `ca49b8aa` / `3fac9087` | Old `PricingCard` structure (no price/range), `InfoCard` for credit packs (not as rich), generic WA link for all plans, add-ons listed as InfoCards, 5-item FAQ |

**Gap**: SIGNIFICANT. The stash PricingPage is much richer. Missing:
- Green launch offer banner at top of page
- `SchoolPlanCard` with explicit price + student range + feature bullets
- `CreditPackCard` with icon + credit count display
- Per-plan WhatsApp messages (specific plan names in WA message)
- "Setup & Onboarding" section with Standard Setup UGX 250,000 details + waiver conditions
- Better final CTA: "Claim your first term free and configure Report Lab for your school"
- 6th FAQ item: "Do credits expire? No."
- `GiftIcon` component (for launch offer visual)

---

### ContactPage.tsx

| Source | Commit | Notable content |
|---|---|---|
| **nfc branch** | `a532acb1` / `5702536e` | Same form-based WhatsApp contact with Uganda PM card |
| **current apps/public-site** | Previous sessions | Already correct — has Uganda PM card (+256 774 549 869), Dubai global (+971 56 370 4103) |

**Gap**: None. Current is correct.

---

### MarketingHeader.tsx / PublicLayout.tsx / FloatingWhatsAppButton.tsx

Not changed on nfc branch after being ported to apps/public-site. Current is correct.

---

## 5. WHETHER ANY COMMIT HAS RICHER FILES THAN 4b4d4139

**YES — significantly.**

`4b4d4139` was the merge commit that brought the old `src/pages/` public files into `website-only-to-main`. But `feature/nfc-operations-ui` continued after that point and made substantial improvements that were never merged:

| File | 4b4d4139 state | Richer source | How much richer |
|---|---|---|---|
| MarketingFooter | Older version | `bf5d291a` on nfc | +WhatsApp SVG icon, compact spacing, logo image |
| DemosPage | Basic version | `255acc2d` on nfc | Completely redesigned — product showcase with status cards |
| AboutPage | Less rich | `255acc2d` on nfc | +MarketIcon/CashIcon for PearlMart/Wideh Cash, additional value pillars |
| ProductsPage | Had 7 products | `7ff69152` on nfc | +9 products, category divider, jump nav |
| PricingPage | Old structure | `stash@{0}` | Massively richer (SchoolPlanCard, CreditPackCard, launch banner, setup section) |

---

## 6. WHERE EACH PAGE EXISTED (branch/commit audit)

| Page | 4b4d4139 (website-only-to-main) | feature/nfc-operations-ui | apps/public-site (current) |
|---|---|---|---|
| SSAMENJHomePage | ✅ `src/pages/` | ✅ updated further | ✅ correct |
| ProductsPage | ✅ `src/pages/` | ✅ richer at `7ff69152` | ✅ has 9 products, missing divider |
| DemosPage | ✅ `src/pages/` | ✅ redesigned at `255acc2d` | ✅ video-focused version |
| PricingPage | ✅ `src/pages/` | 🟡 stash only (never committed) | 🔴 OLD structure, missing SchoolPlanCard |
| AboutPage | ✅ `src/pages/` | ✅ richer at `255acc2d` | ✅ mostly correct, wrong icons for PM/WC |
| ContactPage | ✅ `src/pages/` | ✅ updated | ✅ correct |
| DemoPage | ✅ `src/pages/` | ✅ | ✅ redirect to /demos |
| FeaturesDemoPage | ✅ `src/pages/` | ✅ | ✅ redirect to /demos |
| MarketingHeader | ✅ `src/components/` | ✅ | ✅ correct |
| MarketingFooter | ✅ `src/components/` | ✅ richer at `bf5d291a` | 🟡 missing WhatsApp icon + logo image |
| PublicLayout | ✅ `src/components/` | ✅ | ✅ correct |
| FloatingWhatsAppButton | ✅ `src/components/` | ✅ | ✅ correct |
| TestimonialsSection | ✅ `src/components/` | ✅ | ✅ correct |
| MarketingFeatureCard | ✅ `src/components/` | ✅ | ✅ correct |

---

## 7. EXACT SOURCE COMMIT TO USE FOR EACH PAGE

| Page / Component | Recommended source | Commit | Priority |
|---|---|---|---|
| **PricingPage** | stash@{0} (`ebf1e880`) | stash content, applied to `apps/public-site` | 🔴 HIGH — biggest gap |
| **ProductsPage** | nfc `7ff69152` for category divider + jump nav | Merge missing features only | 🟡 MEDIUM |
| **AboutPage** | nfc `255acc2d` for MarketIcon + CashIcon | Add missing icons only | 🟡 MEDIUM |
| **MarketingFooter** | nfc `bf5d291a` for WhatsApp icon + logo image | Swap icon + check logo asset | 🟢 LOW (cosmetic) |
| **DemosPage** | Current `7c80b0d5` is good | Consider adding nfc "coming soon" products block | 🟢 LOW (enhancement) |
| All others | Current state is correct | — | ✅ No action |

---

## 8. WHAT IS STILL MISSING FROM apps/public-site

### Critical (affects user trust and conversion):

1. **PricingPage — SchoolPlanCard structure** (stash)
   - Missing: Explicit price display (UGX 350,000 / 750,000 / 1,500,000 per term)
   - Missing: Student range per plan (Up to 300 / 301-800 / 800+)
   - Missing: Feature bullet list per plan (7 bullets each)
   - Missing: Per-plan WhatsApp messages (e.g. "I want the Starter School plan")
   - Missing: Launch offer banner (green bar: "First Term Free for early onboarding schools")
   - Missing: CreditPackCard component (cleaner credit display)
   - Missing: Setup & Onboarding section (UGX 250,000, waiver conditions)
   - Missing: "Do credits expire? No." FAQ item
   - Missing: GiftIcon for visual launch offer

2. **AboutPage — icon accuracy for PearlMart and Wideh Cash**
   - PearlMart currently shows SparklesIcon (sparkle) — should be MarketIcon (shopping bag)
   - Wideh Cash currently shows BookIcon (book) — should be CashIcon (banknote/wallet)
   - Icons.tsx doesn't have MarketIcon or CashIcon — need to add them

### Standard (UX improvement):

3. **ProductsPage — category section divider**
   - Missing: "Commerce & Financial Logistics" divider pill between institutional (7) and commerce (PearlMart + Wideh Cash) products
   - Missing: Jump navigation in hero (links to each product anchor)

### Minor (cosmetic):

4. **MarketingFooter — icon accuracy**
   - Uses PhoneIcon in "Get in Touch" column; nfc branch uses WhatsApp SVG icon
   - Uses "S" text logo; nfc branch uses `/ssamenj-logo.png` image (asset may not exist in apps/public-site/public/)

---

## 9. FILES EXTRACTED TO .restore-public-design/source/

| File | Source |
|---|---|
| `nfc_MarketingFooter.tsx` | commit `bf5d291a` (nfc branch) |
| `nfc_AboutPage.tsx` | commit `255acc2d` (nfc branch) |
| `nfc_DemosPage.tsx` | commit `255acc2d` (nfc branch) |
| `nfc_ProductsPage.tsx` | commit `7ff69152` (nfc branch) |
| `stash_PricingPage.tsx` | stash@{0} `ebf1e880` |
| `src__pages__DemoPage.tsx` | commit `4b4d4139` (website-only-to-main) |
| `src__pages__FeaturesDemoPage.tsx` | commit `4b4d4139` |
| `src__pages__PricingPage.tsx` | commit `4b4d4139` |
| `src__pages__ContactPage.tsx` | commit `4b4d4139` |
| `src__pages__ProductsPage.tsx` | commit `4b4d4139` |
| `src__pages__AboutPage.tsx` | commit `4b4d4139` |
| `src__pages__SSAMENJHomePage.tsx` | commit `4b4d4139` |

---

## 10. SUMMARY: DO NOT EDIT UNTIL REVIEWED

**Recommended edit order if user approves:**

1. **PricingPage** — Replace with stash version content (adapted to apps/public-site, using Icons.tsx GiftIcon if available, no private imports). This is the highest-impact change.

2. **AboutPage** — Add `MarketIcon` and `CashIcon` to `apps/public-site/src/components/marketing/Icons.tsx`. Swap icons for PearlMart (SparklesIcon → MarketIcon) and Wideh Cash (BookIcon → CashIcon) in AboutPage and SSAMENJHomePage.

3. **ProductsPage** — Add "Commerce & Financial Logistics" section divider between the 7 institutional products and the 2 commerce products. Add jump nav in hero.

4. **MarketingFooter** — Optionally swap PhoneIcon for WhatsApp SVG icon in "Get in Touch". Check if `/ssamenj-logo.png` exists in `apps/public-site/public/`.

5. **DemosPage** — Optional: add a "Coming Soon" product cards section (Legal Smart Pages, School Connect Ops, Kids Wallet, NFC Wristbands) below the video playlist section, matching the nfc branch DemoCard style.

**Do not edit until user confirms which items to proceed with.**
