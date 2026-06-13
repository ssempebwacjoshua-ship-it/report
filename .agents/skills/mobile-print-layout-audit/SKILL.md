---
name: mobile-print-layout-audit
description: Use when auditing mobile report preview, print CSS, A4 layout, page overflow, PDF/download sizing, or Samsung/mobile parent report issues.
---

# Mobile Print Layout Audit Skill

Devices to consider:
- Samsung S24
- Samsung A50
- Samsung A20
- mobile widths around 360px, 390px, 412px

Check:
- mobile preview
- browser print preview
- download/PDF output
- A4 scaling
- overflow
- hidden print-only blocks
- duplicate rendered report blocks
- large margins/padding
- bottom section visibility

Parent report rule:
- Parent report must remain one page.
- Do not hide comments/signature/conduct sections.

Marksheet rule:
- Marksheets may print multiple pages, one per student/marksheet.
- Do not apply parent one-page CSS to marksheet bulk print.
