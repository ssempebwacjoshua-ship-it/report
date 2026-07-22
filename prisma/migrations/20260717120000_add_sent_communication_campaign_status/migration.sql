-- Additive enum expansion for SMS provider-accepted campaign completion.
ALTER TYPE "CommunicationCampaignStatus" ADD VALUE IF NOT EXISTS 'SENT';
