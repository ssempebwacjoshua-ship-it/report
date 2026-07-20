# Communications Module

## Module Purpose

Owns campaign authoring, approvals, audience selection, delivery orchestration, webhook intake, and school communication safety controls.

## Owned Routes

- Browser: `/report-lab/communications`
- API: `/api/communications/*`, `/api/integrations/whatsapp/webhook`, `/api/support/telegram`

## Owned DB Models

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

## Owned Frontend Pages And Components

- `src/pages/CommunicationsPage.tsx`
- `src/client/communicationsClient.ts`
- communication-specific UI currently embedded in shared app pages/components

## Known Integration Points

- Release Center uses communications for report release messaging.
- Guardian/student data comes from shared tenancy and student records.
- WhatsApp/SMS/email providers are implemented in shared server services today.
- Owner and platform diagnostics may inspect communications activity from platform APIs.
