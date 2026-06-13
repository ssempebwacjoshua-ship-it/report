---
name: marksheet-ocr-debug
description: Use when debugging marksheet OCR, Azure OCR status, crop geometry, split zones, raw OCR output, confidence, parsed mark decisions, or extraction debug UI.
---

# Marksheet OCR Debug Skill

Strict rules:
- OCR provider unavailable is only for actual OCR API/function/network/config failure.
- Azure OCR success with no text is not provider unavailable.
- Azure OCR success with low confidence is not provider unavailable.
- Operator validation must remain available when OCR is uncertain.

Correct messages:
- Provider failed: OCR provider unavailable. Please retry or contact support.
- OCR success but no text: No mark detected by OCR. Needs operator entry.
- OCR success but low confidence: Extraction was not confident enough. Needs operator validation.
- OCR success and valid mark: Parsed and accepted.

Likely files:
- src/components/imports/ScanReviewTable.tsx
- src/components/imports/ScanUploadPanel.tsx
- src/server/services/scanExtractionService.ts
- src/server/services/marksheetTableDetection.ts
- src/shared/types/imports.ts

Validation:
- OCR success must not show provider unavailable.
- Low confidence must request validation.
- No text must request operator entry.
- npm run build
