-- Phase 3: AI Document Operating System primitives

CREATE TABLE "CreatorPreference" (
    "id" UUID NOT NULL,
    "creatorId" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreatorPreference_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AutomationWorkflow" (
    "id" UUID NOT NULL,
    "creatorId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "actions" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutomationWorkflow_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SearchIndex" (
    "id" UUID NOT NULL,
    "creatorId" UUID NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "title" TEXT,
    "searchableText" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SearchIndex_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Notification" (
    "id" UUID NOT NULL,
    "creatorId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DocumentAnalytics" (
    "id" UUID NOT NULL,
    "documentId" UUID NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,
    "downloads" INTEGER NOT NULL DEFAULT 0,
    "shares" INTEGER NOT NULL DEFAULT 0,
    "visitors" INTEGER NOT NULL DEFAULT 0,
    "lastViewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentAnalytics_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CreatorPreference_creatorId_key_key" ON "CreatorPreference"("creatorId", "key");
CREATE INDEX "CreatorPreference_creatorId_idx" ON "CreatorPreference"("creatorId");

CREATE INDEX "AutomationWorkflow_creatorId_isActive_idx" ON "AutomationWorkflow"("creatorId", "isActive");
CREATE INDEX "AutomationWorkflow_trigger_isActive_idx" ON "AutomationWorkflow"("trigger", "isActive");

CREATE UNIQUE INDEX "SearchIndex_entityType_entityId_key" ON "SearchIndex"("entityType", "entityId");
CREATE INDEX "SearchIndex_creatorId_entityType_idx" ON "SearchIndex"("creatorId", "entityType");
CREATE INDEX "SearchIndex_creatorId_updatedAt_idx" ON "SearchIndex"("creatorId", "updatedAt");

CREATE INDEX "Notification_creatorId_readAt_createdAt_idx" ON "Notification"("creatorId", "readAt", "createdAt");
CREATE INDEX "Notification_creatorId_type_idx" ON "Notification"("creatorId", "type");

CREATE UNIQUE INDEX "DocumentAnalytics_documentId_key" ON "DocumentAnalytics"("documentId");
CREATE INDEX "DocumentAnalytics_views_idx" ON "DocumentAnalytics"("views");
CREATE INDEX "DocumentAnalytics_downloads_idx" ON "DocumentAnalytics"("downloads");
CREATE INDEX "DocumentAnalytics_updatedAt_idx" ON "DocumentAnalytics"("updatedAt");

ALTER TABLE "CreatorPreference" ADD CONSTRAINT "CreatorPreference_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AutomationWorkflow" ADD CONSTRAINT "AutomationWorkflow_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SearchIndex" ADD CONSTRAINT "SearchIndex_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DocumentAnalytics" ADD CONSTRAINT "DocumentAnalytics_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "SmartDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
