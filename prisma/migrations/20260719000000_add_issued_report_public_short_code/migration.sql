ALTER TABLE "IssuedReport"
ADD COLUMN "publicShortCode" TEXT;

CREATE UNIQUE INDEX "IssuedReport_publicShortCode_key"
ON "IssuedReport"("publicShortCode");

CREATE INDEX "IssuedReport_publicShortCode_idx"
ON "IssuedReport"("publicShortCode");
