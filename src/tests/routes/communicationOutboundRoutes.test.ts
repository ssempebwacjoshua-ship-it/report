import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createServer } from "../../server";
import { prisma } from "../../server/db/prisma";
import { hashPassword, signToken } from "../../server/services/authService";
import { persistAndProcessWhatsAppWebhook } from "../../server/services/whatsappWebhookService";

let adminToken = "";
let teacherToken = "";
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
  adminToken = signToken({ userId: admin.id, schoolId, name: admin.name, email: admin.email, role: admin.role, tokenVersion: admin.tokenVersion });
  teacherToken = signToken({ userId: teacher.id, schoolId, name: teacher.name, email: teacher.email, role: teacher.role, tokenVersion: teacher.tokenVersion });

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

describe("communication outbound routes", () => {
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

  it("fails closed when live SMS is missing an approved template", async () => {
    const campaignId = await createCampaign();
    await prisma.communicationCampaign.update({ where: { id: campaignId }, data: { status: "APPROVED" } });
    await ensureActiveSubscription();
    vi.stubEnv("COMMUNICATION_DRY_RUN", "false");
    const res = await request(createServer())
      .post(`/api/communications/campaigns/${campaignId}/send`)
      .set("Authorization", auth(adminToken))
      .send({ channel: "SMS", confirm: true, audience: { studentIds: [studentId], mode: "GENERAL" } });
    expect(res.status).toBe(402);
    expect(res.body.message).toMatch(/approved communication template/i);
  });

  it("blocks queueing and sending live campaigns without an approved template", async () => {
    const campaignId = await createCampaign();
    await prisma.communicationCampaign.update({ where: { id: campaignId }, data: { status: "APPROVED" } });
    await ensureActiveSubscription();
    vi.stubEnv("COMMUNICATION_DRY_RUN", "false");

    const queueRes = await request(createServer())
      .post(`/api/communications/campaigns/${campaignId}/queue`)
      .set("Authorization", auth(adminToken))
      .send({ channels: ["SMS"] });
    expect(queueRes.status).toBe(402);
    expect(queueRes.body.message).toMatch(/approved communication template/i);

    const sendRes = await request(createServer())
      .post(`/api/communications/campaigns/${campaignId}/send`)
      .set("Authorization", auth(adminToken))
      .send({ channel: "SMS", confirm: true, audience: { studentIds: [studentId], mode: "GENERAL" } });
    expect(sendRes.status).toBe(402);
    expect(sendRes.body.message).toMatch(/approved communication template/i);
  });

  it("blocks live WhatsApp sends without an approved provider template", async () => {
    const campaignId = await createCampaign();
    await prisma.communicationCampaign.update({ where: { id: campaignId }, data: { status: "APPROVED" } });
    await ensureActiveSubscription();
    await createTemplate({
      channel: "WHATSAPP",
      status: "DRAFT",
      providerTemplateName: null,
      providerTemplateId: null,
    });
    vi.stubEnv("COMMUNICATION_DRY_RUN", "false");
    vi.stubEnv("WHATSAPP_PROVIDER_ENABLED", "true");
    vi.stubEnv("WHATSAPP_META_ACCESS_TOKEN", "token-secret");
    vi.stubEnv("WHATSAPP_META_PHONE_NUMBER_ID", "phone-1");

    const res = await request(createServer())
      .post(`/api/communications/campaigns/${campaignId}/send`)
      .set("Authorization", auth(adminToken))
      .send({ channel: "WHATSAPP", confirm: true, audience: { studentIds: [studentId], mode: "GENERAL" } });

    expect(res.status).toBe(402);
    expect(res.body.message).toMatch(/approved communication template/i);
  });

  it("allows live WhatsApp sends only with approved provider template metadata", async () => {
    const campaignId = await createCampaign();
    await prisma.communicationCampaign.update({ where: { id: campaignId }, data: { status: "APPROVED" } });
    await ensureActiveSubscription();
    await createTemplate({
      channel: "WHATSAPP",
      providerTemplateName: "parent_notice_v1",
      providerTemplateId: "tpl_123",
      variablesJson: ["guardianName"],
    });
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
    expect(res.body.result.templatePolicy.policyStatus).toBe("APPROVED_TEMPLATE_BOUND");
    expect(res.body.result.submitted).toBe(1);
    expect(fetchMock).toHaveBeenCalled();
  });

  it("blocks live SMS sends without an approved template or policy", async () => {
    const campaignId = await createCampaign();
    await prisma.communicationCampaign.update({ where: { id: campaignId }, data: { status: "APPROVED" } });
    await ensureActiveSubscription();
    vi.stubEnv("COMMUNICATION_DRY_RUN", "false");
    vi.stubEnv("SMS_PROVIDER", "yoola");
    vi.stubEnv("SMS_PROVIDER_ENABLED", "true");

    const res = await request(createServer())
      .post(`/api/communications/campaigns/${campaignId}/send`)
      .set("Authorization", auth(adminToken))
      .send({ channel: "SMS", confirm: true, audience: { studentIds: [studentId], mode: "GENERAL" } });

    expect(res.status).toBe(402);
    expect(res.body.message).toMatch(/approved communication template/i);
  });

  it("keeps SMS templates tenant-scoped", async () => {
    const campaignId = await createCampaign();
    await prisma.communicationCampaign.update({ where: { id: campaignId }, data: { status: "APPROVED" } });
    await ensureActiveSubscription();
    await prisma.communicationTemplate.create({
      data: {
        schoolId: otherSchoolId,
        channel: "SMS",
        communicationType: "ANNOUNCEMENT" as never,
        name: `other-school-sms-${Date.now()}`,
        status: "APPROVED",
        content: "Hello {{guardianName}}",
        variablesJson: ["guardianName"],
      },
    });
    vi.stubEnv("COMMUNICATION_DRY_RUN", "false");
    vi.stubEnv("SMS_PROVIDER", "yoola");
    vi.stubEnv("SMS_PROVIDER_ENABLED", "true");

    const res = await request(createServer())
      .post(`/api/communications/campaigns/${campaignId}/send`)
      .set("Authorization", auth(adminToken))
      .send({ channel: "SMS", confirm: true, audience: { studentIds: [studentId], mode: "GENERAL" } });

    expect(res.status).toBe(402);
    expect(res.body.message).toMatch(/approved communication template/i);
  });

  it("blocks live sends when template variables do not match the approved template", async () => {
    const campaignId = await createCampaign();
    await prisma.communicationCampaign.update({ where: { id: campaignId }, data: { status: "APPROVED" } });
    await ensureActiveSubscription();
    const content = await prisma.communicationContent.findFirst({ where: { campaignId } });
    expect(content).toBeTruthy();
    await createTemplate({
      channel: "WHATSAPP",
      providerTemplateName: "parent_notice_v1",
      providerTemplateId: "tpl_123",
      variablesJson: ["guardianName"],
      body: "Hello {{guardianName}} {{unexpectedVar}}",
    });
    if (content) {
      await prisma.communicationContent.update({ where: { id: content.id }, data: { body: "Hello {{guardianName}} {{unexpectedVar}}" } });
    }
    vi.stubEnv("COMMUNICATION_DRY_RUN", "false");
    vi.stubEnv("WHATSAPP_PROVIDER_ENABLED", "true");
    vi.stubEnv("WHATSAPP_META_ACCESS_TOKEN", "token-secret");
    vi.stubEnv("WHATSAPP_META_PHONE_NUMBER_ID", "phone-1");

    const res = await request(createServer())
      .post(`/api/communications/campaigns/${campaignId}/send`)
      .set("Authorization", auth(adminToken))
      .send({ channel: "WHATSAPP", confirm: true, audience: { studentIds: [studentId], mode: "GENERAL" } });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/message variables do not match/i);
  });

  it("keeps the entitlement gate ahead of live template checks", async () => {
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

    const res = await request(createServer())
      .post(`/api/communications/campaigns/${campaignId}/send`)
      .set("Authorization", auth(adminToken))
      .send({ channel: "WHATSAPP", confirm: true, audience: { studentIds: [studentId], mode: "GENERAL" } });

    expect(res.status).toBe(402);
    expect(res.body.message).toMatch(/communications are not enabled/i);
  });

  it("blocks draft campaigns from direct send", async () => {
    const campaignId = await createCampaign();
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
    const body = { channel: "SMS", confirm: true, audience: { studentIds: [studentId], mode: "GENERAL" } };

    const first = await request(createServer()).post(`/api/communications/campaigns/${campaignId}/send`).set("Authorization", auth(adminToken)).send(body);
    expect(first.status).toBe(200);
    expect(first.body.result.submitted).toBe(1);
    const deliveriesAfterFirst = await prisma.communicationDelivery.findMany({ where: { schoolId, campaignId } });
    expect(deliveriesAfterFirst).toHaveLength(1);
    expect(deliveriesAfterFirst[0]?.provider).toBe("DRY_RUN");
    expect(deliveriesAfterFirst[0]?.providerMessageId).toMatch(/^dry-run-/);

    const second = await request(createServer()).post(`/api/communications/campaigns/${campaignId}/send`).set("Authorization", auth(adminToken)).send(body);
    expect(second.status).toBe(200);
    expect(second.body.result.submitted).toBe(0);
    expect(second.body.result.skippedDuplicate).toBe(1);
    expect(second.body.result.templatePolicy.policyStatus).toBe("DRY_RUN_ONLY");
    expect(second.body.result.templatePolicy.note).toMatch(/approved template binding/i);
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
    await createTemplate({ channel: "SMS" });
    vi.stubEnv("COMMUNICATION_DRY_RUN", "false");
    vi.stubEnv("SMS_PROVIDER", "yoola");
    vi.stubEnv("SMS_PROVIDER_ENABLED", "false");

    const res = await request(createServer())
      .post(`/api/communications/campaigns/${campaignId}/send`)
      .set("Authorization", auth(adminToken))
      .send({ channel: "SMS", confirm: true, audience: { studentIds: [studentId], mode: "GENERAL" } });

    expect(res.status).toBe(503);
    expect(res.body.message).toMatch(/sms provider is not configured yet/i);
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
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
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
    }), {
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
    await expect(prisma.communicationUsageRecord.findFirstOrThrow({ where: { schoolId, campaignId } })).resolves.toMatchObject({
      billableUnits: 1,
      providerCostMinor: 35,
      unitType: "SEGMENT",
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
