# Database Ownership

This document maps the current Prisma models to the module that primarily owns them today. The schema is still shared; this is ownership guidance, not an isolation boundary.

## Shared Core Tenancy

- `School`
- `AcademicYear`
- `Term`
- `SchoolClass`
- `Stream`
- `Student`
- `ClassEnrollment`
- `GuardianContact`
- `AppSetting`

## Reports

- `Subject`
- `SubjectComponent`
- `SubjectMark`
- `MarkImportBatch`
- `MarkImportRow`
- `IssuedReport`
- `PromotionBatch`
- `PromotionAction`

## Release Center

- `IssuedReport`

## Communications

- `CommunicationCampaign`
- `CommunicationContent`
- `CommunicationAudience`
- `CommunicationAudienceSnapshot`
- `CommunicationRecipient`
- `CommunicationDelivery`
- `CommunicationDeliveryAttempt`
- `CommunicationApproval`
- `CommunicationTemplate`
- `CommunicationConsent`
- `CommunicationWebhookEvent`
- `CommunicationUsageRecord`
- `CommunicationChannelSetting`

## NFC / Wallets / Canteen / Gate

- `StudentCredential`
- `StudentWallet`
- `StudentWalletTransaction`
- `SchoolNfcPolicy`
- `StudentFeeHold`
- `StudentGateHold`
- `StudentPassOut`
- `Visitor`
- `VisitorVisit`
- `CanteenReconciliation`
- `StudentAttendanceEvent`
- `DailyAttendance`
- `CampusMovementEvent`
- `ClassroomAttendanceEvent`
- `NfcGateScan`
- `NfcOfflineDevice`
- `ReaderCredentialCaptureSession`
- `ReaderDeviceCommand`
- `NfcOfflineSyncBatch`
- `NfcTagBatch`
- `NfcTag`
- `NfcTapEvent`

## Smart Pages

- `Creator`
- `SchoolSmartPagePlan`
- `SmartPageLedger`
- `SmartPagePaymentRequest`
- `SmartDocument`
- `DocumentVersion`
- `DocumentSourceFile`
- `PublishedDocument`
- `Collection`
- `CollectionRecord`
- `BulkGenerationJob`
- `BulkJobOutput`
- `CreatorPreference`
- `AutomationWorkflow`
- `SearchIndex`
- `Notification`
- `DocumentAnalytics`
- `DocumentCleanerJob`

## Owner / Subscription

- `PlatformSupportSession`
- `SchoolFeatureFlag`
- `ReportLabSubscription`
- `ReportLabInvoice`

## Auth / Audit

- `User`
- `AuthToken`
- `AuditLog`

## Migration Safety Rules

- No destructive migrations without explicit review.
- Do not use `prisma db push` against production.
- Use `prisma migrate deploy` for production schema rollout.
