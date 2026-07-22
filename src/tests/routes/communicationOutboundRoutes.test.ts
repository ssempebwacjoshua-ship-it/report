import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createServer } from "../../server";
import { prisma } from "../../server/db/prisma";
import { hashPassword, signToken } from "../../server/services/authService";
import { determinePostSendCampaignStatus, processPendingSmsDeliveries } from "../../server/services/communicationEngine";
import { persistAndProcessWhatsAppWebhook } from "../../server/services/whatsappWebhookService";

let adminToken = "";
let teacherToken = "";
let otherAdminToken = "";
let schoolId = "";
let otherSchoolId = "";
let studentId = "";

function auth(token: string) {
  return `Bearer ${token}`;
}

beforeAll(async () => {
  const school = await prisma.school.upsert({
    where: { code: "COMM-OUT-A" },
    update: { name: "Communication Outbound A" },
    create: { code: "COMM-OUT-A", name: "Communication Outbound A" },
    select: { id: true },
  });
  const other = await prisma.school.upsert({
    where: { code: "COMM-OUT-B" },
    update: { name: "Communication Outbound B" },
    create: { code: "COMM-OUT-B", name: "Communication Outbound B" },
    select: { id: true },
  });
  schoolId = school.id;
  otherSchoolId = other.id;
  const passwordHash = await hashPassword("CommunicationPass123!");
  const admin = await prisma.user.upsert({
    where: { schoolId_email: { schoolId, email: "comm-admin@school.test" } },
    update: { role: "ADMIN_OPERATOR", isActive: true, passwordHash, tokenVersion: 0 },
    create: { schoolId, email: "comm-admin@school.test", name: "Comm Admin", role: "ADMIN_OPERATOR", isActive: true, passwordHash, tokenVersion: 0 },
  });
  const teacher = await prisma.user.upsert({
    where: { schoolId_email: { schoolId, email: "comm-teacher@school.test" } },
    update: { role: "TEACHER", isActive: true, passwordHash, tokenVersion: 0 },
    create: { schoolId, email: "comm-teacher@school.test", name: "Comm Teacher", role: "TEACHER", isActive: true, passwordHash, tokenVersion: 0 },
  });
  const otherAdmin = await prisma.user.upsert({
    where: { schoolId_email: { schoolId: otherSchoolId, email: "comm-admin-other@school.test" } },
    update: { role: "ADMIN_OPERATOR", isActive: true, passwordHash, tokenVersion: 0 },
    create: { schoolId: otherSchoolId, email: "comm-admin-other@school.test", name: "Other Comm Admin", role: "ADMIN_OPERATOR", isActive: true, passwordHash, tokenVersion: 0 },
  });
  adminToken = signToken({ userId: admin.id, schoolId, name: admin.name, email: admin.email, role: admin.role, tokenVersion: admin.tokenVersion });
  teacherToken = signToken({ userId: teacher.id, schoolId, name: teacher.name, email: teacher.email, role: teacher.role, tokenVersion: teacher.tokenVersion });
  otherAdminToken = signToken({ userId: otherAdmin.id, schoolId: otherSchoolId, name: otherAdmin.name, email: otherAdmin.email, role: otherAdmin.role, tokenVersion: otherAdmin.tokenVersion });

  const student = await prisma.student.upsert({
    where: { schoolId_admissionNumber: { schoolId, admissionNumber: "COMM-001" } },
    update: { firstName: "Pat", lastName: "Parent", isActive: true },
    create: { schoolId, admissionNumber: "COMM-001", firstName: "Pat", lastName: "Parent", isActive: true },
  });
  studentId = student.id;
  await prisma.guardianContact.upsert({
    where: { studentId_guardianName_relationship: { studentId, guardianName: "Test Guardian", relationship: "Parent" } },
    update: { phone: "0774549869", canReceiveReports: true, preferredContactMethod: "SMS" },
    create: { schoolId, studentId, guardianName: "Test Guardian", relationship: "Parent", phone: "0774549869", canReceiveReports: true, preferredContactMethod: "SMS" },
  });
});

beforeEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  await prisma.communicationTemplate.deleteMany({ where: { schoolId } });
  await prisma.communicationTemplate.deleteMany({ where: { schoolId: otherSchoolId } });
  await prisma.communicationDeliveryAttempt.deleteMany({ where: { delivery: { schoolId } } });
  await prisma.communicationDelivery.deleteMany({ where: { schoolId } });
  await prisma.communicationRecipient.deleteMany({ where: { schoolId } });
  await prisma.communicationAudienceSnapshot.deleteMany({ where: { campaign: { schoolId } } });
  await prisma.communicationAudience.deleteMany({ where: { campaign: { schoolId } } });
  await prisma.communicationContent.deleteMany({ where: { campaign: { schoolId } } });
  await prisma.communicationApproval.deleteMany({ where: { campaign: { schoolId } } });
  await prisma.communicationUsageRecord.deleteMany({ where: { schoolId } });
  await prisma.communicationCampaign.deleteMany({ where: { schoolId } });
  await prisma.communicationWebhookEvent.deleteMany({ where: { provider: "META_CLOUD_WHATSAPP" } });
  await prisma.communicationWebhookEvent.deleteMany({ where: { provider: "YOOLA_SMS" } });
  await prisma.auditLog.deleteMany({ where: { schoolId, action: { startsWith: "communication." } } });
});

async function createCampaign(
  token = adminToken,
  body: Record<string, unknown> = { type: "ANNOUNCEMENT", title: "Outbound test", body: "Hello {{guardianName}}" },
) {
  const res = await request(createServer())
    .post("/api/communications/campaigns")
    .set("Authorization", auth(token))
    .send(body);
  expect(res.status).toBe(201);
  return res.body.campaign.id as string;
}

async function createTemplate(input: {
  channel: "WHATSAPP" | "SMS";
  status?: string;
  providerTemplateName?: string | null;
  providerTemplateId?: string | null;
  variablesJson?: unknown;
  body?: string;
}) {
  return prisma.communicationTemplate.create({
    data: {
      schoolId,
      channel: input.channel,
      communicationType: "ANNOUNCEMENT" as never,
      name: `${input.channel.toLowerCase()}-${Date.now()}`,
      status: input.status ?? "APPROVED",
      content: input.body ?? "Hello {{guardianName}}",
      providerTemplateName: input.providerTemplateName ?? null,
      providerTemplateId: input.providerTemplateId ?? null,
      variablesJson: input.variablesJson ?? ["guardianName"],
    },
  });
}

async function ensureActiveSubscription() {
  const existing = await prisma.reportLabSubscription.findUnique({ where: { schoolId } });
  if (existing) {
    await prisma.reportLabSubscription.update({
      where: { schoolId },
      data: { status: "ACTIVE", currentPeriodEnd: new Date("2030-01-01T00:00:00.000Z") },
    });
    return;
  }
  await prisma.reportLabSubscription.create({
    data: {
      schoolId,
      planCode: "REPORT_LAB_1000",
      billingCycle: "YEAR",
      status: "ACTIVE",
      currentPeriodStart: new Date("2026-01-01T00:00:00.000Z"),
      currentPeriodEnd: new Date("2030-01-01T00:00:00.000Z"),
      studentLimit: 1000,
    },
  });
}

function yoolaSuccessBody(overrides: Record<string, unknown> = {}) {
  return {
    status: "success",
    code: 200,
    message_id: 987654321,
    sender_used: "YOOLA",
    successful: 1,
    failed: 0,
    credits_used: 1,
    credits_refunded: 0,
    amount_charged: 35,
    message_parts: 1,
    balance: 1200,
    per_recipient: [
      {
        number: "256774549869",
        status: "Success",
        statusCode: 100,
        reference: "yoola-ref-123",
      },
    ],
    ...overrides,
  };
}

describe("communication outbound routes", () => {
  it("lets admins list communication templates for their school", async () => {
    await createTemplate({ channel: "SMS", body: "Hello {{guardianName}}" });
    await prisma.communicationTemplate.create({
      data: {
        schoolId: otherSchoolId,
        channel: "SMS",
        communicationType: "ANNOUNCEMENT" as never,
        name: `other-list-sms-${Date.now()}`,
        status: "APPROVED",
        content: "Other school only",
        variablesJson: [],
      },
    });

    const res = await request(createServer())
      .get("/api/communications/templates")
      .set("Authorization", auth(adminToken));

    expect(res.status).toBe(200);
    expect(res.body.templates).toHaveLength(1);
    expect(res.body.templates[0]).toMatchObject({
      channel: "SMS",
      communicationType: "ANNOUNCEMENT",
      status: "APPROVED",
    });
  });

  it("lets admins create an approved SMS announcement template and extracts variables", async () => {
    const res = await request(createServer())
      .post("/api/communications/templates")
      .set("Authorization", auth(adminToken))
      .send({
        channel: "SMS",
        communicationType: "ANNOUNCEMENT",
        name: "sms-announcement-default",
        status: "APPROVED",
        content: "Hello {{guardianName}}, {{schoolName}}: {{communicationTitle}}. {{message}}",
      });

    expect(res.status).toBe(200);
    expect(res.body.template).toMatchObject({
      channel: "SMS",
      communicationType: "ANNOUNCEMENT",
      name: "sms-announcement-default",
      status: "APPROVED",
      languageCode: "en",
      variables: ["guardianName", "schoolName", "communicationTitle", "message"],
    });
    await expect(prisma.communicationTemplate.count({ where: { schoolId, name: "sms-announcement-default" } })).resolves.toBe(1);
    await expect(prisma.auditLog.findFirst({ where: { schoolId, action: "communication.template.upsert" } })).resolves.toBeTruthy();
  });

  it("prevents teachers from managing communication templates", async () => {
    const listRes = await request(createServer())
      .get("/api/communications/templates")
      .set("Authorization", auth(teacherToken));
    const saveRes = await request(createServer())
      .post("/api/communications/templates")
      .set("Authorization", auth(teacherToken))
      .send({
        channel: "SMS",
        communicationType: "ANNOUNCEMENT",
        name: "teacher-template",
        status: "APPROVED",
        content: "Hello {{guardianName}}",
      });

    expect(listRes.status).toBe(403);
    expect(saveRes.status).toBe(403);
  });

  it("upserts templates inside the authenticated school scope only", async () => {
    await request(createServer())
      .post("/api/communications/templates")
      .set("Authorization", auth(adminToken))
      .send({
        channel: "SMS",
        communicationType: "ANNOUNCEMENT",
        name: "shared-template-name",
        status: "APPROVED",
        content: "School A {{guardianName}}",
      });
    await request(createServer())
      .post("/api/communications/templates")
      .set("Authorization", auth(otherAdminToken))
      .send({
        channel: "SMS",
        communicationType: "ANNOUNCEMENT",
        name: "shared-template-name",
        status: "APPROVED",
        content: "School B {{guardianName}}",
      });

    const schoolA = await request(createServer())
      .get("/api/communications/templates")
      .set("Authorization", auth(adminToken));
    const schoolB = await request(createServer())
      .get("/api/communications/templates")
      .set("Authorization", auth(otherAdminToken));

    expect(schoolA.status).toBe(200);
    expect(schoolB.status).toBe(200);
    expect(schoolA.body.templates).toHaveLength(1);
    expect(schoolB.body.templates).toHaveLength(1);
    expect(schoolA.body.templates[0].content).toBe("School A {{guardianName}}");
    expect(schoolB.body.templates[0].content).toBe("School B {{guardianName}}");
  });

  it("returns the current persisted campaign status from the status endpoint", async () => {
    const campaignId = await createCampaign();
    const res = await request(createServer())
      .get(`/api/communications/campaigns/${campaignId}/status`)
      .set("Authorization", auth(adminToken));

    expect(res.status).toBe(200);
    expect(res.body.campaign.status).toBe("DRAFT");
  });

  it("submits a draft campaign for approval with validation details", async () => {
    const campaignId = await createCampaign(adminToken, {
      type: "ANNOUNCEMENT",
      title: "Approval flow",
      body: "Hello {{guardianName}}",
      audience: {
        audienceType: "PARENTS_OF_SELECTED_STUDENTS",
        studentIds: [studentId],
        channel: "SMS",
        mode: "GENERAL",
      },
    });

    const res = await request(createServer())
      .post(`/api/communications/campaigns/${campaignId}/request-approval`)
      .set("Authorization", auth(adminToken))
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.campaign.status).toBe("APPROVAL_PENDING");
    expect(res.body.validation.validRecipientCount).toBe(1);
    expect(res.body.validation.recipientCount).toBeGreaterThanOrEqual(1);
    expect(res.body.validation.segmentCount).toBe(1);
    expect(res.body.validation.estimatedBillableUnits).toBe(1);
  });

  it("keeps duplicate submit-for-approval requests idempotent", async () => {
    const campaignId = await createCampaign(adminToken, {
      type: "ANNOUNCEMENT",
      title: "Duplicate submit",
      body: "Hello {{guardianName}}",
      audience: {
        audienceType: "PARENTS_OF_SELECTED_STUDENTS",
        studentIds: [studentId],
        channel: "SMS",
        mode: "GENERAL",
      },
    });

    const first = await request(createServer())
      .post(`/api/communications/campaigns/${campaignId}/request-approval`)
      .set("Authorization", auth(adminToken))
      .send({});
    const second = await request(createServer())
      .post(`/api/communications/campaigns/${campaignId}/request-approval`)
      .set("Authorization", auth(adminToken))
      .send({});

    expect(first.status).toBe(200);
    expect(first.body.duplicate).toBe(false);
    expect(second.status).toBe(200);
    expect(second.body.duplicate).toBe(true);
    await expect(prisma.communicationApproval.count({ where: { campaignId } })).resolves.toBe(1);
  });

  it("rejects invalid or empty campaigns before approval submission", async () => {
    const campaignId = await createCampaign(adminToken, {
      type: "ANNOUNCEMENT",
      title: "Invalid approval flow",
      body: "Hello {{guardianName}}",
      audience: {
        audienceType: "PARENTS_OF_SELECTED_STUDENTS",
        studentIds: [studentId],
        channel: "SMS",
        mode: "GENERAL",
      },
    });
    const content = await prisma.communicationContent.findFirstOrThrow({ where: { campaignId } });
    await prisma.communicationContent.update({ where: { id: content.id }, data: { body: "" } });

    const res = await request(createServer())
      .post(`/api/communications/campaigns/${campaignId}/request-approval`)
      .set("Authorization", auth(adminToken))
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/message body is required/i);
  });

  it("denies sending to users without communications.send", async () => {
    const campaignId = await createCampaign();
    const res = await request(createServer())
      .post(`/api/communications/campaigns/${campaignId}/send`)
      .set("Authorization", auth(teacherToken))
      .send({ channel: "SMS", confirm: true, audience: { studentIds: [studentId], mode: "GENERAL" } });
    expect(res.status).toBe(403);
  });

  it("queues and sends live SMS without communication templates", async () => {
    const campaignId = await createCampaign();
    await prisma.communicationCampaign.update({ where: { id: campaignId }, data: { status: "APPROVED" } });
    await ensureActiveSubscription();
    vi.stubEnv("COMMUNICATION_DRY_RUN", "false");
    vi.stubEnv("SMS_PROVIDER", "yoola");
    vi.stubEnv("SMS_PROVIDER_ENABLED", "true");
    vi.stubEnv("SMS_API_KEY", "live-yoola-key");
    vi.stubEnv("SMS_SENDER_ID", "");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(yoolaSuccessBody()), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));

    const queueRes = await request(createServer())
      .post(`/api/communications/campaigns/${campaignId}/queue`)
      .set("Authorization", auth(adminToken))
      .send({ channels: ["SMS"] });
    expect(queueRes.status).toBe(200);

    await prisma.communicationRecipient.updateMany({ where: { schoolId, campaignId }, data: { status: "READY" } });
    await prisma.communicationCampaign.update({ where: { id: campaignId }, data: { status: "APPROVED" } });
    const sendRes = await request(createServer())
      .post(`/api/communications/campaigns/${campaignId}/send`)
      .set("Authorization", auth(adminToken))
      .send({ channel: "SMS", confirm: true, audience: { studentIds: [studentId], mode: "GENERAL" } });
    expect(sendRes.status).toBe(200);
    expect(sendRes.body.result.submitted).toBe(1);
    expect(sendRes.body.result.templatePolicy.policyStatus).toBe("DIRECT_MESSAGE");
    expect(fetchMock).toHaveBeenCalled();
  });

  it("allows live WhatsApp sends without communication templates", async () => {
    const campaignId = await createCampaign();
    await prisma.communicationCampaign.update({ where: { id: campaignId }, data: { status: "APPROVED" } });
    await ensureActiveSubscription();
    vi.stubEnv("COMMUNICATION_DRY_RUN", "false");
    vi.stubEnv("WHATSAPP_PROVIDER_ENABLED", "true");
    vi.stubEnv("WHATSAPP_META_ACCESS_TOKEN", "token-secret");
    vi.stubEnv("WHATSAPP_META_PHONE_NUMBER_ID", "phone-1");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ messages: [{ id: "wamid.approved" }] }),
    } as Response);

    const res = await request(createServer())
      .post(`/api/communications/campaigns/${campaignId}/send`)
      .set("Authorization", auth(adminToken))
      .send({ channel: "WHATSAPP", confirm: true, audience: { studentIds: [studentId], mode: "GENERAL" } });

    expect(res.status).toBe(200);
    expect(res.body.result.templatePolicy.policyStatus).toBe("DIRECT_MESSAGE");
    expect(res.body.result.submitted).toBe(1);
    expect(fetchMock).toHaveBeenCalled();
  });

  it("uses the campaign body for live SMS when no explicit direct message is supplied", async () => {
    const campaignId = await createCampaign();
    await prisma.communicationCampaign.update({ where: { id: campaignId }, data: { status: "APPROVED" } });
    await ensureActiveSubscription();
    vi.stubEnv("COMMUNICATION_DRY_RUN", "false");
    vi.stubEnv("SMS_PROVIDER", "yoola");
    vi.stubEnv("SMS_PROVIDER_ENABLED", "true");
    vi.stubEnv("SMS_API_KEY", "live-yoola-key");
    vi.stubEnv("SMS_SENDER_ID", "");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(yoolaSuccessBody()), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));

    const res = await request(createServer())
      .post(`/api/communications/campaigns/${campaignId}/send`)
      .set("Authorization", auth(adminToken))
      .send({ channel: "SMS", confirm: true, audience: { studentIds: [studentId], mode: "GENERAL" } });

    expect(res.status).toBe(200);
    expect(res.body.result.submitted).toBe(1);
    expect(res.body.result.templatePolicy.policyStatus).toBe("DIRECT_MESSAGE");
    const requestBody = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string);
    expect(requestBody.message).toBe("Hello Test Guardian");
    expect(requestBody.message).not.toBe("Test SMS from School Connect");
  });

  it("uses a direct SMS message when one is supplied", async () => {
    const campaignId = await createCampaign();
    await prisma.communicationCampaign.update({ where: { id: campaignId }, data: { status: "APPROVED" } });
    await ensureActiveSubscription();
    vi.stubEnv("COMMUNICATION_DRY_RUN", "false");
    vi.stubEnv("SMS_PROVIDER", "yoola");
    vi.stubEnv("SMS_PROVIDER_ENABLED", "true");
    vi.stubEnv("SMS_API_KEY", "live-yoola-key");
    vi.stubEnv("SMS_SENDER_ID", "");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(yoolaSuccessBody()), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));

    const res = await request(createServer())
      .post(`/api/communications/campaigns/${campaignId}/send`)
      .set("Authorization", auth(adminToken))
      .send({ channel: "SMS", confirm: true, message: "Direct SMS body", audience: { studentIds: [studentId], mode: "GENERAL" } });

    expect(res.status).toBe(200);
    const requestBody = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string);
    expect(requestBody.message).toBe("Direct SMS body");
  });

  it("sends live messages without validating template variables", async () => {
    const campaignId = await createCampaign();
    await prisma.communicationCampaign.update({ where: { id: campaignId }, data: { status: "APPROVED" } });
    await ensureActiveSubscription();
    const content = await prisma.communicationContent.findFirst({ where: { campaignId } });
    expect(content).toBeTruthy();
    if (content) {
      await prisma.communicationContent.update({ where: { id: content.id }, data: { body: "Hello {{guardianName}} {{unexpectedVar}}" } });
    }
    vi.stubEnv("COMMUNICATION_DRY_RUN", "false");
    vi.stubEnv("WHATSAPP_PROVIDER_ENABLED", "true");
    vi.stubEnv("WHATSAPP_META_ACCESS_TOKEN", "token-secret");
    vi.stubEnv("WHATSAPP_META_PHONE_NUMBER_ID", "phone-1");
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ messages: [{ id: "wamid.variables-not-validated" }] }),
    } as Response);

    const res = await request(createServer())
      .post(`/api/communications/campaigns/${campaignId}/send`)
      .set("Authorization", auth(adminToken))
      .send({ channel: "WHATSAPP", confirm: true, audience: { studentIds: [studentId], mode: "GENERAL" } });

    expect(res.status).toBe(200);
    expect(res.body.result.submitted).toBe(1);
  });

  it("enforces the entitlement gate for live sends", async () => {
    const campaignId = await createCampaign();
    await prisma.communicationCampaign.update({ where: { id: campaignId }, data: { status: "APPROVED" } });
    await ensureActiveSubscription();
    await createTemplate({
      channel: "WHATSAPP",
      providerTemplateName: "parent_notice_v1",
      providerTemplateId: "tpl_123",
      variablesJson: ["guardianName"],
    });
    await prisma.reportLabSubscription.update({
      where: { schoolId },
      data: { status: "EXPIRED", currentPeriodEnd: new Date("2020-01-01T00:00:00.000Z") },
    });
    vi.stubEnv("COMMUNICATION_DRY_RUN", "false");
    vi.stubEnv("WHATSAPP_PROVIDER_ENABLED", "true");
    vi.stubEnv("WHATSAPP_META_ACCESS_TOKEN", "token-secret");
    vi.stubEnv("WHATSAPP_META_PHONE_NUMBER_ID", "phone-1");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ messages: [{ id: "wamid.entitlement-bypassed" }] }),
    } as Response);

    const res = await request(createServer())
      .post(`/api/communications/campaigns/${campaignId}/send`)
      .set("Authorization", auth(adminToken))
      .send({ channel: "WHATSAPP", confirm: true, audience: { studentIds: [studentId], mode: "GENERAL" } });

    expect(res.status).toBe(402);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("blocks draft campaigns from direct send", async () => {
    const campaignId = await createCampaign();
    vi.stubEnv("COMMUNICATION_DRY_RUN", "true");
    const body = { channel: "SMS", confirm: true, audience: { studentIds: [studentId], mode: "GENERAL" } };
    const res = await request(createServer()).post(`/api/communications/campaigns/${campaignId}/send`).set("Authorization", auth(adminToken)).send(body);

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Only approved campaigns can be sent/i);
  });

  it("allows an approver to approve a pending campaign", async () => {
    const campaignId = await createCampaign(adminToken, {
      type: "ANNOUNCEMENT",
      title: "Approver flow",
      body: "Hello {{guardianName}}",
      audience: {
        audienceType: "PARENTS_OF_SELECTED_STUDENTS",
        studentIds: [studentId],
        channel: "SMS",
        mode: "GENERAL",
      },
    });
    await request(createServer())
      .post(`/api/communications/campaigns/${campaignId}/request-approval`)
      .set("Authorization", auth(adminToken))
      .send({});

    const res = await request(createServer())
      .post(`/api/communications/campaigns/${campaignId}/approve`)
      .set("Authorization", auth(adminToken))
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.campaign.status).toBe("APPROVED");
  });

  it("prevents unauthorized users from approving pending campaigns", async () => {
    const campaignId = await createCampaign(adminToken, {
      type: "ANNOUNCEMENT",
      title: "Approval auth",
      body: "Hello {{guardianName}}",
      audience: {
        audienceType: "PARENTS_OF_SELECTED_STUDENTS",
        studentIds: [studentId],
        channel: "SMS",
        mode: "GENERAL",
      },
    });
    await request(createServer())
      .post(`/api/communications/campaigns/${campaignId}/request-approval`)
      .set("Authorization", auth(adminToken))
      .send({});

    const res = await request(createServer())
      .post(`/api/communications/campaigns/${campaignId}/approve`)
      .set("Authorization", auth(teacherToken))
      .send({});

    expect(res.status).toBe(403);
  });

  it("returns approved campaigns to draft when approved content is edited", async () => {
    const campaignId = await createCampaign(adminToken, {
      type: "ANNOUNCEMENT",
      title: "Edit resets approval",
      body: "Hello {{guardianName}}",
      audience: {
        audienceType: "PARENTS_OF_SELECTED_STUDENTS",
        studentIds: [studentId],
        channel: "SMS",
        mode: "GENERAL",
      },
    });
    await request(createServer())
      .post(`/api/communications/campaigns/${campaignId}/request-approval`)
      .set("Authorization", auth(adminToken))
      .send({});
    await request(createServer())
      .post(`/api/communications/campaigns/${campaignId}/approve`)
      .set("Authorization", auth(adminToken))
      .send({});

    const res = await request(createServer())
      .patch(`/api/communications/campaigns/${campaignId}`)
      .set("Authorization", auth(adminToken))
      .send({ body: "Updated {{guardianName}}" });

    expect(res.status).toBe(200);
    expect(res.body.campaign.status).toBe("DRAFT");
    const campaign = await prisma.communicationCampaign.findUniqueOrThrow({ where: { id: campaignId } });
    expect(campaign.approvedAt).toBeNull();
    expect(campaign.approvedByUserId).toBeNull();
  });

  it("creates dry-run delivery rows and prevents duplicate sends without live provider credentials", async () => {
    const campaignId = await createCampaign();
    await prisma.communicationCampaign.update({ where: { id: campaignId }, data: { status: "APPROVED" } });
    vi.stubEnv("COMMUNICATION_DRY_RUN", "true");
    const body = { channel: "SMS", confirm: true, audience: { studentIds: [studentId], mode: "GENERAL" } };

    const first = await request(createServer()).post(`/api/communications/campaigns/${campaignId}/send`).set("Authorization", auth(adminToken)).send(body);
    expect(first.status).toBe(200);
    expect(first.body.result.submitted).toBe(1);
    expect(first.body.result.dryRun).toBe(true);
    const deliveriesAfterFirst = await prisma.communicationDelivery.findMany({ where: { schoolId, campaignId } });
    expect(deliveriesAfterFirst).toHaveLength(1);
    expect(deliveriesAfterFirst[0]?.provider).toBe("DRY_RUN");
    expect(deliveriesAfterFirst[0]?.providerMessageId).toMatch(/^dry-run-/);
    expect(deliveriesAfterFirst[0]?.status).toBe("SUBMITTED");
    await expect(prisma.communicationCampaign.findUniqueOrThrow({ where: { id: campaignId } })).resolves.toMatchObject({
      status: "SENDING",
    });

    const second = await request(createServer()).post(`/api/communications/campaigns/${campaignId}/send`).set("Authorization", auth(adminToken)).send(body);
    expect(second.status).toBe(200);
    expect(second.body.result.submitted).toBe(0);
    expect(second.body.result.skippedDuplicate).toBe(1);
    expect(second.body.result.templatePolicy.policyStatus).toBe("DIRECT_MESSAGE");
    await expect(prisma.communicationDelivery.count({ where: { schoolId, campaignId } })).resolves.toBe(1);

    await prisma.communicationCampaign.update({ where: { id: campaignId }, data: { status: "APPROVED" } });
    const queueRes = await request(createServer())
      .post(`/api/communications/campaigns/${campaignId}/queue`)
      .set("Authorization", auth(adminToken))
      .send({ channels: ["SMS"] });
    expect(queueRes.status).toBe(200);
    expect(queueRes.body.ok).toBe(true);
    expect(queueRes.body.dryRun).toBe(true);
  });

  it("fails clearly when the live Yoola provider is still disabled", async () => {
    const campaignId = await createCampaign();
    await prisma.communicationCampaign.update({ where: { id: campaignId }, data: { status: "APPROVED" } });
    await ensureActiveSubscription();
    vi.stubEnv("COMMUNICATION_DRY_RUN", "false");
    vi.stubEnv("SMS_PROVIDER", "yoola");
    vi.stubEnv("SMS_PROVIDER_ENABLED", "false");

    const res = await request(createServer())
      .post(`/api/communications/campaigns/${campaignId}/send`)
      .set("Authorization", auth(adminToken))
      .send({ channel: "SMS", confirm: true, audience: { studentIds: [studentId], mode: "GENERAL" } });

    expect(res.status).toBe(500);
    expect(res.body.message).toMatch(/SMS_PROVIDER_DISABLED/i);
  });

  it("marks live SMS deliveries failed when the provider crashes after rows are opened", async () => {
    const campaignId = await createCampaign();
    await prisma.communicationCampaign.update({ where: { id: campaignId }, data: { status: "APPROVED" } });
    await ensureActiveSubscription();
    await createTemplate({ channel: "SMS" });
    vi.stubEnv("COMMUNICATION_DRY_RUN", "false");
    vi.stubEnv("SMS_PROVIDER", "yoola");
    vi.stubEnv("SMS_PROVIDER_ENABLED", "true");
    vi.stubEnv("SMS_API_KEY", "live-yoola-key");
    vi.stubEnv("SMS_SENDER_ID", "");
    vi.stubGlobal("AbortController", class {
      constructor() {
        throw new Error("provider unavailable");
      }
    });

    const res = await request(createServer())
      .post(`/api/communications/campaigns/${campaignId}/send`)
      .set("Authorization", auth(adminToken))
      .send({ channel: "SMS", confirm: true, audience: { studentIds: [studentId], mode: "GENERAL" } });

    expect(res.status).toBe(200);
    expect(res.body.result.submitted).toBe(0);
    expect(res.body.result.failed).toBe(1);
    expect(res.body.result.progress).toMatchObject({ SENT: 0, FAILED: 1 });
    await expect(prisma.communicationDelivery.findFirstOrThrow({ where: { schoolId, campaignId } })).resolves.toMatchObject({
      status: "FAILED",
      lastErrorCode: "PROVIDER_BATCH_ERROR",
    });
    await expect(prisma.communicationCampaign.findUniqueOrThrow({ where: { id: campaignId } })).resolves.toMatchObject({
      status: "FAILED",
    });

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const processed = await processPendingSmsDeliveries(prisma);
    expect(processed.processed).toBe(0);
    expect(logSpy).not.toHaveBeenCalledWith("Processing SMS deliveries...");
    expect(logSpy).not.toHaveBeenCalledWith("Pending:", 0);
    logSpy.mockRestore();
  });

  it("prevents duplicate live Yoola sends after the first accepted submission", async () => {
    const campaignId = await createCampaign();
    await prisma.communicationCampaign.update({ where: { id: campaignId }, data: { status: "APPROVED" } });
    await ensureActiveSubscription();
    await createTemplate({ channel: "SMS" });
    vi.stubEnv("COMMUNICATION_DRY_RUN", "false");
    vi.stubEnv("SMS_PROVIDER", "yoola");
    vi.stubEnv("SMS_PROVIDER_ENABLED", "true");
    vi.stubEnv("SMS_API_KEY", "live-yoola-key");
    vi.stubEnv("SMS_SENDER_ID", "");
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(yoolaSuccessBody()), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));

    const first = await request(createServer())
      .post(`/api/communications/campaigns/${campaignId}/send`)
      .set("Authorization", auth(adminToken))
      .send({ channel: "SMS", confirm: true, audience: { studentIds: [studentId], mode: "GENERAL" } });
    const second = await request(createServer())
      .post(`/api/communications/campaigns/${campaignId}/send`)
      .set("Authorization", auth(adminToken))
      .send({ channel: "SMS", confirm: true, audience: { studentIds: [studentId], mode: "GENERAL" } });

    expect(first.status).toBe(200);
    expect(first.body.result.submitted).toBe(1);
    expect(second.status).toBe(200);
    expect(second.body.result.submitted).toBe(0);
    expect(second.body.result.skippedDuplicate).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await expect(prisma.communicationDelivery.findFirstOrThrow({ where: { schoolId, campaignId } })).resolves.toMatchObject({
      providerMessageId: "yoola-ref-123",
      status: "SUBMITTED",
    });
    await expect(prisma.communicationCampaign.findUniqueOrThrow({ where: { id: campaignId } })).resolves.toMatchObject({
      status: "SENDING",
    });
    expect(first.body.result.progress).toMatchObject({ SENT: 1, DELIVERED: 0, FAILED: 0 });
    await expect(prisma.communicationUsageRecord.findFirstOrThrow({ where: { schoolId, campaignId } })).resolves.toMatchObject({
      billableUnits: 1,
      providerCostMinor: 35,
      unitType: "SEGMENT",
    });
  });

  it("keeps a partial Yoola failure out of SENT and preserves accepted deliveries as provider-accepted only", async () => {
    const secondStudent = await prisma.student.upsert({
      where: { schoolId_admissionNumber: { schoolId, admissionNumber: "COMM-002" } },
      update: { firstName: "Pam", lastName: "Partial", isActive: true },
      create: { schoolId, admissionNumber: "COMM-002", firstName: "Pam", lastName: "Partial", isActive: true },
    });
    await prisma.guardianContact.upsert({
      where: { studentId_guardianName_relationship: { studentId: secondStudent.id, guardianName: "Second Guardian", relationship: "Parent" } },
      update: { phone: "0774549870", canReceiveReports: true, preferredContactMethod: "SMS" },
      create: { schoolId, studentId: secondStudent.id, guardianName: "Second Guardian", relationship: "Parent", phone: "0774549870", canReceiveReports: true, preferredContactMethod: "SMS" },
    });
    const campaignId = await createCampaign();
    await prisma.communicationCampaign.update({ where: { id: campaignId }, data: { status: "APPROVED" } });
    await ensureActiveSubscription();
    await createTemplate({ channel: "SMS" });
    vi.stubEnv("COMMUNICATION_DRY_RUN", "false");
    vi.stubEnv("SMS_PROVIDER", "yoola");
    vi.stubEnv("SMS_PROVIDER_ENABLED", "true");
    vi.stubEnv("SMS_API_KEY", "live-yoola-key");
    vi.stubEnv("SMS_SENDER_ID", "");
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify(yoolaSuccessBody()), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        status: "failed",
        code: 400,
        failed: 1,
        per_recipient: [{ number: "256774549870", status: "Failed", statusCode: 422 }],
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }));

    const res = await request(createServer())
      .post(`/api/communications/campaigns/${campaignId}/send`)
      .set("Authorization", auth(adminToken))
      .send({
        channel: "SMS",
        confirm: true,
        audience: {
          audienceType: "PARENTS_OF_SELECTED_STUDENTS",
          studentIds: [studentId, secondStudent.id],
          mode: "GENERAL",
        },
      });

    expect(res.status).toBe(200);
    expect(res.body.result.submitted).toBe(1);
    expect(res.body.result.failed).toBe(1);
    await expect(prisma.communicationCampaign.findUniqueOrThrow({ where: { id: campaignId } })).resolves.toMatchObject({
      status: "PARTIALLY_DELIVERED",
    });
    const deliveries = await prisma.communicationDelivery.findMany({ where: { schoolId, campaignId }, orderBy: { createdAt: "asc" } });
    expect(deliveries.map((delivery) => delivery.status).sort()).toEqual(["FAILED", "SUBMITTED"]);
    expect(deliveries.some((delivery) => delivery.status === "DELIVERED")).toBe(false);
  });

  it("promotes submitted SMS deliveries to delivered and completes the campaign asynchronously", async () => {
    const campaignId = await createCampaign();
    await prisma.communicationCampaign.update({ where: { id: campaignId }, data: { status: "APPROVED" } });
    await ensureActiveSubscription();
    await createTemplate({ channel: "SMS" });
    vi.stubEnv("COMMUNICATION_DRY_RUN", "false");
    vi.stubEnv("SMS_PROVIDER", "yoola");
    vi.stubEnv("SMS_PROVIDER_ENABLED", "true");
    vi.stubEnv("SMS_API_KEY", "live-yoola-key");
    vi.stubEnv("SMS_SENDER_ID", "");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(yoolaSuccessBody()), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));

    const send = await request(createServer())
      .post(`/api/communications/campaigns/${campaignId}/send`)
      .set("Authorization", auth(adminToken))
      .send({ channel: "SMS", confirm: true, audience: { studentIds: [studentId], mode: "GENERAL" } });

    expect(send.status).toBe(200);
    await expect(prisma.communicationCampaign.findUniqueOrThrow({ where: { id: campaignId } })).resolves.toMatchObject({
      status: "SENDING",
    });

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const processed = await processPendingSmsDeliveries(prisma);

    expect(processed.processed).toBe(1);
    expect(logSpy).toHaveBeenCalledWith("Processing SMS deliveries...");
    expect(logSpy).toHaveBeenCalledWith("Pending:", 1);
    expect(logSpy).toHaveBeenCalledWith("Processed SMS deliveries:", 1);
    logSpy.mockRestore();
    await expect(prisma.communicationDelivery.findFirstOrThrow({ where: { schoolId, campaignId } })).resolves.toMatchObject({
      status: "DELIVERED",
    });
    await expect(prisma.communicationCampaign.findUniqueOrThrow({ where: { id: campaignId } })).resolves.toMatchObject({
      status: "DELIVERED",
    });
  });

  it("returns normalized campaign progress totals", async () => {
    const campaignId = await createCampaign();
    const snapshot = await prisma.communicationAudienceSnapshot.create({ data: { campaignId, snapshotVersion: 1, recipientCount: 5 } });
    const recipientIds = [];
    for (let index = 0; index < 5; index += 1) {
      const recipient = await prisma.communicationRecipient.create({
        data: {
          schoolId,
          campaignId,
          audienceSnapshotId: snapshot.id,
          displayName: `Progress ${index}`,
          phoneE164: `+25677454986${index}`,
          status: "QUEUED",
        },
      });
      recipientIds.push(recipient.id);
    }
    await prisma.communicationDelivery.createMany({
      data: [
        { schoolId, campaignId, recipientId: recipientIds[0]!, channel: "SMS", provider: "YOOLA_SMS", status: "QUEUED", contentVersion: 1, idempotencyKey: `${campaignId}-queued` },
        { schoolId, campaignId, recipientId: recipientIds[1]!, channel: "SMS", provider: "YOOLA_SMS", status: "SUBMITTING", contentVersion: 1, idempotencyKey: `${campaignId}-processing` },
        { schoolId, campaignId, recipientId: recipientIds[2]!, channel: "SMS", provider: "YOOLA_SMS", status: "SUBMITTED", contentVersion: 1, idempotencyKey: `${campaignId}-sent` },
        { schoolId, campaignId, recipientId: recipientIds[3]!, channel: "SMS", provider: "YOOLA_SMS", status: "DELIVERED", contentVersion: 1, idempotencyKey: `${campaignId}-delivered` },
        { schoolId, campaignId, recipientId: recipientIds[4]!, channel: "SMS", provider: "YOOLA_SMS", status: "FAILED", contentVersion: 1, idempotencyKey: `${campaignId}-failed` },
      ] as never[],
    });

    const res = await request(createServer())
      .get(`/api/communications/campaigns/${campaignId}/status`)
      .set("Authorization", auth(adminToken));

    expect(res.status).toBe(200);
    expect(res.body.progress).toEqual({
      QUEUED: 1,
      PROCESSING: 1,
      SENT: 1,
      DELIVERED: 1,
      FAILED: 1,
    });
  });

  it("keeps submitted SMS campaigns sending until the delivery worker completes them", async () => {
    expect(determinePostSendCampaignStatus("APPROVED", 1, 0)).toBe("SENDING");

    const campaignId = await createCampaign();
    await prisma.communicationCampaign.update({ where: { id: campaignId }, data: { status: "SENDING" } });
    const snapshot = await prisma.communicationAudienceSnapshot.create({ data: { campaignId, snapshotVersion: 1, recipientCount: 1 } });
    const recipient = await prisma.communicationRecipient.create({
      data: {
        schoolId,
        campaignId,
        audienceSnapshotId: snapshot.id,
        displayName: "Worker Parent",
        phoneE164: "+256774549869",
        status: "QUEUED",
      },
    });
    const delivery = await prisma.communicationDelivery.create({
      data: {
        schoolId,
        campaignId,
        recipientId: recipient.id,
        channel: "SMS",
        provider: "YOOLA_SMS",
        status: "SUBMITTED",
        submittedAt: new Date("2026-07-18T09:00:00.000Z"),
        contentVersion: 1,
        idempotencyKey: `${campaignId}-submitted`,
        providerMessageId: "worker-message-1",
      },
    });

    await expect(processPendingSmsDeliveries(prisma)).resolves.toEqual({ processed: 1 });
    await expect(prisma.communicationDelivery.findUniqueOrThrow({ where: { id: delivery.id } })).resolves.toMatchObject({
      status: "DELIVERED",
    });
    await expect(prisma.communicationCampaign.findUniqueOrThrow({ where: { id: campaignId } })).resolves.toMatchObject({
      status: "DELIVERED",
    });
  });

  it("blocks cross-school reads as not found", async () => {
    const otherCampaign = await prisma.communicationCampaign.create({
      data: { schoolId: otherSchoolId, type: "ANNOUNCEMENT", title: "Other school", contents: { create: { version: 1, body: "No leak" } } },
    });
    const res = await request(createServer())
      .get(`/api/communications/campaigns/${otherCampaign.id}`)
      .set("Authorization", auth(adminToken));
    expect(res.status).toBe(404);
  });

  it("updates WhatsApp delivery status from webhook provider id", async () => {
    const campaignId = await createCampaign();
    const snapshot = await prisma.communicationAudienceSnapshot.create({ data: { campaignId, snapshotVersion: 1, recipientCount: 1 } });
    const recipient = await prisma.communicationRecipient.create({
      data: {
        schoolId,
        campaignId,
        audienceSnapshotId: snapshot.id,
        displayName: "Test Guardian",
        phoneE164: "+256774549869",
        status: "READY",
      },
    });
    const delivery = await prisma.communicationDelivery.create({
      data: {
        schoolId,
        campaignId,
        recipientId: recipient.id,
        channel: "WHATSAPP",
        provider: "META_CLOUD_WHATSAPP",
        status: "SUBMITTED",
        contentVersion: 1,
        idempotencyKey: `webhook-${campaignId}`,
        providerMessageId: `wamid.${campaignId}`,
      },
    });
    await persistAndProcessWhatsAppWebhook(prisma, Buffer.from("{}"), {
      entry: [{ changes: [{ value: { statuses: [{ id: `wamid.${campaignId}`, status: "read", timestamp: "1783910001" }] } }] }],
    });
    const updated = await prisma.communicationDelivery.findUniqueOrThrow({ where: { id: delivery.id } });
    expect(updated.status).toBe("READ");
    expect(updated.readAt).toBeTruthy();
  });
});
