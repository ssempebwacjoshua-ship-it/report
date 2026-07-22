# Communications Module

## Purpose

Owns campaign authoring, approvals, audience selection, delivery orchestration, webhook intake, and school communication safety controls.

## Owned Public Routes

- Public webhook/intake endpoints as applicable
- Current public paths:
  - `/api/integrations/whatsapp/webhook`
- Route registration file: `src/server/modules/registerCommunicationRoutes.ts`

## Owned Frontend Routes/Pages

- Browser: `/report-lab/communications`
- Current legacy files:
  - `src/pages/CommunicationsPage.tsx`

## Owned Server Routes

- API: `/api/communications/*`, `/api/integrations/whatsapp/webhook`, `/api/support/telegram`
- Current route files still outside the module:
  - `src/server/routes/communicationRoutes.ts`
  - `src/server/routes/smsIntegrationRoutes.ts`
  - `src/server/routes/whatsappIntegrationRoutes.ts`
  - `src/server/routes/supportRoutes.ts`

## Owned Services

- Communication campaign orchestration
- Audience resolution
- Delivery provider coordination
- Webhook processing
- Current legacy files still outside the module:
  - `src/server/services/communicationEngine.ts`
  - `src/server/services/communicationAudienceService.ts`
  - `src/server/services/communicationProviders.ts`
  - `src/server/services/smsWebhookService.ts`
  - `src/server/services/telegramService.ts`
  - `src/server/services/emailService.ts`
  - `src/server/services/outreachBatchService.ts`
  - `src/server/services/outreachEmailTemplates.ts`

## Owned Repositories

- None isolated yet

## Owned Client API Files

- Current legacy files:
  - `src/client/communicationsClient.ts`

## Owned Tests

- Current legacy tests still outside the module:
  - `src/tests/client/communicationsClient.test.ts`
  - `src/tests/routes/communicationOutboundRoutes.test.ts`
  - `src/tests/routes/smsIntegrationRoutes.test.ts`
  - `src/tests/services/communicationAudienceService.test.ts`
  - `src/tests/services/emailService.test.ts`
  - `src/tests/services/outreachBatchService.test.ts`
  - `src/tests/shared/communications.test.ts`
  - `src/tests/shared/smsProvider.test.ts`
  - `src/tests/shared/whatsappProvider.test.ts`
  - `src/tests/ui/CommunicationsPage.test.tsx`

## Owned Prisma Models, If Any

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

## Owned Permissions

- Communications send/approve/view permissions
- Exact permission names must be mapped during module migration

## Owned Audit Events

- Campaign create/update/approve/send and delivery audit events
- Exact event names must be mapped during module migration

## Shared Dependencies

- Student and guardian data from shared tenancy/student ownership
- Report release messaging contracts with release-center/reports

## External Providers/Integrations

- WhatsApp
- SMS
- Email
- Telegram support tooling

## Background Jobs/Workers

- Delivery queues and retry/batch flows where present
- Current worker startup remains centralized in `src/server/modules/registerWorkers.ts`

## High-Risk Flows

- Outbound communications delivery
- Consent and approval enforcement
- Public webhook validation

## Migration Status

- Skeleton only
- Ownership contract defined
- Runtime files not moved yet

## Known Legacy Files Still Outside The Module

- `src/pages/CommunicationsPage.tsx`
- `src/client/communicationsClient.ts`
- `src/server/routes/communicationRoutes.ts`
- `src/server/routes/smsIntegrationRoutes.ts`
- `src/server/routes/whatsappIntegrationRoutes.ts`
- `src/server/routes/supportRoutes.ts`
- `src/server/services/communicationEngine.ts`
- `src/server/services/communicationAudienceService.ts`
- `src/server/services/communicationProviders.ts`
