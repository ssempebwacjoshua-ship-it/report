-- Communication Transmission Engine Phase 1
-- Additive-only foundation: enums, tables, indexes, and foreign keys.

CREATE TYPE "CommunicationType" AS ENUM ('REPORT_RELEASE', 'CIRCULAR', 'ANNOUNCEMENT', 'EVENT', 'VIDEO_MESSAGE', 'EMERGENCY_ALERT', 'FEE_NOTICE', 'ATTENDANCE_ALERT', 'RECEIPT', 'CUSTOM');
CREATE TYPE "CommunicationChannel" AS ENUM ('WHATSAPP', 'SMS', 'PARENT_PORTAL', 'EMAIL', 'PRINT');
CREATE TYPE "CommunicationCampaignStatus" AS ENUM ('DRAFT', 'VALIDATING', 'VALIDATION_FAILED', 'READY_FOR_APPROVAL', 'APPROVAL_PENDING', 'APPROVED', 'SCHEDULED', 'QUEUED', 'SENDING', 'PARTIALLY_DELIVERED', 'DELIVERED', 'FAILED', 'PAUSED', 'CANCELLED');
CREATE TYPE "CommunicationRecipientStatus" AS ENUM ('PENDING', 'READY', 'WARNING', 'BLOCKED', 'EXCLUDED', 'QUEUED', 'SENDING', 'DELIVERED', 'PARTIALLY_DELIVERED', 'FAILED', 'ACKNOWLEDGED');
CREATE TYPE "CommunicationDeliveryStatus" AS ENUM ('PENDING', 'QUEUED', 'SUBMITTING', 'SUBMITTED', 'ACCEPTED', 'DELIVERED', 'READ', 'FAILED', 'RETRY_SCHEDULED', 'CANCELLED', 'SKIPPED');
CREATE TYPE "CommunicationAttemptStatus" AS ENUM ('STARTED', 'PROVIDER_ACCEPTED', 'PROVIDER_REJECTED', 'DELIVERED', 'READ', 'FAILED', 'TIMED_OUT');
CREATE TYPE "CommunicationApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE "CommunicationConsentStatus" AS ENUM ('OPTED_IN', 'OPTED_OUT', 'UNKNOWN');
CREATE TYPE "CommunicationWebhookProcessingStatus" AS ENUM ('RECEIVED', 'PROCESSED', 'DUPLICATE', 'FAILED');

CREATE TABLE "CommunicationCampaign" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "schoolId" UUID NOT NULL,
  "type" "CommunicationType" NOT NULL,
  "title" TEXT NOT NULL,
  "status" "CommunicationCampaignStatus" NOT NULL DEFAULT 'DRAFT',
  "priority" TEXT NOT NULL DEFAULT 'NORMAL',
  "contentVersion" INTEGER NOT NULL DEFAULT 1,
  "createdByUserId" UUID,
  "approvedByUserId" UUID,
  "approvedAt" TIMESTAMP(3),
  "scheduledAt" TIMESTAMP(3),
  "sendingStartedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "replyPolicy" TEXT NOT NULL DEFAULT 'NONE',
  "acknowledgementRequired" BOOLEAN NOT NULL DEFAULT false,
  "metadataJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CommunicationCampaign_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommunicationContent" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "campaignId" UUID NOT NULL,
  "version" INTEGER NOT NULL,
  "subject" TEXT,
  "body" TEXT NOT NULL,
  "shortBody" TEXT,
  "callToActionLabel" TEXT,
  "callToActionUrl" TEXT,
  "templateVariablesJson" JSONB,
  "createdByUserId" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommunicationContent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommunicationAudience" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "campaignId" UUID NOT NULL,
  "definitionJson" JSONB NOT NULL,
  "estimatedRecipients" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CommunicationAudience_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommunicationAudienceSnapshot" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "campaignId" UUID NOT NULL,
  "snapshotVersion" INTEGER NOT NULL,
  "recipientCount" INTEGER NOT NULL DEFAULT 0,
  "createdByUserId" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommunicationAudienceSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommunicationRecipient" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "schoolId" UUID NOT NULL,
  "campaignId" UUID NOT NULL,
  "audienceSnapshotId" UUID NOT NULL,
  "guardianId" UUID,
  "studentId" UUID,
  "staffUserId" UUID,
  "displayName" TEXT NOT NULL,
  "relationship" TEXT,
  "phoneE164" TEXT,
  "email" TEXT,
  "preferredChannel" "CommunicationChannel",
  "status" "CommunicationRecipientStatus" NOT NULL DEFAULT 'PENDING',
  "warningCodesJson" JSONB,
  "blockedReasonCode" TEXT,
  "personalisationJson" JSONB,
  "acknowledgedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CommunicationRecipient_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommunicationDelivery" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "schoolId" UUID NOT NULL,
  "campaignId" UUID NOT NULL,
  "recipientId" UUID NOT NULL,
  "channel" "CommunicationChannel" NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'DRY_RUN',
  "status" "CommunicationDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "contentVersion" INTEGER NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "renderedContentHash" TEXT,
  "providerMessageId" TEXT,
  "queuedAt" TIMESTAMP(3),
  "submittedAt" TIMESTAMP(3),
  "acceptedAt" TIMESTAMP(3),
  "deliveredAt" TIMESTAMP(3),
  "readAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "lastErrorCode" TEXT,
  "lastErrorMessageSafe" TEXT,
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "nextRetryAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CommunicationDelivery_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommunicationDeliveryAttempt" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "deliveryId" UUID NOT NULL,
  "attemptNumber" INTEGER NOT NULL,
  "provider" TEXT NOT NULL,
  "status" "CommunicationAttemptStatus" NOT NULL,
  "requestId" TEXT,
  "providerMessageId" TEXT,
  "providerResponseCode" TEXT,
  "errorCode" TEXT,
  "errorMessageSafe" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommunicationDeliveryAttempt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommunicationApproval" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "campaignId" UUID NOT NULL,
  "requiredRole" TEXT NOT NULL,
  "requestedByUserId" UUID,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedByUserId" UUID,
  "reviewedAt" TIMESTAMP(3),
  "status" "CommunicationApprovalStatus" NOT NULL DEFAULT 'PENDING',
  "comment" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommunicationApproval_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommunicationTemplate" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "schoolId" UUID NOT NULL,
  "channel" "CommunicationChannel" NOT NULL,
  "communicationType" "CommunicationType" NOT NULL,
  "name" TEXT NOT NULL,
  "providerTemplateName" TEXT,
  "providerTemplateId" TEXT,
  "languageCode" TEXT NOT NULL DEFAULT 'en',
  "category" TEXT,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "content" TEXT NOT NULL,
  "variablesJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CommunicationTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommunicationConsent" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "schoolId" UUID NOT NULL,
  "guardianId" UUID NOT NULL,
  "channel" "CommunicationChannel" NOT NULL,
  "status" "CommunicationConsentStatus" NOT NULL DEFAULT 'UNKNOWN',
  "source" TEXT NOT NULL DEFAULT 'SYSTEM',
  "consentTextVersion" TEXT,
  "optedInAt" TIMESTAMP(3),
  "optedOutAt" TIMESTAMP(3),
  "recordedByUserId" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CommunicationConsent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommunicationWebhookEvent" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "provider" TEXT NOT NULL,
  "externalEventId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "payloadHash" TEXT NOT NULL,
  "processingStatus" "CommunicationWebhookProcessingStatus" NOT NULL DEFAULT 'RECEIVED',
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),
  "errorCode" TEXT,
  CONSTRAINT "CommunicationWebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommunicationUsageRecord" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "schoolId" UUID NOT NULL,
  "campaignId" UUID NOT NULL,
  "deliveryId" UUID,
  "channel" "CommunicationChannel" NOT NULL,
  "provider" TEXT NOT NULL,
  "billableUnits" INTEGER NOT NULL DEFAULT 0,
  "unitType" TEXT NOT NULL DEFAULT 'MESSAGE',
  "providerCostMinor" INTEGER,
  "schoolChargeMinor" INTEGER,
  "currency" TEXT NOT NULL DEFAULT 'UGX',
  "status" TEXT NOT NULL DEFAULT 'ESTIMATED',
  "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommunicationUsageRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommunicationChannelSetting" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "schoolId" UUID NOT NULL,
  "channel" "CommunicationChannel" NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'DRY_RUN',
  "sendingEnabled" BOOLEAN NOT NULL DEFAULT false,
  "connectionStatus" TEXT NOT NULL DEFAULT 'NOT_CONFIGURED',
  "displayName" TEXT,
  "displayPhoneNumber" TEXT,
  "senderId" TEXT,
  "providerMetadataJson" JSONB,
  "verifiedAt" TIMESTAMP(3),
  "lastHealthCheckAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CommunicationChannelSetting_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CommunicationContent_campaignId_version_key" ON "CommunicationContent"("campaignId", "version");
CREATE UNIQUE INDEX "CommunicationAudience_campaignId_key" ON "CommunicationAudience"("campaignId");
CREATE UNIQUE INDEX "CommunicationAudienceSnapshot_campaignId_snapshotVersion_key" ON "CommunicationAudienceSnapshot"("campaignId", "snapshotVersion");
CREATE UNIQUE INDEX "CommunicationDelivery_idempotencyKey_key" ON "CommunicationDelivery"("idempotencyKey");
CREATE UNIQUE INDEX "CommunicationDelivery_campaignId_recipientId_channel_contentVersion_key" ON "CommunicationDelivery"("campaignId", "recipientId", "channel", "contentVersion");
CREATE UNIQUE INDEX "CommunicationDeliveryAttempt_deliveryId_attemptNumber_key" ON "CommunicationDeliveryAttempt"("deliveryId", "attemptNumber");
CREATE UNIQUE INDEX "CommunicationTemplate_schoolId_channel_name_languageCode_key" ON "CommunicationTemplate"("schoolId", "channel", "name", "languageCode");
CREATE UNIQUE INDEX "CommunicationConsent_schoolId_guardianId_channel_key" ON "CommunicationConsent"("schoolId", "guardianId", "channel");
CREATE UNIQUE INDEX "CommunicationWebhookEvent_provider_externalEventId_key" ON "CommunicationWebhookEvent"("provider", "externalEventId");
CREATE UNIQUE INDEX "CommunicationChannelSetting_schoolId_channel_provider_key" ON "CommunicationChannelSetting"("schoolId", "channel", "provider");

CREATE INDEX "CommunicationCampaign_schoolId_status_createdAt_idx" ON "CommunicationCampaign"("schoolId", "status", "createdAt");
CREATE INDEX "CommunicationCampaign_schoolId_type_createdAt_idx" ON "CommunicationCampaign"("schoolId", "type", "createdAt");
CREATE INDEX "CommunicationRecipient_schoolId_campaignId_status_idx" ON "CommunicationRecipient"("schoolId", "campaignId", "status");
CREATE INDEX "CommunicationRecipient_schoolId_studentId_idx" ON "CommunicationRecipient"("schoolId", "studentId");
CREATE INDEX "CommunicationRecipient_schoolId_guardianId_idx" ON "CommunicationRecipient"("schoolId", "guardianId");
CREATE INDEX "CommunicationDelivery_schoolId_campaignId_status_idx" ON "CommunicationDelivery"("schoolId", "campaignId", "status");
CREATE INDEX "CommunicationDelivery_schoolId_status_nextRetryAt_idx" ON "CommunicationDelivery"("schoolId", "status", "nextRetryAt");
CREATE INDEX "CommunicationUsageRecord_schoolId_campaignId_recordedAt_idx" ON "CommunicationUsageRecord"("schoolId", "campaignId", "recordedAt");

ALTER TABLE "CommunicationCampaign" ADD CONSTRAINT "CommunicationCampaign_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommunicationCampaign" ADD CONSTRAINT "CommunicationCampaign_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CommunicationCampaign" ADD CONSTRAINT "CommunicationCampaign_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CommunicationContent" ADD CONSTRAINT "CommunicationContent_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "CommunicationCampaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommunicationContent" ADD CONSTRAINT "CommunicationContent_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CommunicationAudience" ADD CONSTRAINT "CommunicationAudience_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "CommunicationCampaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommunicationAudienceSnapshot" ADD CONSTRAINT "CommunicationAudienceSnapshot_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "CommunicationCampaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommunicationAudienceSnapshot" ADD CONSTRAINT "CommunicationAudienceSnapshot_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CommunicationRecipient" ADD CONSTRAINT "CommunicationRecipient_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommunicationRecipient" ADD CONSTRAINT "CommunicationRecipient_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "CommunicationCampaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommunicationRecipient" ADD CONSTRAINT "CommunicationRecipient_audienceSnapshotId_fkey" FOREIGN KEY ("audienceSnapshotId") REFERENCES "CommunicationAudienceSnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommunicationRecipient" ADD CONSTRAINT "CommunicationRecipient_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "GuardianContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CommunicationRecipient" ADD CONSTRAINT "CommunicationRecipient_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CommunicationDelivery" ADD CONSTRAINT "CommunicationDelivery_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommunicationDelivery" ADD CONSTRAINT "CommunicationDelivery_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "CommunicationCampaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommunicationDelivery" ADD CONSTRAINT "CommunicationDelivery_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "CommunicationRecipient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommunicationDeliveryAttempt" ADD CONSTRAINT "CommunicationDeliveryAttempt_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "CommunicationDelivery"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommunicationApproval" ADD CONSTRAINT "CommunicationApproval_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "CommunicationCampaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommunicationApproval" ADD CONSTRAINT "CommunicationApproval_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CommunicationApproval" ADD CONSTRAINT "CommunicationApproval_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CommunicationTemplate" ADD CONSTRAINT "CommunicationTemplate_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommunicationConsent" ADD CONSTRAINT "CommunicationConsent_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommunicationConsent" ADD CONSTRAINT "CommunicationConsent_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "GuardianContact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommunicationConsent" ADD CONSTRAINT "CommunicationConsent_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CommunicationUsageRecord" ADD CONSTRAINT "CommunicationUsageRecord_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommunicationUsageRecord" ADD CONSTRAINT "CommunicationUsageRecord_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "CommunicationCampaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommunicationUsageRecord" ADD CONSTRAINT "CommunicationUsageRecord_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "CommunicationDelivery"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CommunicationChannelSetting" ADD CONSTRAINT "CommunicationChannelSetting_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
