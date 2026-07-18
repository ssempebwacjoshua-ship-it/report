CREATE TABLE "Visitor" (
    "id" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT,
    "idDocumentType" TEXT NOT NULL,
    "idDocumentNumber" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Visitor_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VisitorVisit" (
    "id" UUID NOT NULL,
    "schoolId" UUID NOT NULL,
    "visitorId" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CHECKED_IN',
    "purpose" TEXT NOT NULL,
    "hostName" TEXT NOT NULL,
    "checkedInAt" TIMESTAMP(3) NOT NULL,
    "checkedOutAt" TIMESTAMP(3),
    "idDocumentImageUrl" TEXT,
    "selfieImageUrl" TEXT,
    "createdByUserId" UUID,
    "checkedOutByUserId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VisitorVisit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Visitor_schoolId_idDocumentType_idDocumentNumber_key" ON "Visitor"("schoolId", "idDocumentType", "idDocumentNumber");
CREATE INDEX "Visitor_schoolId_fullName_idx" ON "Visitor"("schoolId", "fullName");
CREATE INDEX "Visitor_schoolId_phone_idx" ON "Visitor"("schoolId", "phone");

CREATE INDEX "VisitorVisit_schoolId_status_checkedInAt_idx" ON "VisitorVisit"("schoolId", "status", "checkedInAt");
CREATE INDEX "VisitorVisit_schoolId_checkedInAt_idx" ON "VisitorVisit"("schoolId", "checkedInAt");
CREATE INDEX "VisitorVisit_schoolId_visitorId_checkedInAt_idx" ON "VisitorVisit"("schoolId", "visitorId", "checkedInAt");

ALTER TABLE "Visitor"
ADD CONSTRAINT "Visitor_schoolId_fkey"
FOREIGN KEY ("schoolId") REFERENCES "School"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "VisitorVisit"
ADD CONSTRAINT "VisitorVisit_schoolId_fkey"
FOREIGN KEY ("schoolId") REFERENCES "School"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "VisitorVisit"
ADD CONSTRAINT "VisitorVisit_visitorId_fkey"
FOREIGN KEY ("visitorId") REFERENCES "Visitor"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "VisitorVisit"
ADD CONSTRAINT "VisitorVisit_createdByUserId_fkey"
FOREIGN KEY ("createdByUserId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "VisitorVisit"
ADD CONSTRAINT "VisitorVisit_checkedOutByUserId_fkey"
FOREIGN KEY ("checkedOutByUserId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
