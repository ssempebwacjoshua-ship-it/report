CREATE TABLE "AppSetting" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "schoolCode" TEXT NOT NULL,
    "sections" JSONB NOT NULL,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AppSetting_schoolCode_key" ON "AppSetting"("schoolCode");
CREATE INDEX "AppSetting_schoolCode_idx" ON "AppSetting"("schoolCode");
