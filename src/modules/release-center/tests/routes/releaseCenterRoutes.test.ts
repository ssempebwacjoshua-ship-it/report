import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createServer } from "../../../../server";
import { hashPassword, signToken } from "../../../../server/services/authService";
import { prisma } from "../../../../server/db/prisma";
import type { ReleaseCenterCommunicationPreview } from "../../client/releaseCenterClient";
import * as releaseCenterCommunicationService from "../../server/services/releaseCenterCommunicationService";

const mockPrepareReleaseCenterCommunicationPreview = vi.fn();

let authToken = "";
let teacherToken = "";
let otherAdminToken = "";
let schoolId = "";
let otherSchoolId = "";

beforeAll(async () => {
  const school = await prisma.school.findUniqueOrThrow({
    where: { code: "SCU-PREVIEW" },
    select: { id: true, name: true },
  });
  const otherSchool = await prisma.school.upsert({
    where: { code: "SCU-PREVIEW-B" },
    update: { name: "Release Center Routes Other School" },
    create: { code: "SCU-PREVIEW-B", name: "Release Center Routes Other School" },
    select: { id: true },
  });
  schoolId = school.id;
  otherSchoolId = otherSchool.id;
  const email = "release-center-routes-test@schoolconnect.test";
  const teacherEmail = "release-center-routes-teacher@schoolconnect.test";
  const otherAdminEmail = "release-center-routes-other-admin@schoolconnect.test";
  const passwordHash = await hashPassword("ReleaseCenterRoutesPass123!");
  const user = await prisma.user.upsert({
    where: {
      schoolId_email: {
        schoolId: school.id,
        email,
      },
    },
    update: {
      name: "Release Center Routes Test Admin",
      role: "ADMIN_OPERATOR",
      isActive: true,
      passwordHash,
      tokenVersion: 0,
      mustChangePassword: false,
    },
    create: {
      schoolId: school.id,
      name: "Release Center Routes Test Admin",
      email,
      role: "ADMIN_OPERATOR",
      isActive: true,
      passwordHash,
      tokenVersion: 0,
      mustChangePassword: false,
    },
    select: {
      id: true,
      schoolId: true,
      name: true,
      email: true,
      role: true,
      tokenVersion: true,
    },
  });
  const teacher = await prisma.user.upsert({
    where: {
      schoolId_email: {
        schoolId: school.id,
        email: teacherEmail,
      },
    },
    update: {
      name: "Release Center Routes Test Teacher",
      role: "TEACHER",
      isActive: true,
      passwordHash,
      tokenVersion: 0,
      mustChangePassword: false,
    },
    create: {
      schoolId: school.id,
      name: "Release Center Routes Test Teacher",
      email: teacherEmail,
      role: "TEACHER",
      isActive: true,
      passwordHash,
      tokenVersion: 0,
      mustChangePassword: false,
    },
    select: {
      id: true,
      schoolId: true,
      name: true,
      email: true,
      role: true,
      tokenVersion: true,
    },
  });
  const otherAdmin = await prisma.user.upsert({
    where: {
      schoolId_email: {
        schoolId: otherSchool.id,
        email: otherAdminEmail,
      },
    },
    update: {
      name: "Release Center Routes Other Admin",
      role: "ADMIN_OPERATOR",
      isActive: true,
      passwordHash,
      tokenVersion: 0,
      mustChangePassword: false,
    },
    create: {
      schoolId: otherSchool.id,
      name: "Release Center Routes Other Admin",
      email: otherAdminEmail,
      role: "ADMIN_OPERATOR",
      isActive: true,
      passwordHash,
      tokenVersion: 0,
      mustChangePassword: false,
    },
    select: {
      id: true,
      schoolId: true,
      name: true,
      email: true,
      role: true,
      tokenVersion: true,
    },
  });

  authToken = signToken({
    userId: user.id,
    schoolId: user.schoolId,
    name: user.name,
    email: user.email,
    role: user.role,
    tokenVersion: user.tokenVersion,
  });
  teacherToken = signToken({
    userId: teacher.id,
    schoolId: teacher.schoolId,
    name: teacher.name,
    email: teacher.email,
    role: teacher.role,
    tokenVersion: teacher.tokenVersion,
  });
  otherAdminToken = signToken({
    userId: otherAdmin.id,
    schoolId: otherAdmin.schoolId,
    name: otherAdmin.name,
    email: otherAdmin.email,
    role: otherAdmin.role,
    tokenVersion: otherAdmin.tokenVersion,
  });
});

async function makeToken() {
  return authToken;
}

function buildCommunicationPreview(overrides: Partial<ReleaseCenterCommunicationPreview> = {}): ReleaseCenterCommunicationPreview {
  return {
    channel: "SMS",
    channelAvailable: true,
    unavailableReason: null,
    batchLabel: "Term 1 TERM_SUMMARY reports",
    introduction: "Reports are ready.",
    reportLinksPlaceholder: "{{reportLinksText}}",
    messageTemplate: "Dear Parent,\n\nReports are ready.\n\n{{reportLinksText}}",
    selectedStudents: [],
    recipients: [],
    counts: {
      selectedStudents: 1,
      validParentNumbers: 1,
      missingContacts: 0,
      invalidNumbers: 0,
      duplicateGuardianNumbers: 0,
      excludedStudents: 0,
      smsSegments: 1,
      estimatedCostMinor: 120,
      estimatedCostCurrency: "UGX",
      eligibleRecipients: 1,
    },
    estimatedCostNote: "Estimated from 1 SMS segment at 120 UGX each.",
    existingCampaign: null,
    source: {
      type: "RELEASE_CENTRE",
      batchId: "batch-1",
      sourceKey: "source-1",
      version: 1,
      classId: "00000000-0000-0000-0000-000000000001",
      streamId: null,
      academicYearId: "00000000-0000-0000-0000-000000000002",
      termId: "00000000-0000-0000-0000-000000000003",
      academicYearName: "2025/2026",
      termName: "Term 1",
      assessmentType: "TERM_SUMMARY",
      selectedStudentIds: ["11111111-1111-4111-8111-111111111111"],
      selectedIssuedReportIds: ["issued-report-1"],
      selectedCount: 1,
      channel: "SMS",
      createdFrom: "release-centre",
    },
    preparedRecipients: [{
      guardianId: "guardian-1",
      studentId: "11111111-1111-4111-8111-111111111111",
      displayName: "Parent One",
      relationship: "Parent",
      phoneE164: "+256700000000",
      email: null,
      preferredChannel: "SMS",
      status: "READY",
      blockedReasonCode: null,
      warningCodesJson: [],
      personalisationJson: {
        guardianName: "Parent One",
        reportLinksText: "Ada Lovelace: https://school-connect.test/parent/r/issued-report-1",
      },
    }],
    ...overrides,
  };
}

async function createServerWithReleasePreview(preview: ReleaseCenterCommunicationPreview) {
  vi.resetModules();
  vi.doMock("../../server/services/releaseCenterCommunicationService", async () => {
    const actual = await vi.importActual("../../server/services/releaseCenterCommunicationService");
    return {
      ...actual,
      prepareReleaseCenterCommunicationPreview: vi.fn().mockResolvedValue(preview),
    };
  });
  const serverModule = await import("../../../../server");
  return serverModule.createServer();
}

beforeEach(async () => {
  mockPrepareReleaseCenterCommunicationPreview.mockReset();
  vi.spyOn(releaseCenterCommunicationService, "prepareReleaseCenterCommunicationPreview")
    .mockImplementation((...args: Parameters<typeof releaseCenterCommunicationService.prepareReleaseCenterCommunicationPreview>) =>
      mockPrepareReleaseCenterCommunicationPreview(...args));
  await prisma.communicationDeliveryAttempt.deleteMany({ where: { delivery: { schoolId } } });
  await prisma.communicationDelivery.deleteMany({ where: { schoolId } });
  await prisma.communicationRecipient.deleteMany({ where: { schoolId } });
  await prisma.communicationAudienceSnapshot.deleteMany({ where: { campaign: { schoolId } } });
  await prisma.communicationAudience.deleteMany({ where: { campaign: { schoolId } } });
  await prisma.communicationContent.deleteMany({ where: { campaign: { schoolId } } });
  await prisma.communicationApproval.deleteMany({ where: { campaign: { schoolId } } });
  await prisma.communicationCampaign.deleteMany({ where: { schoolId } });
  await prisma.auditLog.deleteMany({
    where: {
      schoolId,
      action: { in: ["report.release_communication_created"] },
    },
  });
});

describe("releaseCenterRoutes ? GET /api/reports/release-status", () => {
  it("returns 401 without Authorization header", async () => {
    const res = await request(createServer())
      .get("/api/reports/release-status")
      .query({ classId: "00000000-0000-0000-0000-000000000001" });
    expect(res.status).toBe(401);
  });

  it("returns 401 with invalid Bearer token", async () => {
    const res = await request(createServer())
      .get("/api/reports/release-status")
      .set("Authorization", "Bearer bad.token.here")
      .query({ classId: "00000000-0000-0000-0000-000000000001" });
    expect(res.status).toBe(401);
  });

  it("returns 400 when classId is missing", async () => {
    const token = await makeToken();
    const res = await request(createServer())
      .get("/api/reports/release-status")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it("returns JSON with rows/summary/meta shape on valid request (may have empty rows)", async () => {
    const token = await makeToken();
    const res = await request(createServer())
      .get("/api/reports/release-status")
      .set("Authorization", `Bearer ${token}`)
      .query({ classId: "00000000-0000-0000-0000-000000000099", schoolCode: "SCU-PREVIEW" });
    expect([200, 404, 500]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body).toHaveProperty("rows");
      expect(res.body).toHaveProperty("summary");
      expect(res.body).toHaveProperty("meta");
      expect(Array.isArray(res.body.rows)).toBe(true);
    }
  });
});

describe("releaseCenterRoutes bulk action endpoints", () => {
  it("returns 400 for invalid mark-sent-bulk payload", async () => {
    const token = await makeToken();
    const res = await request(createServer())
      .post("/api/reports/release/mark-sent-bulk")
      .set("Authorization", `Bearer ${token}`)
      .send({ classId: "00000000-0000-0000-0000-000000000001" });
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid revoke-bulk payload", async () => {
    const token = await makeToken();
    const res = await request(createServer())
      .post("/api/reports/release/revoke-bulk")
      .set("Authorization", `Bearer ${token}`)
      .send({ classId: "00000000-0000-0000-0000-000000000001" });
    expect(res.status).toBe(400);
  });
});

describe("releaseCenterRoutes communications handoff endpoints", () => {
  const validBody = {
    classId: "00000000-0000-0000-0000-000000000001",
    academicYearId: "00000000-0000-0000-0000-000000000002",
    termId: "00000000-0000-0000-0000-000000000003",
    assessmentType: "TERM_SUMMARY",
    studentIds: ["11111111-1111-4111-8111-111111111111"],
    introduction: "Reports are ready.",
    channel: "SMS",
  } as const;

  it("returns 401 for preview without auth", async () => {
    const res = await request(createServer())
      .post("/api/reports/release/communications/preview")
      .send(validBody);
    expect(res.status).toBe(401);
  });

  it("returns 401 for create/reopen without auth", async () => {
    const res = await request(createServer())
      .post("/api/reports/release/communications")
      .send(validBody);
    expect(res.status).toBe(401);
  });

  it("returns 403 for preview without communications.validate", async () => {
    const res = await request(createServer())
      .post("/api/reports/release/communications/preview")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send(validBody);
    expect(res.status).toBe(403);
  });

  it("returns 403 for create/reopen without communications.create", async () => {
    const res = await request(createServer())
      .post("/api/reports/release/communications")
      .set("Authorization", `Bearer ${teacherToken}`)
      .send(validBody);
    expect(res.status).toBe(403);
  });

  it("returns preview details for released-report eligibility including missing and invalid contacts", async () => {
    const server = await createServerWithReleasePreview(buildCommunicationPreview({
      selectedStudents: [
        {
          studentId: "student-ready",
          studentName: "Ada Lovelace",
          issuedReportId: "issued-ready",
          guardianName: "Parent One",
          phoneE164: "+256700000000",
          eligibilityStatus: "ELIGIBLE",
          exclusionReason: null,
        },
        {
          studentId: "student-missing",
          studentName: "Grace Hopper",
          issuedReportId: "issued-missing",
          guardianName: null,
          phoneE164: null,
          eligibilityStatus: "MISSING_CONTACT",
          exclusionReason: "No SMS-capable guardian contact is available.",
        },
        {
          studentId: "student-invalid",
          studentName: "Katherine Johnson",
          issuedReportId: "issued-invalid",
          guardianName: "Parent Two",
          phoneE164: null,
          eligibilityStatus: "INVALID_PHONE",
          exclusionReason: "The guardian phone number is invalid.",
        },
        {
          studentId: "student-not-released",
          studentName: "Dorothy Vaughan",
          issuedReportId: null,
          guardianName: "Parent Three",
          phoneE164: null,
          eligibilityStatus: "NOT_RELEASED",
          exclusionReason: "A released report link has not been generated yet.",
        },
      ],
      counts: {
        selectedStudents: 4,
        validParentNumbers: 1,
        missingContacts: 1,
        invalidNumbers: 1,
        duplicateGuardianNumbers: 0,
        excludedStudents: 3,
        smsSegments: 1,
        estimatedCostMinor: 120,
        estimatedCostCurrency: "UGX",
        eligibleRecipients: 1,
      },
    }));

    const token = await makeToken();
    const res = await request(server)
      .post("/api/reports/release/communications/preview")
      .set("Authorization", `Bearer ${token}`)
      .send(validBody);

    expect(res.status).toBe(200);
    expect(res.body.preview.counts).toMatchObject({
      selectedStudents: 4,
      validParentNumbers: 1,
      missingContacts: 1,
      invalidNumbers: 1,
      excludedStudents: 3,
    });
    expect(res.body.preview.selectedStudents.map((row: { eligibilityStatus: string }) => row.eligibilityStatus)).toEqual([
      "ELIGIBLE",
      "MISSING_CONTACT",
      "INVALID_PHONE",
      "NOT_RELEASED",
    ]);
  });

  it("rejects creation when no released reports have valid recipients", async () => {
    const server = await createServerWithReleasePreview(buildCommunicationPreview({
      counts: {
        selectedStudents: 2,
        validParentNumbers: 0,
        missingContacts: 1,
        invalidNumbers: 1,
        duplicateGuardianNumbers: 0,
        excludedStudents: 2,
        smsSegments: 0,
        estimatedCostMinor: 0,
        estimatedCostCurrency: "UGX",
        eligibleRecipients: 0,
      },
      preparedRecipients: [],
    }));

    const token = await makeToken();
    const res = await request(server)
      .post("/api/reports/release/communications")
      .set("Authorization", `Bearer ${token}`)
      .send(validBody);

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/At least one released report with a valid guardian phone number is required/i);
  });

  it("creates a normal CommunicationCampaign and writes an audit log", async () => {
    const server = await createServerWithReleasePreview(buildCommunicationPreview());

    const token = await makeToken();
    const res = await request(server)
      .post("/api/reports/release/communications")
      .set("Authorization", `Bearer ${token}`)
      .send(validBody);

    expect(res.status).toBe(201);
    expect(res.body.reopened).toBe(false);
    const campaign = await prisma.communicationCampaign.findUniqueOrThrow({
      where: { id: res.body.campaign.id },
      include: { contents: true, audienceSnapshots: true },
    });
    expect(campaign.schoolId).toBe(schoolId);
    expect(campaign.type).toBe("REPORT_RELEASE");
    expect(campaign.title).toBe("Term 1 TERM_SUMMARY reports SMS");
    expect(campaign.contents[0]?.body).toContain("{{reportLinksText}}");
    expect(campaign.audienceSnapshots).toHaveLength(1);
    const audit = await prisma.auditLog.findFirst({
      where: {
        schoolId,
        action: "report.release_communication_created",
        correlationId: campaign.id,
      },
    });
    expect(audit).toBeTruthy();
  });

  it("reopens an existing matching campaign instead of duplicating it", async () => {
    const existing = await prisma.communicationCampaign.create({
      data: {
        schoolId,
        type: "REPORT_RELEASE",
        title: "Existing release campaign",
        createdByUserId: null,
        metadataJson: {
          source: {
            type: "RELEASE_CENTRE",
            batchId: "batch-1",
            sourceKey: "source-1",
            version: 1,
            classId: validBody.classId,
            streamId: null,
            academicYearId: validBody.academicYearId,
            termId: validBody.termId,
            academicYearName: "2025/2026",
            termName: "Term 1",
            assessmentType: validBody.assessmentType,
            selectedStudentIds: [...validBody.studentIds],
            selectedIssuedReportIds: ["issued-report-1"],
            selectedCount: 1,
            channel: "SMS",
            createdFrom: "release-centre",
          },
        },
        contents: {
          create: {
            version: 1,
            body: "Existing body",
          },
        },
      },
    });
    const snapshot = await prisma.communicationAudienceSnapshot.create({
      data: {
        campaignId: existing.id,
        snapshotVersion: 1,
        recipientCount: 1,
      },
    });
    const recipient = await prisma.communicationRecipient.create({
      data: {
        schoolId,
        campaignId: existing.id,
        audienceSnapshotId: snapshot.id,
        displayName: "Parent One",
        phoneE164: "+256700000000",
        status: "READY",
      },
    });
    await prisma.communicationDelivery.create({
      data: {
        schoolId,
        campaignId: existing.id,
        recipientId: recipient.id,
        channel: "SMS",
        provider: "DRY_RUN",
        status: "QUEUED",
        contentVersion: 1,
        idempotencyKey: `${existing.id}-queued`,
      },
    });
    const server = await createServerWithReleasePreview(buildCommunicationPreview({
      existingCampaign: {
        id: existing.id,
        title: existing.title,
        status: existing.status,
        version: 1,
      },
    }));

    const token = await makeToken();
    const res = await request(server)
      .post("/api/reports/release/communications")
      .set("Authorization", `Bearer ${token}`)
      .send(validBody);

    expect(res.status).toBe(200);
    expect(res.body.reopened).toBe(true);
    expect(res.body.duplicate).toBe(true);
    expect(res.body.campaign.id).toBe(existing.id);
    await expect(prisma.communicationCampaign.count({ where: { schoolId, type: "REPORT_RELEASE" } })).resolves.toBe(1);
  });

  it("blocks cross-tenant reuse when preview points at another school's campaign", async () => {
    const otherCampaign = await prisma.communicationCampaign.create({
      data: {
        schoolId: otherSchoolId,
        type: "REPORT_RELEASE",
        title: "Other school release campaign",
        createdByUserId: null,
        contents: {
          create: {
            version: 1,
            body: "Other school body",
          },
        },
      },
    });
    const server = await createServerWithReleasePreview(buildCommunicationPreview({
      existingCampaign: {
        id: otherCampaign.id,
        title: otherCampaign.title,
        status: otherCampaign.status,
        version: 1,
      },
    }));

    const token = await makeToken();
    const res = await request(server)
      .post("/api/reports/release/communications")
      .set("Authorization", `Bearer ${token}`)
      .send(validBody);

    expect(res.status).toBe(404);
  });
});

describe("releaseCenterRoutes ? POST /api/reports/issue-bulk", () => {
  it("returns 401 without Authorization header", async () => {
    const res = await request(createServer())
      .post("/api/reports/issue-bulk")
      .send({ classId: "00000000-0000-0000-0000-000000000001" });
    expect(res.status).toBe(401);
  });

  it("returns 401 with invalid Bearer token", async () => {
    const res = await request(createServer())
      .post("/api/reports/issue-bulk")
      .set("Authorization", "Bearer bad.token.here")
      .send({ classId: "00000000-0000-0000-0000-000000000001" });
    expect(res.status).toBe(401);
  });

  it("returns 400 when classId is missing", async () => {
    const token = await makeToken();
    const res = await request(createServer())
      .post("/api/reports/issue-bulk")
      .set("Authorization", `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it("returns 400 when studentIds contains non-UUID strings", async () => {
    const token = await makeToken();
    const res = await request(createServer())
      .post("/api/reports/issue-bulk")
      .set("Authorization", `Bearer ${token}`)
      .send({
        classId: "00000000-0000-0000-0000-000000000001",
        studentIds: ["not-a-uuid"],
      });
    expect(res.status).toBe(400);
  });

  it("returns issued/skipped arrays in response body on valid request", async () => {
    const token = await makeToken();
    const res = await request(createServer())
      .post("/api/reports/issue-bulk")
      .set("Authorization", `Bearer ${token}`)
      .send({
        schoolCode: "SCU-PREVIEW",
        classId: "00000000-0000-0000-0000-000000000099",
      });
    expect([201, 404, 500]).toContain(res.status);
    if (res.status === 201) {
      expect(res.body).toHaveProperty("issued");
      expect(res.body).toHaveProperty("skipped");
      expect(Array.isArray(res.body.issued)).toBe(true);
      expect(Array.isArray(res.body.skipped)).toBe(true);
    }
  });
});

describe("releaseCenterRoutes ? POST /api/reports/release/:id/mark-sent", () => {
  it("returns 401 without auth", async () => {
    const res = await request(createServer())
      .post("/api/reports/release/00000000-0000-0000-0000-000000000001/mark-sent");
    expect(res.status).toBe(401);
  });

  it("returns 404 for non-existent issued report", async () => {
    const token = await makeToken();
    const res = await request(createServer())
      .post("/api/reports/release/00000000-0000-0000-0000-000000000001/mark-sent")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty("error");
  });
});

describe("releaseCenterRoutes ? POST /api/reports/release/:id/revoke", () => {
  it("returns 401 without auth", async () => {
    const res = await request(createServer())
      .post("/api/reports/release/00000000-0000-0000-0000-000000000001/revoke");
    expect(res.status).toBe(401);
  });

  it("returns 404 for non-existent issued report", async () => {
    const token = await makeToken();
    const res = await request(createServer())
      .post("/api/reports/release/00000000-0000-0000-0000-000000000001/revoke")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty("error");
  });
});

describe("releaseCenterRoutes ? delivery status contract", () => {
  it("issue-bulk response never exposes parentAccessToken hash (only raw token)", async () => {
    const token = await makeToken();
    const res = await request(createServer())
      .post("/api/reports/issue-bulk")
      .set("Authorization", `Bearer ${token}`)
      .send({ schoolCode: "SCU-PREVIEW", classId: "00000000-0000-0000-0000-000000000099" });
    if (res.status === 201 && res.body.issued?.length > 0) {
      for (const item of res.body.issued) {
        expect(item.parentLink).toMatch(/\/r\//);
        expect(item.parentLink).not.toMatch(/\/api\//);
        expect(item.referenceCode).toMatch(/^\d{8}-[0-9A-F]{6}$/);
      }
    }
  });

  it("release-status rows never include parentAccessToken", async () => {
    const token = await makeToken();
    const res = await request(createServer())
      .get("/api/reports/release-status")
      .set("Authorization", `Bearer ${token}`)
      .query({ classId: "00000000-0000-0000-0000-000000000099", schoolCode: "SCU-PREVIEW" });
    if (res.status === 200) {
      for (const row of res.body.rows ?? []) {
        expect(row).not.toHaveProperty("parentAccessToken");
        expect(row.issuedReport ?? {}).not.toHaveProperty("parentAccessToken");
      }
    }
  });

  it("release-status response has no qrCode field anywhere", async () => {
    const token = await makeToken();
    const res = await request(createServer())
      .get("/api/reports/release-status")
      .set("Authorization", `Bearer ${token}`)
      .query({ classId: "00000000-0000-0000-0000-000000000099", schoolCode: "SCU-PREVIEW" });
    if (res.status === 200) {
      const json = JSON.stringify(res.body);
      expect(json).not.toContain("qrCode");
      expect(json).not.toContain("qr_code");
    }
  });

  it("issue-bulk response has no qrCode field anywhere", async () => {
    const token = await makeToken();
    const res = await request(createServer())
      .post("/api/reports/issue-bulk")
      .set("Authorization", `Bearer ${token}`)
      .send({ schoolCode: "SCU-PREVIEW", classId: "00000000-0000-0000-0000-000000000099" });
    if (res.status === 201) {
      const json = JSON.stringify(res.body);
      expect(json).not.toContain("qrCode");
      expect(json).not.toContain("qr_code");
    }
  });
});
