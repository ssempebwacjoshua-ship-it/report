import { beforeEach, describe, expect, it, vi } from "vitest";

const { resolveSmsProviderMock } = vi.hoisted(() => ({
  resolveSmsProviderMock: vi.fn(),
}));

vi.mock("../../server/services/communicationProviders", async () => {
  const actual = await vi.importActual<typeof import("../../server/services/communicationProviders")>("../../server/services/communicationProviders");
  return {
    ...actual,
    resolveSmsProvider: resolveSmsProviderMock,
  };
});

import { notifyParentStudentPassOut } from "../../server/services/nfcPassOutNotificationService";

const GATE_CTX = { schoolId: "school-a", actorId: "gate-a" };

function createDb() {
  const campaigns: Array<Record<string, any>> = [];
  const audiences: Array<Record<string, any>> = [];
  const snapshots: Array<Record<string, any>> = [];
  const contents: Array<Record<string, any>> = [];
  const recipients: Array<Record<string, any>> = [];
  const deliveries: Array<Record<string, any>> = [];
  const attempts: Array<Record<string, any>> = [];
  const usageRecords: Array<Record<string, any>> = [];
  const audits: Array<Record<string, any>> = [];
  const school = { id: "school-a", name: "School Connect" };
  const student = {
    id: "student-a",
    schoolId: "school-a",
    firstName: "Ada",
    lastName: "Lovelace",
    guardianContacts: [
      {
        id: "guardian-1",
        schoolId: "school-a",
        studentId: "student-a",
        guardianName: "Parent Ada",
        relationship: "Mother",
        phone: "0774123456",
        email: null,
        preferredContactMethod: "SMS",
        isPrimary: true,
        canReceiveReports: true,
        createdAt: new Date("2026-07-18T07:00:00.000Z"),
      },
    ],
  };

  const db = {
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(db),
    school: {
      findUnique: async ({ where }: { where: { id: string } }) => where.id === "school-a" ? school : null,
    },
    student: {
      findFirst: async ({ where, include, select }: { where: Record<string, unknown>; include?: Record<string, unknown>; select?: Record<string, unknown> }) => {
        if (where.id !== "student-a" || where.schoolId !== "school-a") return null;
        if (select) {
          return { id: student.id, firstName: student.firstName, lastName: student.lastName };
        }
        if (include?.guardianContacts) return student;
        return student;
      },
    },
    communicationConsent: {
      findMany: async () => [],
    },
    communicationCampaign: {
      create: async ({ data }: { data: Record<string, any> }) => {
        const row = { id: `campaign-${campaigns.length + 1}`, createdAt: new Date("2026-07-18T10:30:00.000Z"), updatedAt: new Date("2026-07-18T10:30:00.000Z"), ...data };
        campaigns.push(row);
        return row;
      },
      update: async ({ where, data }: { where: { id: string }; data: Record<string, any> }) => {
        const index = campaigns.findIndex((row) => row.id === where.id);
        campaigns[index] = { ...campaigns[index], ...data };
        return campaigns[index];
      },
    },
    communicationAudience: {
      create: async ({ data }: { data: Record<string, any> }) => {
        const row = { id: `audience-${audiences.length + 1}`, ...data };
        audiences.push(row);
        return row;
      },
    },
    communicationAudienceSnapshot: {
      create: async ({ data }: { data: Record<string, any> }) => {
        const row = { id: `snapshot-${snapshots.length + 1}`, createdAt: new Date("2026-07-18T10:30:00.000Z"), ...data };
        snapshots.push(row);
        return row;
      },
    },
    communicationContent: {
      create: async ({ data }: { data: Record<string, any> }) => {
        const row = { id: `content-${contents.length + 1}`, createdAt: new Date("2026-07-18T10:30:00.000Z"), ...data };
        contents.push(row);
        return row;
      },
    },
    communicationRecipient: {
      createMany: async ({ data }: { data: Array<Record<string, any>> }) => {
        data.forEach((entry, index) => {
          recipients.push({
            id: `recipient-${recipients.length + index + 1}`,
            createdAt: new Date("2026-07-18T10:30:00.000Z"),
            updatedAt: new Date("2026-07-18T10:30:00.000Z"),
            ...entry,
          });
        });
        return { count: data.length };
      },
      findMany: async ({ where }: { where: { schoolId: string; campaignId: string } }) =>
        recipients.filter((row) => row.schoolId === where.schoolId && row.campaignId === where.campaignId),
    },
    communicationDelivery: {
      upsert: async ({ where, update, create }: { where: { idempotencyKey: string }; update: Record<string, any>; create: Record<string, any> }) => {
        const existingIndex = deliveries.findIndex((row) => row.idempotencyKey === where.idempotencyKey);
        if (existingIndex >= 0) {
          deliveries[existingIndex] = { ...deliveries[existingIndex], ...update };
          return deliveries[existingIndex];
        }
        const row = {
          id: `delivery-${deliveries.length + 1}`,
          attemptCount: 0,
          createdAt: new Date("2026-07-18T10:30:00.000Z"),
          updatedAt: new Date("2026-07-18T10:30:00.000Z"),
          ...create,
        };
        deliveries.push(row);
        return row;
      },
      update: async ({ where, data }: { where: { id: string }; data: Record<string, any> }) => {
        const index = deliveries.findIndex((row) => row.id === where.id);
        deliveries[index] = { ...deliveries[index], ...data };
        return deliveries[index];
      },
    },
    communicationDeliveryAttempt: {
      create: async ({ data }: { data: Record<string, any> }) => {
        const row = { id: `attempt-${attempts.length + 1}`, createdAt: new Date("2026-07-18T10:30:00.000Z"), ...data };
        attempts.push(row);
        return row;
      },
    },
    communicationChannelSetting: {
      findFirst: async () => ({ id: "setting-1", schoolId: "school-a", channel: "SMS", provider: "YOOLA_SMS", sendingEnabled: true, providerMetadataJson: null }),
    },
    communicationUsageRecord: {
      create: async ({ data }: { data: Record<string, any> }) => {
        const row = { id: `usage-${usageRecords.length + 1}`, ...data };
        usageRecords.push(row);
        return row;
      },
    },
    auditLog: {
      create: vi.fn(async ({ data }: { data: Record<string, any> }) => {
        audits.push(data);
        return {};
      }),
    },
  };

  return { db: db as never, campaigns, recipients, deliveries, attempts, usageRecords, audits };
}

describe("nfcPassOutNotificationService", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    resolveSmsProviderMock.mockReset();
  });

  it("creates and submits a dry-run parent SMS for a pass-out checkout", async () => {
    const { db, campaigns, recipients, deliveries, attempts } = createDb();

    const result = await notifyParentStudentPassOut(GATE_CTX, {
      studentId: "student-a",
      passOutId: "passout-1",
      movementEventId: "move-2",
      event: "CHECK_OUT",
      scannedAt: new Date("2026-07-18T10:30:00.000Z"),
      activeUntil: new Date("2026-07-18T14:00:00.000Z"),
      reason: "Medical appointment",
    }, db);

    expect(result.submitted).toBe(1);
    expect(result.failed).toBe(0);
    expect(campaigns[0]).toMatchObject({
      type: "ATTENDANCE_ALERT",
      status: "SENDING",
    });
    expect(recipients).toHaveLength(1);
    expect(deliveries[0]).toMatchObject({
      channel: "SMS",
      provider: "DRY_RUN",
      status: "SUBMITTED",
    });
    expect(attempts[0]).toMatchObject({
      provider: "DRY_RUN",
      status: "PROVIDER_ACCEPTED",
    });
  });

  it("records failed deliveries when the live SMS provider is not configured", async () => {
    vi.stubEnv("COMMUNICATION_DRY_RUN", "false");
    resolveSmsProviderMock.mockReturnValue({
      providerKey: "YOOLA_SMS",
      channel: "SMS",
      checkHealth: vi.fn(async () => ({ configured: false, sendingEnabled: false, issues: ["SMS_PROVIDER_DISABLED"] })),
      sendBatch: vi.fn(async () => ({ acceptedRecipients: [], rejectedRecipients: [] })),
    });
    const { db, campaigns, deliveries, attempts } = createDb();

    const result = await notifyParentStudentPassOut(GATE_CTX, {
      studentId: "student-a",
      passOutId: "passout-1",
      movementEventId: "move-3",
      event: "CHECK_IN",
      scannedAt: new Date("2026-07-18T15:30:00.000Z"),
      activeUntil: new Date("2026-07-18T14:00:00.000Z"),
      reason: "Medical appointment",
    }, db);

    expect(result.submitted).toBe(0);
    expect(result.failed).toBe(1);
    expect(campaigns[0]?.status).toBe("FAILED");
    expect(deliveries[0]).toMatchObject({
      provider: "YOOLA_SMS",
      status: "FAILED",
      lastErrorCode: "SMS_PROVIDER_DISABLED",
    });
    expect(attempts[0]).toMatchObject({
      provider: "YOOLA_SMS",
      status: "PROVIDER_REJECTED",
      errorCode: "SMS_PROVIDER_DISABLED",
    });
  });
});
