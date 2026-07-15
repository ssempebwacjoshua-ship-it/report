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
  await prisma.auditLog.deleteMany({ where: { schoolId, action: { startsWith: "communication." } } });
});

async function createCampaign(token = adminToken) {
  const res = await request(createServer())
    .post("/api/communications/campaigns")
    .set("Authorization", auth(token))
    .send({ type: "ANNOUNCEMENT", title: "Outbound test", body: "Hello {{guardianName}}" });
  expect(res.status).toBe(201);
  return res.body.campaign.id as string;
}

describe("communication outbound routes", () => {
  it("denies sending to users without communications.send", async () => {
    const campaignId = await createCampaign();
    const res = await request(createServer())
      .post(`/api/communications/campaigns/${campaignId}/send`)
      .set("Authorization", auth(teacherToken))
      .send({ channel: "SMS", confirm: true, audience: { studentIds: [studentId], mode: "GENERAL" } });
    expect(res.status).toBe(403);
  });

  it("fails closed when SMS provider is disabled", async () => {
    const campaignId = await createCampaign();
    await prisma.communicationCampaign.update({ where: { id: campaignId }, data: { status: "APPROVED" } });
    vi.stubEnv("COMMUNICATION_DRY_RUN", "false");
    const res = await request(createServer())
      .post(`/api/communications/campaigns/${campaignId}/send`)
      .set("Authorization", auth(adminToken))
      .send({ channel: "SMS", confirm: true, audience: { studentIds: [studentId], mode: "GENERAL" } });
    expect(res.status).toBe(402);
    expect(res.body.message).toMatch(/communications are not enabled/i);
  });

  it("blocks queueing and sending live campaigns when communications are disabled", async () => {
    const campaignId = await createCampaign();
    await prisma.communicationCampaign.update({ where: { id: campaignId }, data: { status: "APPROVED" } });
    vi.stubEnv("COMMUNICATION_DRY_RUN", "false");

    const queueRes = await request(createServer())
      .post(`/api/communications/campaigns/${campaignId}/queue`)
      .set("Authorization", auth(adminToken))
      .send({ channels: ["SMS"] });
    expect(queueRes.status).toBe(402);
    expect(queueRes.body.message).toMatch(/communications are not enabled/i);

    const sendRes = await request(createServer())
      .post(`/api/communications/campaigns/${campaignId}/send`)
      .set("Authorization", auth(adminToken))
      .send({ channel: "SMS", confirm: true, audience: { studentIds: [studentId], mode: "GENERAL" } });
    expect(sendRes.status).toBe(402);
    expect(sendRes.body.message).toMatch(/communications are not enabled/i);
  });

  it("blocks draft campaigns from direct send", async () => {
    const campaignId = await createCampaign();
    const body = { channel: "SMS", confirm: true, audience: { studentIds: [studentId], mode: "GENERAL" } };
    const res = await request(createServer()).post(`/api/communications/campaigns/${campaignId}/send`).set("Authorization", auth(adminToken)).send(body);

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Only approved campaigns can be sent/i);
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
